/**
 * Service Worker for KüchenWert
 *
 * Only same-origin GET requests are handled:
 *   - Hashed build assets (/assets/*.js, /assets/*.css): Network-First with cache fallback.
 *     Every deployment changes the chunk hashes; the cached copy is only used offline.
 *   - Other hashed build assets (/assets/* fonts, images): Cache-First, the hash changes with the content.
 *   - Unhashed public files (logos, /og-image.*, /images/*, favicons, manifest, fonts):
 *     Stale-While-Revalidate. They keep their file name when replaced, so every use
 *     refreshes the cached copy in the background. Images: at most 60 entries, entries
 *     older than 30 days are not served from the cache.
 *   - Navigation (HTML): Network-First, the network response is returned unchanged (also 404).
 *     Public pages are cached per path as offline fallback.
 *   - Never cached: cross-origin requests (Supabase REST/Auth/Storage/Functions, tracking),
 *     /api/*, personal pages (/projekt*, /abmelden, /dashboard*, /admin*, login/registration/auth).
 *
 * Do NOT precache '/' or '/index.html': the HTML changes with every deployment (new chunk
 * hashes), a stale copy would reference chunks that no longer exist.
 */

const CACHE_VERSION = 'v8';
const STATIC_CACHE_NAME = `kuechenwert-static-${CACHE_VERSION}`;
const ASSETS_CACHE_NAME = `kuechenwert-assets-${CACHE_VERSION}`;
const PAGES_CACHE_NAME = `kuechenwert-pages-${CACHE_VERSION}`;
const IMAGE_CACHE_NAME = `kuechenwert-images-${CACHE_VERSION}`;
const CURRENT_CACHES = [STATIC_CACHE_NAME, ASSETS_CACHE_NAME, PAGES_CACHE_NAME, IMAGE_CACHE_NAME];

const MAX_ASSET_ENTRIES = 150;
const MAX_PAGE_ENTRIES = 30;
const MAX_IMAGE_ENTRIES = 60;
const MAX_IMAGE_AGE_MS = 30 * 24 * 60 * 60 * 1000;

const IMAGE_EXTENSION = /\.(?:png|jpe?g|gif|webp|avif|svg|ico)$/i;
const STATIC_FILE = /(?:^\/manifest\.webmanifest|\.(?:woff2?|ttf))$/i;
// Tokens in the URL (/projekt/<token>, /auth/confirm, /reset-password) or account data.
const PRIVATE_PAGE = /^\/(?:projekt|abmelden|dashboard|admin|auth|login|register|forgot-password|reset-password)(?:\/|$)/;

let expiredImagesPurged = false;

// ─── Install / Activate ─────────────────────────────────────────────────────
// skipWaiting + clients.claim: the new worker takes over immediately. The page
// reloads only if an older worker was in control (src/lib/serviceWorker.ts),
// never on the first visit.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.filter((name) => !CURRENT_CACHES.includes(name)).map((name) => caches.delete(name)),
      );
      // Push notifications belonged to the former auction platform. Dropping leftover
      // subscriptions keeps browsers from showing generic "updated in the background" notices.
      const subscription = await self.registration.pushManager?.getSubscription().catch(() => null);
      await subscription?.unsubscribe().catch(() => false);
      await self.clients.claim();
    })(),
  );
});

// ─── Fetch ──────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Supabase (REST, Auth, Storage, Functions), tracking and other hosts go straight to the network.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(event, url));
  } else if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      /\.(?:js|css)$/.test(url.pathname)
        ? networkFirst(event, ASSETS_CACHE_NAME, MAX_ASSET_ENTRIES)
        : cacheFirst(event, ASSETS_CACHE_NAME, MAX_ASSET_ENTRIES),
    );
  } else if (request.destination === 'image' || IMAGE_EXTENSION.test(url.pathname)) {
    if (!expiredImagesPurged) {
      expiredImagesPurged = true;
      inBackground(event, deleteExpired(IMAGE_CACHE_NAME, MAX_IMAGE_AGE_MS));
    }
    event.respondWith(staleWhileRevalidate(event, IMAGE_CACHE_NAME, MAX_IMAGE_ENTRIES, MAX_IMAGE_AGE_MS));
  } else if (STATIC_FILE.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(event, STATIC_CACHE_NAME));
  }
  // Everything else (sw.js, /js/*.js?v=…, robots.txt, sitemap.xml) uses the browser HTTP cache.
});

// ─── Strategies ─────────────────────────────────────────────────────────────

async function handleNavigation(event, url) {
  const cache = await caches.open(PAGES_CACHE_NAME);
  try {
    const response = await fetch(event.request);
    const isHtml = (response.headers.get('content-type') || '').includes('text/html');
    if (isCacheable(response) && isHtml && !PRIVATE_PAGE.test(url.pathname)) {
      // Keyed by path only: no tracking parameters in the cache keys.
      inBackground(event, putAndTrim(cache, url.pathname, response.clone(), MAX_PAGE_ENTRIES));
    }
    return response;
  } catch (error) {
    // Offline: this page if cached, otherwise any cached page (the app renders the route itself).
    const cached = (await cache.match(url.pathname)) || (await newestEntry(cache));
    return cached || offlineResponse();
  }
}

async function networkFirst(event, cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  try {
    return await fetchAndCache(event, cache, maxEntries);
  } catch (error) {
    return (await cache.match(event.request)) || offlineResponse();
  }
}

async function cacheFirst(event, cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(event.request);
  if (cached) return cached;
  try {
    return await fetchAndCache(event, cache, maxEntries);
  } catch (error) {
    return offlineResponse();
  }
}

async function staleWhileRevalidate(event, cacheName, maxEntries, maxAgeMs) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(event.request);
  if (cached && !isExpired(cached, maxAgeMs)) {
    inBackground(event, fetchAndCache(event, cache, maxEntries));
    return cached;
  }
  try {
    return await fetchAndCache(event, cache, maxEntries);
  } catch (error) {
    // Offline: an expired copy is still better than nothing.
    return cached || offlineResponse();
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function fetchAndCache(event, cache, maxEntries) {
  const response = await fetch(event.request);
  if (isCacheable(response)) {
    inBackground(event, putAndTrim(cache, event.request, response.clone(), maxEntries));
  }
  return response;
}

function isCacheable(response) {
  return response.status === 200 && response.type === 'basic';
}

function isExpired(response, maxAgeMs) {
  if (!maxAgeMs) return false;
  const fetchedAt = Date.parse(response.headers.get('date') || '');
  return Number.isNaN(fetchedAt) || Date.now() - fetchedAt > maxAgeMs;
}

/** Stores the response and drops the oldest entries (Cache API keys are in insertion order). */
async function putAndTrim(cache, key, response, maxEntries) {
  await cache.put(key, response);
  if (!maxEntries) return;
  const keys = await cache.keys();
  const excess = Math.max(0, keys.length - maxEntries);
  await Promise.all(keys.slice(0, excess).map((entry) => cache.delete(entry)));
}

async function deleteExpired(cacheName, maxAgeMs) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  await Promise.all(
    keys.map(async (key) => {
      const response = await cache.match(key);
      if (!response || isExpired(response, maxAgeMs)) await cache.delete(key);
    }),
  );
}

async function newestEntry(cache) {
  const keys = await cache.keys();
  return keys.length > 0 ? cache.match(keys[keys.length - 1]) : undefined;
}

function inBackground(event, promise) {
  const settled = promise.catch(() => {});
  try {
    event.waitUntil(settled);
  } catch (error) {
    // Event already finished: the promise still runs while the worker is alive.
  }
}

function offlineResponse() {
  return new Response('Offline – bitte die Internetverbindung prüfen.', {
    status: 503,
    statusText: 'Service Unavailable',
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

// ─── Message handling ───────────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type) {
    switch (event.data.type) {
      case 'SKIP_WAITING':
        self.skipWaiting();
        break;
      case 'CLEAR_CACHE':
        clearAllCaches().then(() => {
          if (event.ports[0]) event.ports[0].postMessage({ success: true });
        });
        break;
      case 'GET_CACHE_SIZE':
        getCacheSize().then((size) => {
          if (event.ports[0]) event.ports[0].postMessage({ size });
        });
        break;
    }
  }
});

async function clearAllCaches() {
  const cacheNames = await caches.keys();
  return Promise.all(cacheNames.map((name) => caches.delete(name)));
}

async function getCacheSize() {
  const cacheNames = await caches.keys();
  let totalSize = 0;

  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName);
    const requests = await cache.keys();

    for (const request of requests) {
      const response = await cache.match(request);
      if (response) {
        const blob = await response.blob();
        totalSize += blob.size;
      }
    }
  }

  return totalSize;
}

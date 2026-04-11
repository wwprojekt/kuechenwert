/**
 * Service Worker for CaravanWert
 * 
 * Caching strategies:
 *   - Hashed build assets (/assets/*.js, /assets/*.css): Network-First with cache fallback
 *     → Vite generates unique hashes per build, so stale chunks must never be served from cache
 *   - Immutable assets (fonts, favicon, manifest): Cache-First (they rarely change)
 *   - Images: Cache-First with network fallback
 *   - API / Supabase: Network-First with 5-min cache fallback
 *   - Navigation (HTML): Network-First, fallback to cached /index.html for SPA routing
 *
 * IMPORTANT: After every deployment the chunk hashes change. The old Cache-First strategy
 * caused "Failed to fetch dynamically imported module" errors because the SW served stale
 * JS files. This version fixes that by using Network-First for all hashed build assets.
 */

const CACHE_VERSION = 'v3';
const STATIC_CACHE_NAME = `caravanwert-static-${CACHE_VERSION}`;
const ASSETS_CACHE_NAME = `caravanwert-assets-${CACHE_VERSION}`;
const DYNAMIC_CACHE_NAME = `caravanwert-dynamic-${CACHE_VERSION}`;
const IMAGE_CACHE_NAME = `caravanwert-images-${CACHE_VERSION}`;

// Only truly immutable files that rarely change.
// IMPORTANT: Do NOT precache '/' or '/index.html' here!
// The SPA shell changes with every deployment (new chunk hashes in <script> tags).
// Precaching it would serve a stale version with old chunk references.
// Navigation requests use Network-First via handleNavigation() instead.
const PRECACHE_ASSETS = [
  '/favicon.ico',
  '/favicon.png',
];

// Image patterns to cache
const IMAGE_PATTERNS = [
  /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
  /supabase\.co.*\/storage\/v1\/object\/public/,
];

// ─── Install ────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');

  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Pre-caching shell assets');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => {
        console.log('Service Worker: Installation complete');
        // Activate immediately so the new SW takes over right away
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker: Installation failed', error);
      })
  );
});

// ─── Activate ───────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');

  // List of caches that belong to the CURRENT version
  const currentCaches = [
    STATIC_CACHE_NAME,
    ASSETS_CACHE_NAME,
    DYNAMIC_CACHE_NAME,
    IMAGE_CACHE_NAME,
  ];

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Delete any cache that is NOT in the current set
            if (!currentCaches.includes(cacheName)) {
              console.log('Service Worker: Deleting old cache', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker: Activation complete');
        // Take control of all open tabs immediately
        return self.clients.claim();
      })
  );
});

// ─── Fetch ──────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) return;

  // Route to the correct handler
  if (isHashedBuildAsset(url)) {
    event.respondWith(handleHashedAsset(request));
  } else if (isImmutableAsset(url)) {
    event.respondWith(handleImmutableAsset(request));
  } else if (isImage(url)) {
    event.respondWith(handleImage(request));
  } else if (isApiRequest(url)) {
    event.respondWith(handleApiRequest(request));
  } else if (isNavigationRequest(request)) {
    event.respondWith(handleNavigation(request));
  }
  // All other requests pass through to the network without interception
});

// ─── Request classifiers ────────────────────────────────────────────────────

/**
 * Hashed build assets produced by Vite: /assets/SomeChunk-Ab12Cd34.js
 * These MUST use Network-First because after a deployment the hash changes
 * and old cached chunks would cause "Failed to fetch dynamically imported module".
 */
function isHashedBuildAsset(url) {
  return url.origin === location.origin &&
    url.pathname.startsWith('/assets/') &&
    (url.pathname.endsWith('.js') || url.pathname.endsWith('.css'));
}

/**
 * Truly immutable assets that almost never change: fonts, favicon, manifest.
 * Safe to use Cache-First.
 */
function isImmutableAsset(url) {
  return url.origin === location.origin && (
    url.pathname.endsWith('.woff') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname === '/manifest.json' ||
    url.pathname === '/favicon.ico' ||
    url.pathname === '/favicon.png'
  );
}

function isImage(url) {
  return IMAGE_PATTERNS.some((pattern) => pattern.test(url.href));
}

function isApiRequest(url) {
  return url.hostname.includes('supabase.co');
}

function isNavigationRequest(request) {
  return request.mode === 'navigate';
}

// ─── Handlers ───────────────────────────────────────────────────────────────

/**
 * NETWORK-FIRST for hashed build assets.
 * Try the network; on success, update the cache. On failure, fall back to cache.
 * This ensures users always get the latest chunks after a deployment.
 */
async function handleHashedAsset(request) {
  const cache = await caches.open(ASSETS_CACHE_NAME);

  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      // Update cache with the fresh response
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    // Network unavailable – try cache as fallback
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      console.log('Service Worker: Serving cached build asset (offline)', request.url);
      return cachedResponse;
    }

    console.error('Service Worker: Build asset unavailable', request.url);
    return new Response('Asset not available offline', { status: 503 });
  }
}

/**
 * CACHE-FIRST for immutable assets (fonts, favicon).
 * These files almost never change, so cache-first is safe and fast.
 */
async function handleImmutableAsset(request) {
  try {
    const cache = await caches.open(STATIC_CACHE_NAME);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.error('Service Worker: Immutable asset fetch failed', error);
    return new Response('Asset not available offline', { status: 503 });
  }
}

/**
 * CACHE-FIRST for images with network fallback.
 */
async function handleImage(request) {
  try {
    const cache = await caches.open(IMAGE_CACHE_NAME);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.error('Service Worker: Image fetch failed', error);
    return new Response('', { status: 503 });
  }
}

/**
 * NETWORK-FIRST for API / Supabase requests with 5-minute cache fallback.
 */
async function handleApiRequest(request) {
  try {
    const cache = await caches.open(DYNAMIC_CACHE_NAME);

    try {
      const networkResponse = await fetch(request);

      if (networkResponse.ok) {
        const headers = new Headers(networkResponse.headers);
        headers.set('sw-cached-at', Date.now().toString());

        const responseToCache = new Response(networkResponse.clone().body, {
          status: networkResponse.status,
          statusText: networkResponse.statusText,
          headers: headers,
        });

        cache.put(request, responseToCache);
      }

      return networkResponse;
    } catch (networkError) {
      const cachedResponse = await cache.match(request);

      if (cachedResponse) {
        const cachedAt = cachedResponse.headers.get('sw-cached-at');
        const age = Date.now() - parseInt(cachedAt || '0');
        const maxAge = 5 * 60 * 1000; // 5 minutes

        if (age < maxAge) {
          console.log('Service Worker: Serving cached API response');
          return cachedResponse;
        }
      }

      throw networkError;
    }
  } catch (error) {
    console.error('Service Worker: API fetch failed', error);
    return new Response(
      JSON.stringify({ error: 'Service temporarily unavailable' }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * NETWORK-FIRST for navigation, fallback to cached /index.html for SPA routing.
 */
async function handleNavigation(request) {
  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      // Update cached index.html with the latest version
      const cache = await caches.open(STATIC_CACHE_NAME);
      cache.put('/index.html', networkResponse.clone());
      return networkResponse;
    }

    // Non-ok network response – fall back to cached shell
    const cache = await caches.open(STATIC_CACHE_NAME);
    const cachedResponse = await cache.match('/index.html');

    if (cachedResponse) {
      return cachedResponse;
    }

    throw new Error('No cached fallback available');
  } catch (error) {
    // Offline – serve cached SPA shell
    const cache = await caches.open(STATIC_CACHE_NAME);
    const cachedResponse = await cache.match('/index.html');

    if (cachedResponse) {
      return cachedResponse;
    }

    console.error('Service Worker: Navigation fetch failed', error);
    return new Response('Page not available offline', { status: 503 });
  }
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

// ─── Push notifications ─────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  console.log('Service Worker: Push received');

  let data = {
    title: 'CaravanWert',
    body: 'Neue Benachrichtigung',
    icon: '/logo.png',
    badge: '/favicon.png',
    url: 'https://caravanwert.de',
    tag: 'default',
  };

  try {
    if (event.data) {
      const payload = event.data.json();
      data = { ...data, ...payload };
    }
  } catch (e) {
    console.error('Service Worker: Push data parse error', e);
  }

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    tag: data.tag,
    renotify: true,
    requireInteraction: data.tag === 'outbid' || data.tag === 'auction-ending',
    data: {
      url: data.url,
      ...data.data,
    },
    actions: [],
    vibrate: [200, 100, 200],
  };

  if (data.tag === 'outbid') {
    options.actions = [
      { action: 'bid', title: 'Jetzt bieten' },
      { action: 'dismiss', title: 'Schließen' },
    ];
  } else if (data.tag === 'auction-ending') {
    options.actions = [
      { action: 'view', title: 'Auktion ansehen' },
      { action: 'dismiss', title: 'Schließen' },
    ];
  } else if (data.tag === 'auction-won') {
    options.actions = [
      { action: 'view', title: 'Details ansehen' },
    ];
  }

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification clicked', event.action);
  event.notification.close();

  const url = event.notification.data?.url || 'https://caravanwert.de';

  if (event.action === 'dismiss') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes('caravanwert.de') && 'focus' in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        return clients.openWindow(url);
      })
  );
});

self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('Service Worker: Push subscription changed');
  event.waitUntil(
    self.registration.pushManager.subscribe(event.oldSubscription.options)
      .then((subscription) => {
        return fetch('https://zcrwqxsyptjwkuxfacvq.supabase.co/functions/v1/save-push-subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(subscription),
        });
      })
  );
});

console.log('Service Worker: Loaded (v3 – No precache for index.html, Network-First for build assets)');

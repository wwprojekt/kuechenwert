/**
 * Service Worker for CaravanWert
 * Provides offline support and caching strategies
 */

const CACHE_NAME = 'caravanwert-v1';
const STATIC_CACHE_NAME = 'caravanwert-static-v1';
const DYNAMIC_CACHE_NAME = 'caravanwert-dynamic-v1';
const IMAGE_CACHE_NAME = 'caravanwert-images-v1';

// Static assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/favicon.png',
];

// API endpoints that should be cached
const API_CACHE_PATTERNS = [
  /\/api\/auctions/,
  /\/api\/motorhomes/,
  /\/api\/stations/,
];

// Image patterns to cache
const IMAGE_PATTERNS = [
  /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
  /supabase\.co.*\/storage\/v1\/object\/public/,
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('Service Worker: Installation complete');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker: Installation failed', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Delete old caches
            if (cacheName !== STATIC_CACHE_NAME && 
                cacheName !== DYNAMIC_CACHE_NAME && 
                cacheName !== IMAGE_CACHE_NAME) {
              console.log('Service Worker: Deleting old cache', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker: Activation complete');
        return self.clients.claim();
      })
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension requests
  if (url.protocol === 'chrome-extension:') {
    return;
  }

  // Handle different types of requests
  if (isStaticAsset(request)) {
    event.respondWith(handleStaticAsset(request));
  } else if (isImage(request)) {
    event.respondWith(handleImage(request));
  } else if (isApiRequest(request)) {
    event.respondWith(handleApiRequest(request));
  } else if (isNavigationRequest(request)) {
    event.respondWith(handleNavigation(request));
  }
});

// Check if request is for a static asset
function isStaticAsset(request) {
  const url = new URL(request.url);
  return url.origin === location.origin && (
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.woff') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname === '/manifest.json' ||
    url.pathname === '/favicon.ico'
  );
}

// Check if request is for an image
function isImage(request) {
  return IMAGE_PATTERNS.some(pattern => pattern.test(request.url));
}

// Check if request is for API
function isApiRequest(request) {
  const url = new URL(request.url);
  return url.hostname.includes('supabase.co') || 
         API_CACHE_PATTERNS.some(pattern => pattern.test(request.url));
}

// Check if request is a navigation request
function isNavigationRequest(request) {
  return request.mode === 'navigate';
}

// Handle static assets with cache-first strategy
async function handleStaticAsset(request) {
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
    console.error('Service Worker: Static asset fetch failed', error);
    return new Response('Asset not available offline', { status: 503 });
  }
}

// Handle images with cache-first strategy and long-term caching
async function handleImage(request) {
  try {
    const cache = await caches.open(IMAGE_CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }

    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cache images for a long time
      const responseToCache = networkResponse.clone();
      cache.put(request, responseToCache);
    }
    
    return networkResponse;
  } catch (error) {
    console.error('Service Worker: Image fetch failed', error);
    // Return a placeholder image or empty response
    return new Response('', { status: 503 });
  }
}

// Handle API requests with network-first strategy and short-term caching
async function handleApiRequest(request) {
  try {
    const cache = await caches.open(DYNAMIC_CACHE_NAME);
    
    // Try network first for fresh data
    try {
      const networkResponse = await fetch(request);
      
      if (networkResponse.ok) {
        // Cache successful responses for short time
        const responseToCache = networkResponse.clone();
        
        // Set a short TTL for API responses
        const headers = new Headers(responseToCache.headers);
        headers.set('sw-cached-at', Date.now().toString());
        
        const cachedResponse = new Response(responseToCache.body, {
          status: responseToCache.status,
          statusText: responseToCache.statusText,
          headers: headers
        });
        
        cache.put(request, cachedResponse);
      }
      
      return networkResponse;
    } catch (networkError) {
      // Network failed, try cache
      const cachedResponse = await cache.match(request);
      
      if (cachedResponse) {
        // Check if cached response is still fresh (5 minutes)
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
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Handle navigation requests with network-first, fallback to cached index.html
async function handleNavigation(request) {
  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      return networkResponse;
    }
    
    // Network failed, serve cached index.html for SPA routing
    const cache = await caches.open(STATIC_CACHE_NAME);
    const cachedResponse = await cache.match('/index.html');
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    throw new Error('No cached fallback available');
  } catch (error) {
    console.error('Service Worker: Navigation fetch failed', error);
    return new Response('Page not available offline', { status: 503 });
  }
}

// Message handling for cache management
self.addEventListener('message', (event) => {
  if (event.data && event.data.type) {
    switch (event.data.type) {
      case 'SKIP_WAITING':
        self.skipWaiting();
        break;
      case 'CLEAR_CACHE':
        clearAllCaches().then(() => {
          event.ports[0].postMessage({ success: true });
        });
        break;
      case 'GET_CACHE_SIZE':
        getCacheSize().then((size) => {
          event.ports[0].postMessage({ size });
        });
        break;
    }
  }
});

// Clear all caches
async function clearAllCaches() {
  const cacheNames = await caches.keys();
  return Promise.all(
    cacheNames.map(cacheName => caches.delete(cacheName))
  );
}

// Get total cache size
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

console.log('Service Worker: Loaded');

const CACHE_NAME = 'aurastream-cache-v12';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './db.js',
  './api.js',
  './manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(ASSETS_TO_CACHE);
      })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only cache GET requests
  if (event.request.method !== 'GET') return;
  
  // Don't cache media streams (audio) or API calls that shouldn't be cached
  const url = new URL(event.request.url);
  if (url.pathname.endsWith('.mp3') || url.pathname.endsWith('.wav') || url.hostname.includes('api')) {
    return; // let it pass through to network
  }

  // Use Network First, falling back to cache strategy
  // This ensures users always get the latest updates when online
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Cache the new network response
        return caches.open(CACHE_NAME).then((cache) => {
          if (networkResponse.ok) {
             cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        });
      })
      .catch(() => {
        // If network fails (offline), fall back to cache
        return caches.match(event.request);
      })
  );
});

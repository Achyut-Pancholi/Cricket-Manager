const CACHE_NAME = 'gullyscore-v3';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/match-creation.html',
  '/player-registration.html',
  '/team-shuffle.html',
  '/toss.html',
  '/live-score.html',
  '/match-summary.html',
  '/css/style.css',
  '/js/app.js',
  '/js/firebase-config.js',
  '/js/store.js',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=Outfit:wght@500;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response; // Return cached version
        }
        return fetch(event.request).then((networkResponse) => {
          // Dynamic caching could be added here
          return networkResponse;
        }).catch(() => {
          // Fallback if offline and not in cache
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
      })
  );
});

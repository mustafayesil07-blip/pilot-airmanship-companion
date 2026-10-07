const CACHE = 'app-v5';
const CORE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(cache) {
      // cache.add() resolves relative URLs to absolute before storing,
      // so cache.match(absoluteRequest) works correctly at fetch time.
      return Promise.all(
        CORE.map(function(url) {
          return cache.add(url).catch(function() {
            // ignore individual failures (e.g. icon not yet deployed)
          });
        })
      );
    }).then(function() { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE; })
            .map(function(k) { return caches.delete(k); })
      );
    }).then(function() { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e) {
  if (e.request.method !== 'GET') return;
  var url = e.request.url;
  if (url.startsWith('chrome-extension://')) return;
  if (url.startsWith('blob:') || url.startsWith('data:')) return;

  e.respondWith(
    caches.open(CACHE).then(function(cache) {
      return cache.match(e.request).then(function(cached) {
        // Background revalidation (stale-while-revalidate)
        var networkFetch = fetch(e.request).then(function(response) {
          if (response && response.status === 200 && response.type !== 'opaque') {
            cache.put(e.request, response.clone());
          }
          return response;
        }).catch(function() { return null; });

        if (cached) return cached;

        // Nothing cached — wait for network
        return networkFetch.then(function(response) {
          if (response) return response;
          // Offline fallback for page navigations
          if (e.request.mode === 'navigate') {
            return cache.match(new Request('./index.html'));
          }
          return new Response('', { status: 503, statusText: 'Offline' });
        });
      });
    })
  );
});

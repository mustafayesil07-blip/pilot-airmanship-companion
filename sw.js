const CACHE = 'app-v2';
const CORE = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(c) {
      return Promise.all(
        CORE.map(function(url) {
          return fetch(url, { cache: 'no-store' }).then(function(r) {
            if (r && r.status === 200) return c.put(url, r);
          }).catch(function() {
            return caches.match(url).then(function(old) {
              if (old) return c.put(url, old);
            });
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

  e.respondWith(
    caches.open(CACHE).then(function(cache) {
      return cache.match(e.request).then(function(cached) {
        // Start network fetch (runs in background to keep cache fresh)
        var networkFetch = fetch(e.request).then(function(response) {
          if (response && response.status === 200 && response.type !== 'opaque') {
            cache.put(e.request, response.clone());
          }
          return response;
        }).catch(function() { return null; });

        // Return cached version immediately (stale-while-revalidate)
        if (cached) return cached;

        // No cache: wait for network
        return networkFetch.then(function(response) {
          if (response) return response;
          if (e.request.mode === 'navigate') return cache.match('./index.html');
          return new Response('', { status: 503, statusText: 'Offline' });
        });
      });
    })
  );
});

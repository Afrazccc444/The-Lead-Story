/* The Lead Story — offline support.
   - Site files (scripts, styles, fonts) and photos: served from the cache,
     refreshed in the background.
   - Pages and edition data: always fetched fresh when online; the last copy
     is kept so editions you have opened still load without internet.
   - The admin area, sign-in, PDF downloads and anything that changes data
     are never cached. */
const CACHE = 'lead-story-v3';
const SHELL = ['/', '/index.html', '/favicon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Video clips are too large to store offline, so they always stream from the server.
const NEVER = /^\/api\/(admin|auth|print)|\/pdf(\?|$)|\/poll$|\.(mp4|webm|mov)$/;

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = (await cache.match(request)) ?? (request.mode === 'navigate' ? await cache.match('/index.html') : undefined);
    if (cached) return cached;
    throw new Error('offline and not cached');
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const refresh = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached ?? refresh;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || NEVER.test(url.pathname + url.search)) return;

  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/uploads/') || url.pathname === '/favicon.svg') {
    event.respondWith(cacheFirst(request));
  } else if (request.mode === 'navigate' || url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
  }
});

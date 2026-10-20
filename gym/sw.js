/* sw.js: precaches the app, the data and every photo listed in data/media.json for offline use.
   Bump VERSION whenever a file changes; the old cache is deleted on activate. YouTube stays online-only. */
const VERSION = 'antrenman-v1';
const CORE = [
  './', 'index.html', 'manifest.json',
  'css/fit.css', 'css/app.css',
  'js/exercise-data.js', 'js/exercise.js', 'js/session-timeline.js', 'js/block-picker.js', 'js/app.js',
  'data/media.json',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(CORE);
    const media = await (await cache.match('data/media.json')).json();
    const photos = new Set();
    for (const k in media) for (const p of (media[k].photos || [])) if (!/^(https?:)?\/\//.test(p)) photos.add(p.replace(/^\/+/, ''));
    await cache.addAll([...photos]);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});

// cache first for our own files; pages fall back to the cached index.html
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const hit = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch (e) {
      if (req.mode === 'navigate') return (await cache.match('index.html')) || Response.error();
      return Response.error();
    }
  })());
});

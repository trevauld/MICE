// MICE service worker: precache the app shell so it works offline. No network requests beyond our own files.
// Bump VERSION on every release so installed copies update.
const VERSION = 'mice-v4';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  // Activate straight away. A page already running keeps its own code, so a session is never swapped mid-way.
  // (Waiting for all tabs to close never happens for an installed iOS app, which is only suspended.)
  self.skipWaiting();
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  if (r.mode === 'navigate') {
    // Pages: network first so a launch online always gets the latest; the cache is the offline fallback.
    e.respondWith(fetch(r, { cache: 'no-cache' }).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put('./index.html', copy)); }
      return res;
    }).catch(() => caches.match('./index.html')));
    return;
  }
  e.respondWith(caches.match(r).then((hit) => hit || fetch(r)));
});

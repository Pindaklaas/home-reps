// Home Reps service worker: lets the app install on a phone's home screen, open offline,
// and show notifications. The page is fetched fresh when online, so updates show up right away.
const CACHE = 'homereps-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  // Network first (fresh app), cache as fallback (offline).
  e.respondWith(fetch(r).then(res => { const copy = res.clone(); if (res.ok) caches.open(CACHE).then(c => c.put(r, copy)); return res; }).catch(() => caches.match(r).then(m => m || caches.match('./index.html'))));
});
// Tapping a notification opens (or focuses) the app.
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({type:'window', includeUncontrolled:true}).then(cs => cs.length ? cs[0].focus() : self.clients.openWindow('./index.html')));
});

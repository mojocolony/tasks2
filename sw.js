/* Isolated service-worker scope and cache: never touches the existing Tasks app. */
const CACHE = 'tasks-now-later-preview-v014';
const APP_FILES = ['./', './index.html', './styles.css?v=012', './app.js?v=012', './core.mjs?v=012', './manifest.webmanifest?v=012', './icons/icon.svg?v=012', './icons/icon-dark.svg?v=012', './icons/icon-192-dark.png?v=012', './icons/icon-512-dark.png?v=012'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(APP_FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('tasks-now-later-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request, {cache:'no-cache'}).then(response => {
    if (response.ok) { const copy = response.clone(); caches.open(CACHE).then(c => c.put(event.request, copy)); }
    return response;
  }).catch(async () => (await caches.match(event.request)) || (event.request.mode === 'navigate' ? await caches.match('./index.html') : null) || Response.error()));
});

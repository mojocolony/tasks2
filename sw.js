/* Isolated service-worker scope and cache: never touches the existing Tasks app. */
const CACHE = 'tasks-now-later-preview-v015';
const APP_FILES = ['./', './index.html', './styles.css?v=020', './app.js?v=021', './core.mjs?v=021', './src/sync-controller.mjs?v=020', './src/cloud-client.mjs?v=020', './src/sync-repository.mjs?v=020', './src/sync-core.mjs?v=020', './manifest.webmanifest?v=021', './icons/icon-light.svg?v=021', './icons/icon-dark.svg?v=012', './icons/icon-192-light.png?v=021', './icons/icon-512-light.png?v=021'];
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

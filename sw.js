/* Service worker du Carnet PHY321 : lecture hors connexion après une première visite.
   Pages HTML : réseau d'abord (contenu à jour), cache en secours.
   Autres ressources (CSS, JS, polices, MathJax) : cache d'abord. */
const VERSION = 'carnet-2026-10-10-bilingue';
const CORE = [
  './', './index.html', './en/index.html', './manifest.json',
  './assets/css/carnet.css', './assets/js/carnet.js', './assets/js/mathjax-config.js',
  './assets/js/labs/bloch.js', './assets/img/favicon.svg'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const cacheable = url.origin === location.origin ||
    /^(cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(url.hostname);
  if (!cacheable) return;

  const put = res => {
    if (res && (res.ok || res.type === 'opaque')) {
      const copy = res.clone();
      caches.open(VERSION).then(c => c.put(req, copy));
    }
    return res;
  };

  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(put).catch(() => caches.match(req).then(r => r || caches.match('./index.html'))));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(put)));
});

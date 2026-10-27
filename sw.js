/* Service worker du Carnet PHY321 : lecture hors connexion après une première visite, mise à jour par différence.
   Pages HTML : réseau d'abord (contenu à jour), cache en secours. Autres ressources (CSS, JS, polices, MathJax) : cache d'abord.
   Mise à jour : sur Vercel, chaque déploiement publie `versions.json` (empreinte de chaque fichier) et change VERSION
   (outils/generer_versions.mjs). La nouvelle version RECOPIE localement les fichiers dont l'empreinte n'a pas changé et ne
   télécharge que les fichiers nouveaux ou modifiés. Sans `versions.json` (GitHub Pages) : le noyau est retéléchargé, comme avant. */
const PREFIX = 'carnet-';
const VERSION = 'carnet-2026-10-27-predictions-2-3'; // remplacé à la construction Vercel par « carnet-<empreinte du contenu> »
const CORE = [
  './', './index.html', './en/index.html', './manifest.json', './manifest.en.json',
  './assets/css/carnet.css', './assets/js/carnet.js', './assets/js/mathjax-config.js',
  './assets/js/labs/bloch.js', './assets/js/diagnostic.js', './assets/img/favicon.svg'
];

const portee = new URL(self.registration.scope);
// Clé d'un fichier dans versions.json : son chemin relatif à la portée ('./' -> 'index.html').
const cle = u => { let p = new URL(u, portee).pathname.slice(portee.pathname.length); if (p === '' || p.endsWith('/')) p += 'index.html'; return p; };

async function installerParDifference() {
  const nouveau = await caches.open(VERSION);
  let manifeste = null;
  try { const r = await fetch('./versions.json', { cache: 'no-store' }); if (r.ok) manifeste = await r.json(); } catch { /* GitHub Pages, ou hors connexion */ }
  const anciens = (await caches.keys()).filter(k => k.startsWith(PREFIX) && k !== VERSION).sort();
  const ancien = anciens.length ? await caches.open(anciens[anciens.length - 1]) : null;
  const rm = ancien && manifeste ? await ancien.match('./versions.json') : null;
  const ancienManifeste = rm ? await rm.json().catch(() => null) : null;

  // À garder disponible hors connexion : le noyau, plus tout ce que l'étudiant a déjà ouvert (s'il existe encore dans le nouveau manifeste).
  const demandes = new Map(CORE.map(u => [new URL(u, portee).href, true]));
  if (ancien && manifeste) {
    for (const r of await ancien.keys()) {
      const u = new URL(r.url), k = cle(r.url);
      if (u.origin === location.origin && k !== 'versions.json' && !k.startsWith('__') && manifeste[k] !== undefined) demandes.set(r.url, false);
    }
  }
  let copies = 0, telecharges = 0;
  for (const [href, essentiel] of demandes) {
    const k = cle(href);
    if (ancien && ancienManifeste && manifeste && ancienManifeste[k] !== undefined && ancienManifeste[k] === manifeste[k]) {
      const hit = await ancien.match(href);
      if (hit) { await nouveau.put(href, hit); copies++; continue; } // inchangé : recopié depuis l'ancien cache, aucun téléchargement
    }
    try {
      const res = await fetch(href, { cache: 'reload' }); // 'reload' : jamais l'ancienne copie du cache HTTP du navigateur
      if (!res.ok) throw new Error(String(res.status));
      await nouveau.put(href, res); telecharges++;
    } catch (err) { if (essentiel) throw err; } // un fichier du noyau manquant fait échouer l'installation (l'ancienne version reste active)
  }
  // Ressources d'autres sites (MathJax, polices) : absentes du manifeste, recopiées telles quelles pour rester disponibles hors connexion.
  if (ancien) for (const r of await ancien.keys()) {
    if (new URL(r.url).origin === location.origin) continue;
    const hit = await ancien.match(r); if (hit) { await nouveau.put(r.url, hit); copies++; }
  }
  if (manifeste) await nouveau.put('./versions.json', new Response(JSON.stringify(manifeste), { headers: { 'Content-Type': 'application/json' } }));
  await nouveau.put('./__bilan__', new Response(JSON.stringify({ version: VERSION, copies, telecharges, par_difference: !!(ancienManifeste && manifeste) }), { headers: { 'Content-Type': 'application/json' } }));
}

self.addEventListener('install', e => {
  e.waitUntil(installerParDifference().then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Notifications push (barre de notification, écran verrouillé) : le serveur envoie un signal sans contenu quand un devoir est publié ;
   on lit alors /api/statut (public) pour composer le texte. Toujours afficher une notification (obligation du navigateur). */
self.addEventListener('push', e => e.waitUntil((async () => {
  const fr = (self.navigator.language || 'fr').toLowerCase().startsWith('fr');
  const loc = fr ? 'fr-FR' : 'en-GB', quand = iso => new Date(iso).toLocaleString(loc, { dateStyle: 'medium', timeStyle: 'short' });
  let corps = fr ? 'Un devoir est disponible sur le Carnet.' : 'An assignment is available on the Carnet.', rappel = false;
  try {
    const s = await (await fetch('/api/statut', { cache: 'no-store' })).json();
    // devoir qui ferme dans moins de 26 h : c'est le rappel de la veille (ou un devoir très court)
    rappel = !!s.ouvert && new Date(s.ouvert.ferme) - Date.now() < 26 * 3600e3;
    if (s.ouvert) corps = fr ? `${s.ouvert.titre} — à rendre avant le ${quand(s.ouvert.ferme)}.` : `${s.ouvert.titre} — due ${quand(s.ouvert.ferme)}.`;
    else if (s.prochain) corps = fr ? `${s.prochain.titre} — ouverture le ${quand(s.prochain.ouvre)}.` : `${s.prochain.titre} — opens ${quand(s.prochain.ouvre)}.`;
  } catch { /* hors connexion : texte générique */ }
  await self.registration.showNotification(rappel ? (fr ? 'Rappel PHY321 : devoir bientôt fermé' : 'PHY321 reminder: assignment closing soon') : (fr ? 'Nouveau devoir PHY321' : 'New PHY321 assignment'), {
    body: corps, icon: './assets/img/icon-192.png', badge: './assets/img/icon-192.png', tag: 'devoir', renotify: true,
    requireInteraction: true, vibrate: [200, 100, 200], data: { url: fr ? '/devoirs.html' : '/en/assignments.html' }
  });
})()));

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || '/devoirs.html', self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(l => {
    const ouverte = l.find(c => c.url === url);
    return ouverte ? ouverte.focus() : self.clients.openWindow(url);
  }));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.pathname.startsWith('/api/')) return; // l'API ne se met jamais en cache
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

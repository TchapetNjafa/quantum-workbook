/* Compte PHY321 : connexion Google institutionnelle (Vercel seulement).
   Sur GitHub Pages, la page explique que la connexion n'y existe pas. Aucune bibliothèque
   sauf le script officiel Google Identity Services, chargé uniquement ici. */
(() => {
  'use strict';
  const EN = (document.documentElement.lang || 'fr').startsWith('en');
  const t = (fr, en) => (EN ? en : fr);
  const root = document.getElementById('compte');
  if (!root) return;

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const etat = (html, cls) => { root.querySelector('[data-etat]').innerHTML = html; root.querySelector('[data-etat]').className = cls || ''; };
  const api = (path, opt) => fetch(path, { credentials: 'same-origin', ...opt });

  if (/\.github\.io$/.test(location.hostname) || location.protocol === 'file:') {
    etat(t('La connexion n’existe que sur le site hébergé sur Vercel. Ici, le Carnet et le quiz fonctionnent sans compte.',
      'Sign-in only exists on the Vercel-hosted site. Here, the Notebook and the quiz work without an account.'), 'muted');
    return;
  }

  const montrerSession = s => {
    root.querySelector('[data-bouton]').hidden = true;
    etat(`<p>${t('Connecté : ', 'Signed in: ')}<b>${esc(s.email)}</b>${s.teacher ? t(' (enseignant)', ' (teacher)') : ''}</p>
      <div class="btn-row"><button class="btn ghost" type="button" data-sortir>${t('Se déconnecter', 'Sign out')}</button></div>`);
    root.querySelector('[data-sortir]').onclick = async () => {
      await api('/api/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      location.reload();
    };
  };

  const refus = j => {
    const c = j.claims
      ? `<p class="muted">${t('Ce que Google a renvoyé pour ce compte (test de configuration) :', 'What Google returned for this account (configuration test):')}</p>
         <pre>${esc(JSON.stringify(j.claims, null, 2))}</pre>` : '';
    etat(`<p>${t('Connexion refusée : ', 'Sign-in refused: ')}${esc(j.error || '')}.
      ${t('Utilisez votre adresse institutionnelle se terminant par @facsciences-uy1.cm.', 'Use your institutional address ending in @facsciences-uy1.cm.')}</p>${c}`);
  };

  const demarrer = async () => {
    const me = await api('/api/me');
    if (me.ok) return montrerSession(await me.json());

    const cfg = await (await api('/api/config')).json();
    if (!cfg.clientId) return etat(t('Connexion non configurée sur ce serveur.', 'Sign-in is not configured on this server.'), 'muted');
    await new Promise((ok, ko) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.onload = ok; s.onerror = ko;
      document.head.appendChild(s);
    });
    window.google.accounts.id.initialize({
      client_id: cfg.clientId, auto_select: false,
      callback: async r => {
        etat(t('Vérification…', 'Checking…'), 'muted');
        const rep = await api('/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential: r.credential }) });
        const j = await rep.json().catch(() => ({}));
        rep.ok ? montrerSession(j) : refus(j);
      }
    });
    window.google.accounts.id.renderButton(root.querySelector('[data-bouton]'),
      { theme: 'outline', size: 'large', text: 'signin_with', locale: EN ? 'en' : 'fr' });
    etat('', 'muted');
  };

  demarrer().catch(() => etat(t('Impossible de joindre le service de connexion. Vérifiez votre connexion internet.',
    'Cannot reach the sign-in service. Check your internet connection.'), 'muted'));
})();

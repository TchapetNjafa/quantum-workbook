/* Profil de l'étudiant (Vercel seulement) : matricule OBLIGATOIRE, visibilité au classement, historique, effacement.
   Le nom et l'adresse viennent de la connexion Google institutionnelle ; seul le matricule est à saisir, une fois.
   Données conservées 5 mois après la dernière activité, puis supprimées ; effaçables à tout moment. */
(() => {
  'use strict';
  const EN = (document.documentElement.lang || 'fr').startsWith('en');
  const t = (fr, en) => (EN ? en : fr);
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const api = (path, opt) => fetch(path, { credentials: 'same-origin', ...opt });
  const post = (path, body) => api(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const hors = /\.github\.io$/.test(location.hostname) || location.protocol === 'file:';

  const Profil = {
    async lire() { try { const r = await api('/api/profil'); return r.ok ? await r.json() : null; } catch { return null; } },
    /** Formulaire du matricule, réutilisé par les pages de devoirs et le classement. */
    formulaire(zone, surSucces) {
      zone.innerHTML = `<form data-matricule class="prof-ligne">
        <p>${t('Pour déposer un devoir, figurer au classement ou jouer un défi, enregistrez votre <b>matricule</b>. C’est obligatoire et ne se fait qu’une fois ; votre nom et votre adresse viennent déjà de votre connexion.',
          'To submit an assignment, appear in the leaderboard or play a challenge, register your <b>student number (matricule)</b>. It is required and done only once; your name and address already come from your sign-in.')}</p>
        <label>${t('Matricule', 'Student number')} <input type="text" name="m" required minlength="4" maxlength="15" autocomplete="off" pattern="[A-Za-z0-9 ]{4,15}" size="16"></label>
        <label><input type="checkbox" name="v" checked> ${t('Afficher mon matricule dans le classement', 'Show my student number in the leaderboard')}</label>
        <button class="btn accent" type="submit">${t('Enregistrer', 'Save')}</button></form>
        <p class="muted">${t('Données conservées 5 mois après votre dernière activité, puis supprimées. Vous pouvez tout effacer à tout moment depuis la page Profil.', 'Data kept for 5 months after your last activity, then deleted. You can erase everything at any time from the Profile page.')}</p>
        <div data-msg-mat role="status" aria-live="polite"></div>`;
      // Liste de classe de l'enseignant : le matricule lié à cette adresse est proposé d'avance.
      const champ = zone.querySelector('[name=m]');
      Profil.lire().then(p => { if (p && p.matricule_propose && !champ.value) champ.value = p.matricule_propose; });
      zone.querySelector('[data-matricule]').onsubmit = async e => {
        e.preventDefault();
        const rep = await post('/api/profil', { matricule: e.target.m.value, visible: e.target.v.checked });
        const j = await rep.json().catch(() => ({}));
        if (rep.ok) return surSucces && surSucces(j);
        if (j.matricule_propose) champ.value = j.matricule_propose;
        zone.querySelector('[data-msg-mat]').innerHTML = `<p class="prof-erreurs">${esc(j.error || rep.status)}</p>`;
      };
    }
  };
  window.phy321Profil = Profil;

  // ---------- page Profil ----------
  const root = document.getElementById('profil');
  if (!root) return;
  const montrer = h => { root.innerHTML = h; };
  const quand = iso => new Date(iso).toLocaleString(EN ? 'en-GB' : 'fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
  if (hors) { montrer(`<p class="muted">${t('Le profil n’existe que sur le site hébergé sur Vercel.', 'The profile only exists on the Vercel-hosted site.')}</p>`); return; }

  async function afficher() {
    const me = await api('/api/me');
    if (me.status === 401) return montrer(`<p>${t('Connectez-vous avec votre compte universitaire.', 'Sign in with your university account.')}</p><p><a class="btn accent" href="${EN ? '/en/login.html' : '/connexion.html'}">${t('Se connecter', 'Sign in')}</a></p>`);
    const compte = await me.json();
    const p = await Profil.lire();
    if (!p) return montrer(`<p class="muted">${t('Impossible de joindre le serveur.', 'Cannot reach the server.')}</p>`);
    if (p.matricule === null) {
      montrer(`<p>${t('Compte', 'Account')} : <b>${esc(compte.name)}</b> <span class="muted">${esc(compte.email)}</span></p><div id="zone-mat"></div>`);
      return Profil.formulaire(root.querySelector('#zone-mat'), afficher);
    }
    const h = await api('/api/historique').then(r => (r.ok ? r.json() : { dernieres: [], par_chapitre: [] })).catch(() => ({ dernieres: [], par_chapitre: [] }));
    const pct = (a, b) => (b ? Math.round(100 * a / b) + ' %' : '—');
    montrer(`<p>${t('Compte', 'Account')} : <b>${esc(compte.name)}</b> <span class="muted">${esc(compte.email)}</span><br>${t('Matricule', 'Student number')} : <b>${esc(p.matricule)}</b></p>
      <label><input type="checkbox" data-visible ${p.visible ? 'checked' : ''}> ${t('Afficher mon matricule dans le classement', 'Show my student number in the leaderboard')}</label>
      <p class="muted">${t('Une erreur de matricule ? Demandez à l’enseignant de le réinitialiser.', 'Wrong student number? Ask the teacher to reset it.')}
        ${t(`Vos données (profil, scores, défis) sont conservées ${Math.round(p.conservation_jours / 30)} mois après votre dernière activité, puis supprimées automatiquement.`, `Your data (profile, scores, challenges) is kept for ${Math.round(p.conservation_jours / 30)} months after your last activity, then deleted automatically.`)}</p>
      <h2>${t('Progression au quiz', 'Quiz progress')}</h2>
      ${h.par_chapitre.length ? `<table class="plain-table"><thead><tr><th>${t('Chapitre', 'Chapter')}</th><th>${t('Séries', 'Sets')}</th><th>${t('Réussite', 'Success')}</th></tr></thead><tbody>
        ${h.par_chapitre.map(c => `<tr><td>${c.chapitre ?? t('Tous', 'All')}</td><td>${c.series}</td><td>${pct(c.ok, c.n)}</td></tr>`).join('')}</tbody></table>` : `<p class="muted">${t('Aucune série envoyée pour le moment : elles s’enregistrent quand vous terminez un quiz en étant connecté.', 'No set sent yet: they are recorded when you finish a quiz while signed in.')}</p>`}
      ${h.dernieres.length ? `<details><summary>${t('Dernières séries', 'Latest sets')}</summary><ul>${h.dernieres.map(s => `<li>${esc(quand(s.quand))} — ${t('chapitre', 'chapter')} ${s.chapitre ?? '—'}${s.exam ? t(' (examen)', ' (exam)') : ''} : ${s.ok} / ${s.n}</li>`).join('')}</ul></details>` : ''}
      <h2>${t('Effacer mes données', 'Erase my data')}</h2>
      <p class="muted">${t('Supprime votre profil, vos scores et vos défis. Les devoirs déjà remis et leurs notes restent chez l’enseignant jusqu’à 5 mois après la fermeture du devoir. Vous devrez enregistrer un matricule pour utiliser de nouveau le classement et les devoirs.', 'Deletes your profile, scores and challenges. Assignments already submitted and their marks stay with the teacher until 5 months after the assignment closes. You will need to register a student number again to use the leaderboard and assignments.')}</p>
      <button class="btn small ghost" type="button" data-effacer>${t('Effacer mes données', 'Erase my data')}</button><div data-msg-eff role="status" aria-live="polite"></div>`);
    root.querySelector('[data-visible]').onchange = async e => { await post('/api/profil', { visible: e.target.checked }); };
    root.querySelector('[data-effacer]').onclick = async () => {
      const c = prompt(t('Action définitive. Tapez SUPPRIMER pour effacer votre profil, vos scores et vos défis.', 'This cannot be undone. Type SUPPRIMER to erase your profile, scores and challenges.'));
      if (c === null) return;
      const rep = await post('/api/profil/supprimer', { confirmation: c });
      if (rep.ok) return afficher();
      root.querySelector('[data-msg-eff]').textContent = (await rep.json().catch(() => ({}))).error || rep.status;
    };
  }
  afficher().catch(() => montrer(`<p class="muted">${t('Impossible de joindre le serveur.', 'Cannot reach the server.')}</p>`));
})();

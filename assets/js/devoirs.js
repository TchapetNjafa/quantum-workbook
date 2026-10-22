/* Devoirs PHY321 (Vercel seulement) : liste, passage d'un devoir, remise, remise hors connexion.
   L'heure de remise est celle du serveur ; l'heure de l'appareil n'est qu'indicative. Aucune bibliothèque. */
(() => {
  'use strict';
  const EN = (document.documentElement.lang || 'fr').startsWith('en');
  const t = (fr, en) => (EN ? en : fr);
  const root = document.getElementById('devoirs');
  if (!root) return;

  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const quand = iso => new Date(iso).toLocaleString(EN ? 'en-GB' : 'fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
  const api = (path, opt) => fetch(path, { credentials: 'same-origin', ...opt });
  const post = (path, body) => api(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const montrer = html => { root.innerHTML = html; if (window.MathJax && MathJax.typesetPromise) MathJax.typesetPromise([root]).catch(() => {}); };
  const File = () => window.phy321File || { liste: () => [], ajouter() {}, retirer() {}, flush: async () => {} };
  // Copie locale (lecture hors connexion) : titres, dates et énoncés, jamais de réponses ni de notes.
  const memo = {
    lire(cle) { try { return JSON.parse(localStorage.getItem(cle)); } catch { return null; } },
    ecrire(cle, v) { try { localStorage.setItem(cle, JSON.stringify(v)); } catch { /* stockage bloqué */ } }
  };
  let vue = 'liste';

  if (/\.github\.io$/.test(location.hostname) || location.protocol === 'file:') {
    montrer(`<p class="muted">${t('Les devoirs n’existent que sur le site hébergé sur Vercel.', 'Assignments only exist on the Vercel-hosted site.')}</p>`);
    return;
  }

  const ETAT = {
    a_venir: t('à venir', 'upcoming'), ouvert: t('ouvert', 'open'),
    retard: t('fermé, remise tardive acceptée', 'closed, late submission accepted'), clos: t('clos', 'closed')
  };
  const reseau = t('Pas de connexion : ce que vous voyez vient de votre appareil.', 'No connection: what you see comes from your device.');

  function enAttente() {
    const l = File().liste();
    if (!l.length) return '';
    return `<div class="devoir-card" data-etat="attente"><h3>${t('Remises sur cet appareil', 'Submissions on this device')}</h3>` + l.map(x => x.etat === 'refusee'
      ? `<p><b>${esc(x.titre)}</b> — ${t('refusée par le serveur : ', 'refused by the server: ')}${esc(x.raison)}. <button class="btn small ghost" type="button" data-retirer="${esc(x.id)}">${t('Retirer', 'Remove')}</button></p>`
      : `<p><b>${esc(x.titre)}</b> — ${t('en attente d’envoi (préparée le ', 'waiting to be sent (prepared on ')}${esc(quand(x.declared_at))}${t(' sur cet appareil). Elle doit parvenir au serveur avant ', ' on this device). It must reach the server before ')}<b>${esc(quand(x.limite))}</b>${t(', sinon elle sera refusée.', ', otherwise it will be refused.')}</p>`
    ).join('') + `<p><button class="btn small accent" type="button" data-envoyer-file>${t('Envoyer maintenant', 'Send now')}</button></p></div>`;
  }

  function afficherListe(devoirs, horsLigne) {
    vue = 'liste';
    const corps = devoirs.length ? devoirs.map(d => {
      const peut = d.etat === 'ouvert' || d.etat === 'retard';
      const rendu = d.rendu ? `<p>${t('Remise enregistrée le ', 'Submission recorded on ')}<b>${esc(quand(d.recu))}</b> ${t('(heure du serveur)', '(server time)')}${d.retard ? t(' — en retard', ' — late') : ''}.
        ${d.note !== undefined && d.total > 0 ? t(`Note automatique : <b>${d.note} / ${d.total}</b>.`, `Automatic mark: <b>${d.note} / ${d.total}</b>.`) : ''}
        ${d.manuel && d.note !== undefined ? (d.note_manuelle === null ? t('Correction manuelle en cours.', 'Manual marking in progress.') : t(`Correction manuelle : <b>${d.note_manuelle} / ${d.total_manuel}</b>.`, `Manual marking: <b>${d.note_manuelle} / ${d.total_manuel}</b>.`)) : ''}</p>` : '';
      return `<article class="devoir-card" data-etat="${esc(d.etat)}">
        <h3>${esc(d.titre)}</h3>
        <p class="muted">${esc(ETAT[d.etat])} · ${t('ouvre le ', 'opens ')}${esc(quand(d.ouvre))} · ${t('ferme le ', 'closes ')}${esc(quand(d.ferme))}${peut ? t(' · dernier délai ', ' · final deadline ') + esc(quand(d.limite)) : ''}</p>
        ${rendu}
        ${peut ? `<button class="btn ${d.rendu ? 'ghost' : 'accent'}" type="button" data-ouvrir="${d.id}">${d.rendu ? t('Modifier ma remise', 'Edit my submission') : t('Commencer', 'Start')}</button>` : ''}
      </article>`;
    }).join('') : `<p class="muted">${t('Aucun devoir publié pour le moment.', 'No assignment published yet.')}</p>`;
    montrer((horsLigne ? `<p class="muted" role="status">${reseau}</p>` : '') + enAttente() + corps);
    root.querySelectorAll('[data-ouvrir]').forEach(b => { b.onclick = () => ouvrir(b.dataset.ouvrir).catch(erreur); });
    root.querySelectorAll('[data-retirer]').forEach(b => { b.onclick = () => File().retirer(b.dataset.retirer); });
    const e = root.querySelector('[data-envoyer-file]'); if (e) e.onclick = () => File().flush();
  }

  async function liste() {
    let r;
    try { r = await api('/api/devoirs'); }
    catch { const c = memo.lire('phy321.devoirs.cache.v1'); return c ? afficherListe(c.devoirs, true) : erreur(); }
    if (r.status === 401) {
      vue = 'connexion';
      return montrer(`<p>${t('Connectez-vous avec votre compte universitaire pour voir les devoirs.', 'Sign in with your university account to see the assignments.')}</p>
        <p><a class="btn accent" href="${EN ? '/en/login.html' : '/connexion.html'}">${t('Se connecter', 'Sign in')}</a></p>`);
    }
    if (!r.ok) throw new Error('liste');
    const { devoirs } = await r.json();
    memo.ecrire('phy321.devoirs.cache.v1', { devoirs: devoirs.map(({ note, total, manuel, ...d }) => d) });
    afficherListe(devoirs, false);
  }

  function champ(q) {
    const n = `r-${q.id}`;
    if (q.type === 'qcm') return q.options.map((o, i) => `<label class="choice"><input type="radio" name="${n}" value="${i}"> <span>${esc(o)}</span></label>`).join('');
    if (q.type === 'vrai_faux') return ['true', 'false'].map(v => `<label class="choice"><input type="radio" name="${n}" value="${v}"> <span>${v === 'true' ? t('Vrai', 'True') : t('Faux', 'False')}</span></label>`).join('');
    if (q.type === 'numerical') return `<input type="text" inputmode="decimal" name="${n}" autocomplete="off" size="12"> ${esc(q.unit || '')}`;
    return `<textarea name="${n}" rows="5" maxlength="4000" style="width:100%"></textarea>`;
  }

  const estRadio = els => els && els.length !== undefined && els[0] && els[0].type === 'radio';

  async function ouvrir(id) {
    let r, d, horsLigne = false;
    try { r = await api(`/api/devoirs/${id}`); }
    catch { d = memo.lire(`phy321.devoir.${id}`); horsLigne = true; if (!d) return erreur(); }
    if (r) {
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        montrer(`<p>${esc(j.error || t('Devoir indisponible.', 'Assignment unavailable.'))}</p><p><button class="btn ghost" type="button" data-retour>${t('Retour', 'Back')}</button></p>`);
        root.querySelector('[data-retour]').onclick = () => liste().catch(erreur);
        return;
      }
      d = await r.json();
      memo.ecrire(`phy321.devoir.${id}`, { ...d, reponses: {} }); // énoncés seulement : permet de répondre si le réseau coupe
    }
    vue = 'devoir';
    montrer(`${horsLigne ? `<p class="muted" role="status">${reseau}</p>` : ''}<h3>${esc(d.titre)}</h3>
      <p class="muted">${t('Fermeture : ', 'Closes: ')}${esc(quand(d.ferme))}. ${t('Une remise reçue après cette heure et avant ', 'A submission received after that time and before ')}${esc(quand(d.limite))}${t(' est acceptée mais marquée en retard.', ' is accepted but marked late.')}
        ${t('L’heure retenue est celle du serveur, pas celle de votre appareil. Sans connexion, la remise est gardée sur votre appareil et envoyée au retour du réseau : elle doit parvenir au serveur avant l’heure limite.', 'The time recorded is the server’s, not your device’s. Without a connection, your submission is kept on your device and sent when the network returns: it must reach the server before the final deadline.')}</p>
      ${d.sujet && !horsLigne ? `<p><a class="btn small ghost" href="/api/devoirs/${d.id}/sujet">${t('Télécharger le sujet (PDF à remplir)', 'Download the assignment (PDF to fill in)')}</a></p>` : ''}
      <form id="dev-form">${d.questions.map((q, i) => `<fieldset class="diag-q"><legend>${i + 1}. ${esc(q.question)}${q.points > 1 ? ` <span class="muted">(${q.points} pts)</span>` : ''}</legend>${champ(q)}</fieldset>`).join('')}</form>
      <div class="btn-row"><button class="btn accent" type="button" data-envoyer>${t('Remettre', 'Submit')}</button><button class="btn ghost" type="button" data-retour>${t('Retour', 'Back')}</button></div>
      <div id="dev-msg" role="status" aria-live="polite"></div>
      ${d.copie ? `<fieldset class="diag-q"><legend>${t('Copie à déposer (PDF ou photo, 2 Mo maximum)', 'Paper to upload (PDF or photo, 2 MB maximum)')}</legend>
        <input type="file" id="dev-fichier" accept="application/pdf,image/jpeg,image/png" aria-label="${t('Choisir un fichier', 'Choose a file')}">
        <p class="muted" id="dev-fichier-etat" role="status" aria-live="polite"></p>
        <button class="btn small accent" type="button" data-envoyer-fichier>${t('Envoyer la copie', 'Send the paper')}</button></fieldset>` : ''}`);
    if (!d.questions.length) { // devoir « copie seule » : pas de questions, le dépôt de la copie est la remise
      const f0 = root.querySelector('#dev-form'); f0.hidden = true; root.querySelector('[data-envoyer]').hidden = true;
      f0.insertAdjacentHTML('beforebegin', `<p>${d.sujet ? t('Téléchargez le sujet, composez sur papier ou dans le PDF, puis déposez votre copie ci-dessous (PDF ou photo).', 'Download the assignment, work it out on paper or in the PDF, then upload your paper below (PDF or photo).') : t('Composez sur papier ou en PDF, puis déposez votre copie ci-dessous (PDF ou photo).', 'Work it out on paper or in a PDF, then upload your paper below (PDF or photo).')}</p>`);
    }
    if (d.copie) copie(d, horsLigne);
    const form = root.querySelector('#dev-form');
    for (const q of d.questions) {
      const prev = d.reponses[q.id]; if (prev === undefined || prev === null) continue;
      const els = form.elements[`r-${q.id}`];
      if (estRadio(els)) [...els].forEach(e => { e.checked = e.value === String(prev); });
      else if (els) els.value = prev;
    }
    root.querySelector('[data-retour]').onclick = () => liste().catch(erreur);
    root.querySelector('[data-envoyer]').onclick = async () => {
      const reponses = {};
      for (const q of d.questions) {
        const els = form.elements[`r-${q.id}`];
        const v = estRadio(els) ? ([...els].find(e => e.checked) || {}).value : els.value;
        if (v !== undefined && v !== '') reponses[q.id] = q.type === 'vrai_faux' ? v === 'true' : v;
      }
      const msg = root.querySelector('#dev-msg'); msg.textContent = t('Envoi…', 'Sending…');
      let rep;
      try { rep = await post(`/api/devoirs/${d.id}/remise`, { reponses, declared_at: new Date().toISOString() }); }
      catch {
        File().ajouter({ devoir: d.id, titre: d.titre, limite: d.limite, reponses });
        msg.innerHTML = `<p><b>${t('Pas de connexion.', 'No connection.')}</b> ${t('Votre remise est enregistrée sur cet appareil et sera envoyée dès que le réseau reviendra. Gardez cette page ou rouvrez le site avec du réseau avant ', 'Your submission is saved on this device and will be sent as soon as the network returns. Keep this page or reopen the site with a connection before ')}<b>${esc(quand(d.limite))}</b>${t(' : après cette heure, elle sera refusée.', ': after that time it will be refused.')}</p>`;
        return;
      }
      const j = await rep.json().catch(() => ({}));
      msg.innerHTML = rep.ok
        ? `<p><b>${t('Remise enregistrée', 'Submission recorded')}</b> ${t('le ', 'on ')}${esc(quand(j.recu))} ${t('(heure du serveur)', '(server time)')}${j.retard ? t(' — marquée en retard.', ' — marked late.') : '.'}
           ${t(' Les résultats seront publiés par l’enseignant.', ' Results will be released by the teacher.')}</p>`
        : `<p>${t('Remise refusée : ', 'Submission refused: ')}${esc(j.error || rep.status)}</p>`;
    };
  }

  /* ---------- copie déposée : PDF ou photo, 2 Mo maximum (contrôlé aussi par le serveur) ---------- */
  const MAX = 2 * 1024 * 1024;
  const OK = ['application/pdf', 'image/jpeg', 'image/png'];
  const taille = n => (n >= 1048576 ? (n / 1048576).toFixed(1) + ' Mo' : Math.max(1, Math.round(n / 1024)) + ' Ko').replace('Mo', t('Mo', 'MB')).replace('Ko', t('Ko', 'KB'));

  // Une photo trop lourde est réduite côté navigateur (JPEG, 1800 px au plus) ; un PDF trop lourd est refusé.
  async function reduire(f) {
    if (!f.type.startsWith('image/') || typeof createImageBitmap !== 'function') return null;
    const img = await createImageBitmap(f);
    for (const cote of [1800, 1400, 1000]) {
      const k = Math.min(1, cote / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      for (const qual of [0.85, 0.7, 0.55]) {
        const b = await new Promise(ok => c.toBlob(ok, 'image/jpeg', qual));
        if (b && b.size <= MAX) return b;
      }
    }
    return null;
  }

  async function copie(d, horsLigne) {
    const etat = root.querySelector('#dev-fichier-etat'), choix = root.querySelector('#dev-fichier');
    if (!horsLigne) {
      api(`/api/devoirs/${d.id}/copie`).then(r => (r.ok ? r.json() : null)).then(j => {
        if (j && j.fichier) etat.textContent = t(`Copie déjà envoyée le ${quand(j.fichier.recu)} (${taille(j.fichier.taille)}, heure du serveur)${j.fichier.retard ? ' — en retard' : ''}. Un nouvel envoi la remplace.`,
          `Paper already sent on ${quand(j.fichier.recu)} (${taille(j.fichier.taille)}, server time)${j.fichier.retard ? ' — late' : ''}. A new upload replaces it.`);
      }).catch(() => {});
    }
    root.querySelector('[data-envoyer-fichier]').onclick = async () => {
      let f = choix.files[0];
      if (!f) { etat.textContent = t('Choisissez d’abord un fichier.', 'Choose a file first.'); return; }
      if (!OK.includes(f.type)) { etat.textContent = t('Format non accepté : PDF, JPEG ou PNG.', 'Format not accepted: PDF, JPEG or PNG.'); return; }
      if (f.size > MAX) {
        etat.textContent = t('Photo trop lourde, réduction en cours…', 'Photo too large, reducing…');
        const r = await reduire(f);
        if (!r) { etat.textContent = t('Fichier de plus de 2 Mo : réduisez-le (PDF) ou reprenez une photo moins lourde.', 'File larger than 2 MB: shrink it (PDF) or take a lighter photo.'); return; }
        f = r;
      }
      etat.textContent = t('Envoi…', 'Sending…');
      let rep;
      try { rep = await api(`/api/devoirs/${d.id}/copie`, { method: 'POST', headers: { 'Content-Type': f.type }, body: f }); }
      catch { etat.textContent = t('Pas de connexion : le dépôt d’une copie demande du réseau. Réessayez avant ', 'No connection: uploading a paper needs a network. Try again before ') + quand(d.limite) + '.'; return; }
      const j = await rep.json().catch(() => ({}));
      etat.textContent = rep.ok
        ? t(`Copie enregistrée le ${quand(j.recu)} (${taille(j.taille)}, heure du serveur)${j.retard ? ' — marquée en retard' : ''}.`, `Paper recorded on ${quand(j.recu)} (${taille(j.taille)}, server time)${j.retard ? ' — marked late' : ''}.`)
        : t('Dépôt refusé : ', 'Upload refused: ') + (j.error || rep.status);
    };
  }

  const erreur = () => montrer(`<p class="muted">${t('Impossible de joindre le serveur. Vérifiez votre connexion internet puis réessayez.', 'Cannot reach the server. Check your internet connection and try again.')}</p>`);
  // quand la file change (envoi réussi, refus), la liste se met à jour ; une saisie en cours n'est jamais écrasée
  addEventListener('phy321:file', () => { if (vue === 'liste') liste().catch(erreur); });
  liste().catch(erreur);
})();

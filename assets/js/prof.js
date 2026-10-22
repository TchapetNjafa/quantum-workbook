/* Page enseignant PHY321 (Vercel seulement) : verrou, liste des devoirs, création, publication, remises.
   Le serveur contrôle tout (compte Google de l'enseignant + mot de passe) ; ce script n'est qu'une interface. */
(() => {
  'use strict';
  const EN = (document.documentElement.lang || 'fr').startsWith('en');
  const t = (fr, en) => (EN ? en : fr);
  const root = document.getElementById('prof');
  if (!root) return;

  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const quand = iso => (iso ? new Date(iso).toLocaleString(EN ? 'en-GB' : 'fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
  const api = (path, opt) => fetch(path, { credentials: 'same-origin', ...opt });
  const post = (path, body) => api(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const montrer = html => { root.innerHTML = html; };
  const local = iso => { const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

  if (/\.github\.io$/.test(location.hostname) || location.protocol === 'file:') {
    montrer(`<p class="muted">${t('Cette page n’existe que sur le site hébergé sur Vercel.', 'This page only exists on the Vercel-hosted site.')}</p>`);
    return;
  }

  const EXEMPLE = {
    titre: t('Devoir 1 : états quantiques', 'Assignment 1: quantum states'),
    ouvre: new Date(Date.now() + 3600e3).toISOString(), ferme: new Date(Date.now() + 7 * 864e5).toISOString(),
    publie: false, resultat_visible: false,
    questions: [
      { type: 'qcm', question: t('Quelle est la probabilité de mesurer |0⟩ pour |ψ⟩ = (|0⟩ + |1⟩)/√2 ?', 'What is the probability of measuring |0⟩ for |ψ⟩ = (|0⟩ + |1⟩)/√2?'), options: ['1', '1/2', '1/4'], correct_answer: 1, points: 1 },
      { type: 'vrai_faux', question: t('Deux états proportionnels représentent le même état physique.', 'Two proportional states represent the same physical state.'), correct_answer: true },
      { type: 'numerical', question: t('Pour |ψ⟩ = 0,6|0⟩ + 0,8|1⟩, donnez P(|1⟩) en %.', 'For |ψ⟩ = 0.6|0⟩ + 0.8|1⟩, give P(|1⟩) in %.'), correct_answer: 64, tolerance: 0.5, unit: '%' }
    ]
  };

  async function verrou() {
    montrer(`<p>${t('Saisissez le mot de passe enseignant.', 'Enter the teacher password.')}</p>
      <form class="prof-ligne" data-verrou><input type="password" name="pw" autocomplete="current-password" required aria-label="${t('Mot de passe', 'Password')}">
      <button class="btn accent" type="submit">${t('Déverrouiller', 'Unlock')}</button></form><div data-msg role="status" aria-live="polite"></div>`);
    root.querySelector('[data-verrou]').onsubmit = async e => {
      e.preventDefault();
      const r = await post('/api/prof/login', { password: e.target.pw.value });
      if (r.ok) return tableau().catch(erreur);
      root.querySelector('[data-msg]').textContent = (await r.json().catch(() => ({}))).error || r.status;
    };
  }

  async function tableau() {
    const r = await api('/api/prof/devoirs');
    if (r.status === 401) return verrou();
    if (!r.ok) throw new Error('prof');
    const { devoirs } = await r.json();
    montrer(`<h2>${t('Devoirs', 'Assignments')}</h2>
      ${devoirs.length ? `<div class="tableau"><table class="plain-table"><thead><tr><th>${t('Titre', 'Title')}</th><th>${t('Ouvre', 'Opens')}</th><th>${t('Ferme', 'Closes')}</th><th>${t('Publié', 'Published')}</th><th>${t('Résultats visibles', 'Results visible')}</th><th>${t('Remises', 'Submissions')}</th><th></th></tr></thead><tbody>
      ${devoirs.map(d => `<tr data-id="${d.id}"><td>${esc(d.titre)} <span class="muted">(${d.nb_questions} q.)</span></td><td>${esc(quand(d.ouvre))}</td><td>${esc(quand(d.ferme))}</td>
        <td>${d.publie ? t('oui', 'yes') : t('non', 'no')}</td><td>${d.resultat_visible ? t('oui', 'yes') : t('non', 'no')}</td><td>${d.nb_remises}</td>
        <td><div class="prof-ligne"><button class="btn small ${d.publie ? 'ghost' : 'accent'}" type="button" data-act="publie">${d.publie ? t('Dépublier', 'Unpublish') : t('Publier', 'Publish')}</button>
        <button class="btn small ghost" type="button" data-act="visible">${d.resultat_visible ? t('Masquer les résultats', 'Hide results') : t('Montrer les résultats', 'Show results')}</button>
        <button class="btn small ghost" type="button" data-act="remises">${t('Remises', 'Submissions')}</button>
        <button class="btn small ghost" type="button" data-act="dates">${t('Dates', 'Dates')}</button></div></td></tr>`).join('')}
      </tbody></table></div>` : `<p class="muted">${t('Aucun devoir.', 'No assignment.')}</p>`}
      <div data-detail></div>
      <h2>${t('Nouveau devoir', 'New assignment')}</h2>
      <p class="muted">${t('Collez le devoir au format JSON. Types corrigés automatiquement : qcm, vrai_faux, numerical (tolérance absolue) ; interpretation : correction manuelle. Les réponses ne sont jamais envoyées aux étudiants.',
        'Paste the assignment as JSON. Automatically marked types: qcm, vrai_faux, numerical (absolute tolerance); interpretation: manual marking. Answers are never sent to students.')}</p>
      <textarea data-json rows="14" spellcheck="false"></textarea>
      <div class="btn-row"><button class="btn accent" type="button" data-creer>${t('Créer le devoir', 'Create assignment')}</button>
      <button class="btn ghost" type="button" data-exemple>${t('Insérer un exemple', 'Insert an example')}</button></div>
      <div data-msg role="status" aria-live="polite"></div>`);

    root.querySelector('[data-exemple]').onclick = () => { root.querySelector('[data-json]').value = JSON.stringify(EXEMPLE, null, 2); };
    root.querySelector('[data-creer]').onclick = async () => {
      const msg = root.querySelector('[data-msg]'); let corps;
      try { corps = JSON.parse(root.querySelector('[data-json]').value); } catch { msg.innerHTML = `<p class="prof-erreurs">${t('JSON invalide.', 'Invalid JSON.')}</p>`; return; }
      const rep = await post('/api/prof/devoirs', corps); const j = await rep.json().catch(() => ({}));
      if (rep.status === 401) return verrou();
      if (rep.ok) return tableau().catch(erreur);
      msg.innerHTML = `<p class="prof-erreurs">${esc(j.error || rep.status)}</p>${(j.erreurs || []).length ? `<ul>${j.erreurs.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}`;
    };
    root.querySelectorAll('[data-act]').forEach(b => { b.onclick = () => agir(b.closest('tr').dataset.id, b.dataset.act, devoirs.find(d => String(d.id) === b.closest('tr').dataset.id)).catch(erreur); });
  }

  async function agir(id, act, d) {
    const detail = root.querySelector('[data-detail]');
    if (act === 'publie' || act === 'visible') {
      await post(`/api/prof/devoirs/${id}`, act === 'publie' ? { publie: !d.publie } : { resultat_visible: !d.resultat_visible });
      return tableau();
    }
    if (act === 'dates') {
      detail.innerHTML = `<h3>${esc(d.titre)}</h3><div class="prof-ligne"><label>${t('Ouvre', 'Opens')} <input type="datetime-local" name="o" value="${local(d.ouvre)}"></label>
        <label>${t('Ferme', 'Closes')} <input type="datetime-local" name="f" value="${local(d.ferme)}"></label><button class="btn small accent" type="button" data-ok>${t('Enregistrer', 'Save')}</button></div><div data-msg2></div>`;
      detail.querySelector('[data-ok]').onclick = async () => {
        const rep = await post(`/api/prof/devoirs/${id}`, { ouvre: new Date(detail.querySelector('[name=o]').value).toISOString(), ferme: new Date(detail.querySelector('[name=f]').value).toISOString() });
        if (rep.ok) return tableau(); detail.querySelector('[data-msg2]').textContent = (await rep.json().catch(() => ({}))).error || rep.status;
      };
      return;
    }
    const r = await api(`/api/prof/devoirs/${id}/remises`);
    if (r.status === 401) return verrou();
    const { remises } = await r.json();
    detail.innerHTML = `<h3>${esc(d.titre)} — ${t('remises', 'submissions')}</h3>` + (remises.length
      ? `<div class="tableau"><table class="plain-table"><thead><tr><th>${t('Étudiant', 'Student')}</th><th>${t('Note auto', 'Auto mark')}</th><th>${t('Reçue (serveur)', 'Received (server)')}</th><th>${t('Ouverte (serveur)', 'Opened (server)')}</th><th>${t('Déclarée (appareil, non vérifiable)', 'Declared (device, unverifiable)')}</th><th>${t('Retard', 'Late')}</th></tr></thead><tbody>
        ${remises.map(x => `<tr><td>${esc(x.nom)} <span class="muted">${esc(x.email)}</span></td><td>${x.note} / ${x.total}${x.manuel ? t(' + manuel', ' + manual') : ''}</td><td>${esc(quand(x.recu))}</td><td>${esc(quand(x.debut))}</td><td>${esc(quand(x.declare))}${x.hors_ligne ? t(' <span class="muted">(préparée hors connexion)</span>', ' <span class="muted">(prepared offline)</span>') : ''}</td><td>${x.retard ? t('oui', 'yes') : t('non', 'no')}</td></tr>`).join('')}</tbody></table></div>`
      : `<p class="muted">${t('Aucune remise.', 'No submission.')}</p>`);
  }

  const erreur = () => montrer(`<p class="muted">${t('Impossible de joindre le serveur. Vérifiez votre connexion internet puis réessayez.', 'Cannot reach the server. Check your internet connection and try again.')}</p>`);

  (async () => {
    const me = await api('/api/me');
    if (me.status === 401) return montrer(`<p>${t('Connectez-vous avec votre compte enseignant.', 'Sign in with your teacher account.')}</p><p><a class="btn accent" href="${EN ? '/en/login.html' : '/connexion.html'}">${t('Se connecter', 'Sign in')}</a></p>`);
    const j = await me.json();
    if (!j.teacher) return montrer(`<p>${t('Cette page est réservée à l’enseignant.', 'This page is reserved for the teacher.')}</p>`);
    return j.verrou ? verrou() : tableau();
  })().catch(erreur);
})();

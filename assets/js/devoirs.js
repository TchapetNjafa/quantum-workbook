/* Devoirs PHY321 (Vercel seulement) : liste, passage d'un devoir, remise.
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

  if (/\.github\.io$/.test(location.hostname) || location.protocol === 'file:') {
    montrer(`<p class="muted">${t('Les devoirs n’existent que sur le site hébergé sur Vercel.', 'Assignments only exist on the Vercel-hosted site.')}</p>`);
    return;
  }

  const ETAT = {
    a_venir: t('à venir', 'upcoming'), ouvert: t('ouvert', 'open'),
    retard: t('fermé, remise tardive acceptée', 'closed, late submission accepted'), clos: t('clos', 'closed')
  };

  async function liste() {
    const r = await api('/api/devoirs');
    if (r.status === 401) {
      return montrer(`<p>${t('Connectez-vous avec votre compte universitaire pour voir les devoirs.', 'Sign in with your university account to see the assignments.')}</p>
        <p><a class="btn accent" href="${EN ? '/en/login.html' : '/connexion.html'}">${t('Se connecter', 'Sign in')}</a></p>`);
    }
    if (!r.ok) throw new Error('liste');
    const { devoirs } = await r.json();
    if (!devoirs.length) return montrer(`<p class="muted">${t('Aucun devoir publié pour le moment.', 'No assignment published yet.')}</p>`);
    montrer(devoirs.map(d => {
      const peut = d.etat === 'ouvert' || d.etat === 'retard';
      const rendu = d.rendu ? `<p>${t('Remise enregistrée le ', 'Submission recorded on ')}<b>${esc(quand(d.recu))}</b> ${t('(heure du serveur)', '(server time)')}${d.retard ? t(' — en retard', ' — late') : ''}.
        ${d.note !== undefined ? t(`Note automatique : <b>${d.note} / ${d.total}</b>${d.manuel ? ' (hors questions à correction manuelle)' : ''}.`, `Automatic mark: <b>${d.note} / ${d.total}</b>${d.manuel ? ' (excluding manually marked questions)' : ''}.`) : ''}</p>` : '';
      return `<article class="devoir-card" data-etat="${esc(d.etat)}">
        <h3>${esc(d.titre)}</h3>
        <p class="muted">${esc(ETAT[d.etat])} · ${t('ouvre le ', 'opens ')}${esc(quand(d.ouvre))} · ${t('ferme le ', 'closes ')}${esc(quand(d.ferme))}${peut ? t(' · dernier délai ', ' · final deadline ') + esc(quand(d.limite)) : ''}</p>
        ${rendu}
        ${peut ? `<button class="btn ${d.rendu ? 'ghost' : 'accent'}" type="button" data-ouvrir="${d.id}">${d.rendu ? t('Modifier ma remise', 'Edit my submission') : t('Commencer', 'Start')}</button>` : ''}
      </article>`;
    }).join(''));
    root.querySelectorAll('[data-ouvrir]').forEach(b => { b.onclick = () => ouvrir(b.dataset.ouvrir).catch(erreur); });
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
    const r = await api(`/api/devoirs/${id}`);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      montrer(`<p>${esc(j.error || t('Devoir indisponible.', 'Assignment unavailable.'))}</p><p><button class="btn ghost" type="button" data-retour>${t('Retour', 'Back')}</button></p>`);
      root.querySelector('[data-retour]').onclick = () => liste().catch(erreur);
      return;
    }
    const d = await r.json();
    montrer(`<h3>${esc(d.titre)}</h3>
      <p class="muted">${t('Fermeture : ', 'Closes: ')}${esc(quand(d.ferme))}. ${t('Une remise reçue après cette heure et avant ', 'A submission received after that time and before ')}${esc(quand(d.limite))}${t(' est acceptée mais marquée en retard.', ' is accepted but marked late.')}
        ${t('L’heure retenue est celle du serveur, pas celle de votre appareil.', 'The time recorded is the server’s, not your device’s.')}</p>
      <form id="dev-form">${d.questions.map((q, i) => `<fieldset class="diag-q"><legend>${i + 1}. ${esc(q.question)}${q.points > 1 ? ` <span class="muted">(${q.points} pts)</span>` : ''}</legend>${champ(q)}</fieldset>`).join('')}</form>
      <div class="btn-row"><button class="btn accent" type="button" data-envoyer>${t('Remettre', 'Submit')}</button><button class="btn ghost" type="button" data-retour>${t('Retour', 'Back')}</button></div>
      <div id="dev-msg" role="status" aria-live="polite"></div>`);
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
      const rep = await post(`/api/devoirs/${d.id}/remise`, { reponses, declared_at: new Date().toISOString() });
      const j = await rep.json().catch(() => ({}));
      msg.innerHTML = rep.ok
        ? `<p><b>${t('Remise enregistrée', 'Submission recorded')}</b> ${t('le ', 'on ')}${esc(quand(j.recu))} ${t('(heure du serveur)', '(server time)')}${j.retard ? t(' — marquée en retard.', ' — marked late.') : '.'}
           ${j.note !== undefined ? t(` Note automatique : ${j.note} / ${j.total}.`, ` Automatic mark: ${j.note} / ${j.total}.`) : t(' Les résultats seront publiés par l’enseignant.', ' Results will be released by the teacher.')}</p>`
        : `<p>${t('Remise refusée : ', 'Submission refused: ')}${esc(j.error || rep.status)}</p>`;
    };
  }

  const erreur = () => montrer(`<p class="muted">${t('Impossible de joindre le serveur. Vérifiez votre connexion internet puis réessayez.', 'Cannot reach the server. Check your internet connection and try again.')}</p>`);
  liste().catch(erreur);
})();

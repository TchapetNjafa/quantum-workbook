/* Classement et défis différés (Vercel seulement). Le quiz est corrigé dans le navigateur : classement et défis servent à s'entraîner,
   ils ne notent jamais. Un défi = une série de questions de la banque publique, jouable quand on veut ; le premier essai compte. */
(() => {
  'use strict';
  const EN = (document.documentElement.lang || 'fr').startsWith('en');
  const t = (fr, en) => (EN ? en : fr);
  const root = document.getElementById('classement');
  if (!root) return;
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const api = (path, opt) => fetch(path, { credentials: 'same-origin', ...opt });
  const post = (path, body) => api(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const montrer = h => { root.innerHTML = h; };
  const duree = s => `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`;
  const AUTO = ['qcm', 'vrai_faux', 'numerical', 'matching', 'drag_drop', 'hotspot']; // formats corrigés par le quiz lui-même
  const jouer = (code, ids) => `${EN ? '/quiz/en/quiz.html' : '/quiz/quiz.html'}?ids=${ids.join(',')}&n=${ids.length}&defi=${code}`;

  if (/\.github\.io$/.test(location.hostname) || location.protocol === 'file:') {
    montrer(`<p class="muted">${t('Le classement et les défis n’existent que sur le site hébergé sur Vercel.', 'The leaderboard and challenges only exist on the Vercel-hosted site.')}</p>`);
    return;
  }

  async function banque() {
    const d = await (await fetch(EN ? '/quiz/data/questions.en.json' : '/quiz/data/questions.json')).json();
    return d.chapters.flatMap(c => c.questions).filter(q => AUTO.includes(q.type) && /^ch[1-6]-q\d{3}$/.test(q.id));
  }

  async function ouvrirDefi(codeBrut, zone) {
    const code = String(codeBrut || '').trim().toUpperCase();
    const r = await api(`/api/defis/${encodeURIComponent(code)}`);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { zone.innerHTML = `<p class="prof-erreurs">${esc(j.error || r.status)}</p>`; return; }
    zone.innerHTML = `<h3>${t('Défi', 'Challenge')} ${esc(j.code)} <span class="muted">· ${j.n} ${t('questions', 'questions')}${j.chapitre ? ` · ${t('chapitre', 'chapter')} ${j.chapitre}` : ''}${j.createur ? ` · ${t('créé par', 'created by')} ${esc(j.createur)}` : ''}</span></h3>
      ${j.deja_joue ? `<p class="muted">${t('Vous avez déjà joué ce défi : seul le premier essai compte.', 'You already played this challenge: only the first attempt counts.')}</p>`
        : `<p><a class="btn accent" data-jouer href="${jouer(j.code, j.ids)}">${t('Jouer ce défi', 'Play this challenge')}</a> <span class="muted">${t('Un seul essai : le premier compte.', 'One attempt only: the first one counts.')}</span></p>`}
      ${j.resultats.length ? `<table class="plain-table"><thead><tr><th>${t('Rang', 'Rank')}</th><th>${t('Matricule', 'Student number')}</th><th>${t('Score', 'Score')}</th><th>${t('Temps', 'Time')}</th></tr></thead><tbody>
        ${j.resultats.map(x => `<tr${x.moi ? ' style="font-weight:600"' : ''}><td>${x.rang}</td><td>${esc(x.matricule ?? t('(masqué)', '(hidden)'))}${x.moi ? t(' (moi)', ' (me)') : ''}</td><td>${x.ok} / ${j.n}</td><td>${esc(duree(x.duree))}</td></tr>`).join('')}</tbody></table>`
        : `<p class="muted">${t('Personne n’a encore joué ce défi.', 'Nobody has played this challenge yet.')}</p>`}
      <p class="muted">${t('Communiquez le code', 'Share the code')} <b>${esc(j.code)}</b> ${t('à vos camarades (valable 30 jours).', 'with your classmates (valid for 30 days).')}</p>`;
  }

  async function afficher() {
    const me = await api('/api/me');
    if (me.status === 401) return montrer(`<p>${t('Connectez-vous avec votre compte universitaire.', 'Sign in with your university account.')}</p><p><a class="btn accent" href="${EN ? '/en/login.html' : '/connexion.html'}">${t('Se connecter', 'Sign in')}</a></p>`);
    const p = window.phy321Profil ? await window.phy321Profil.lire() : null;
    if (p && p.matricule === null) { montrer('<div id="zone-mat"></div>'); return window.phy321Profil.formulaire(root.querySelector('#zone-mat'), afficher); }

    montrer(`<h2>${t('Classement d’entraînement', 'Practice leaderboard')}</h2>
      <p class="muted">${t('Calculé sur vos séries de quiz (5 questions ou plus), à partir de 3 séries. Il sert à s’entraîner et ne compte pas dans les notes. Les étudiants qui ont masqué leur matricule n’y figurent pas.', 'Computed from quiz sets of 5 questions or more, from 3 sets onward. It is for practice and does not count towards marks. Students who hid their student number do not appear.')}</p>
      <label>${t('Chapitre', 'Chapter')} <select data-chapitre><option value="">${t('Tous', 'All')}</option>${[1, 2, 3, 4, 5, 6].map(c => `<option>${c}</option>`).join('')}</select></label>
      <div data-classement></div>
      <h2>${t('Défis entre camarades', 'Challenges')}</h2>
      <p class="muted">${t('Lancez une série de questions identique pour tous ; chacun la joue quand il veut, le premier essai compte.', 'Set the same series of questions for everyone; each plays when they like, the first attempt counts.')}</p>
      <form class="prof-ligne" data-creer-defi>
        <label>${t('Chapitre', 'Chapter')} <select name="c">${[1, 2, 3, 4, 5, 6].map(c => `<option>${c}</option>`).join('')}</select></label>
        <label>${t('Questions', 'Questions')} <select name="n"><option>5</option><option selected>10</option><option>15</option></select></label>
        <button class="btn accent" type="submit">${t('Créer un défi', 'Create a challenge')}</button></form>
      <form class="prof-ligne" data-ouvrir-defi>
        <label>${t('Code d’un défi', 'Challenge code')} <input type="text" name="code" maxlength="6" size="8" autocomplete="off" style="text-transform:uppercase"></label>
        <button class="btn ghost" type="submit">${t('Ouvrir', 'Open')}</button></form>
      <div data-defi role="status" aria-live="polite"></div>
      <div data-mes-defis></div>`);

    const tab = root.querySelector('[data-classement]'), zoneDefi = root.querySelector('[data-defi]');
    async function chargerClassement() {
      const c = root.querySelector('[data-chapitre]').value;
      const r = await api('/api/classement' + (c ? `?chapitre=${c}` : ''));
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { tab.innerHTML = `<p class="prof-erreurs">${esc(j.error || r.status)}</p>`; return; }
      const moi = j.moi ? `<p>${t('Votre position', 'Your position')} : ${j.moi.masque ? t('masqué (vous n’apparaissez pas dans la liste)', 'hidden (you do not appear in the list)') : `<b>${j.moi.rang}</b> / ${j.total_visibles}`} — ${j.moi.moyenne} % ${t('de moyenne', 'average')}, ${j.moi.series} ${t('séries', 'sets')}.</p>`
        : `<p class="muted">${t('Vous n’êtes pas encore classé : terminez 3 séries de 5 questions ou plus en étant connecté.', 'You are not ranked yet: finish 3 sets of 5 questions or more while signed in.')}</p>`;
      tab.innerHTML = moi + (j.top.length ? `<table class="plain-table"><thead><tr><th>${t('Rang', 'Rank')}</th><th>${t('Matricule', 'Student number')}</th><th>${t('Séries', 'Sets')}</th><th>${t('Moyenne', 'Average')}</th><th>${t('Meilleur', 'Best')}</th></tr></thead><tbody>
        ${j.top.map(x => `<tr${x.moi ? ' style="font-weight:600"' : ''}><td>${x.rang}</td><td>${esc(x.matricule)}</td><td>${x.series}</td><td>${x.moyenne} %</td><td>${x.meilleur} %</td></tr>`).join('')}</tbody></table>` : `<p class="muted">${t('Personne n’est encore classé.', 'Nobody is ranked yet.')}</p>`);
    }
    async function chargerMesDefis() {
      const j = await api('/api/defis').then(r => (r.ok ? r.json() : { defis: [] })).catch(() => ({ defis: [] }));
      const z = root.querySelector('[data-mes-defis]');
      z.innerHTML = j.defis.length ? `<h3>${t('Mes défis', 'My challenges')}</h3><ul>${j.defis.map(d => `<li><button class="btn small ghost" type="button" data-code="${esc(d.code)}">${esc(d.code)}</button> ${d.n} ${t('questions', 'questions')}${d.chapitre ? `, ${t('chapitre', 'chapter')} ${d.chapitre}` : ''} — ${d.mien ? t('créé par moi', 'created by me') : t('rejoint', 'joined')} — ${d.ok === null ? t('pas encore joué', 'not played yet') : `${d.ok} / ${d.n}`}</li>`).join('')}</ul>` : '';
      z.querySelectorAll('[data-code]').forEach(b => { b.onclick = () => ouvrirDefi(b.dataset.code, zoneDefi); });
    }
    root.querySelector('[data-chapitre]').onchange = chargerClassement;
    root.querySelector('[data-ouvrir-defi]').onsubmit = e => { e.preventDefault(); ouvrirDefi(e.target.code.value, zoneDefi); };
    root.querySelector('[data-creer-defi]').onsubmit = async e => {
      e.preventDefault();
      const c = Number(e.target.c.value), n = Number(e.target.n.value);
      zoneDefi.textContent = t('Création…', 'Creating…');
      const pool = (await banque()).filter(q => q.id.startsWith(`ch${c}-`));
      if (pool.length < n) { zoneDefi.innerHTML = `<p class="prof-erreurs">${t('Pas assez de questions dans ce chapitre.', 'Not enough questions in this chapter.')}</p>`; return; }
      for (let i = pool.length - 1; i > 0; i--) { const k = Math.floor(Math.random() * (i + 1)); [pool[i], pool[k]] = [pool[k], pool[i]]; }
      const rep = await post('/api/defis', { chapitre: c, ids: pool.slice(0, n).map(q => q.id) });
      const j = await rep.json().catch(() => ({}));
      if (!rep.ok) { zoneDefi.innerHTML = `<p class="prof-erreurs">${esc(j.error || rep.status)}</p>`; return; }
      await ouvrirDefi(j.code, zoneDefi); chargerMesDefis();
    };
    await chargerClassement(); await chargerMesDefis();
    const h = /defi=([A-Za-z0-9]{6})/.exec(location.hash); if (h) ouvrirDefi(h[1], zoneDefi);
  }
  afficher().catch(() => montrer(`<p class="muted">${t('Impossible de joindre le serveur.', 'Cannot reach the server.')}</p>`));
})();

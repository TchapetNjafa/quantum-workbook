/* Accueil : figure d'interférence qui se construit photon par photon + progression de l'étudiant. */
(() => {
  'use strict';
  const { canvas, loop, draw: D, rand, reduceMotion, t, LOCALE } = window.Lab;

  /* ---------- figure de couverture ---------- */
  const stage = document.getElementById('hero-stage');
  if (stage) {
    const BINS = 400, CAP = 9000;
    const I = x => { const u = Math.PI * 1.1 * x; const s = u ? Math.sin(u) / u : 1; return s * s * (1 + Math.cos(2 * Math.PI * 4.2 * x)); };
    const cdf = rand.cdf(Array.from({ length: BINS }, (_, i) => I(-1 + 2 * (i + 0.5) / BINS)));
    const hits = [];
    let carry = 0;

    const view = canvas(stage, (ctx, w, h, c) => paint(ctx, w, h, c));
    function paint(ctx, w, h, c) {
      ctx.clearRect(0, 0, w, h);
      // fentes stylisées en haut
      ctx.strokeStyle = D.alpha(c.ink, 0.25); ctx.setLineDash([2, 5]);
      ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h * 0.08); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = c.ink2;
      ctx.fillRect(0, h * 0.08, w / 2 - 14, 3); ctx.fillRect(w / 2 - 6, h * 0.08, 12, 3); ctx.fillRect(w / 2 + 14, h * 0.08, w / 2, 3);
      // impacts : les plus récents en vermillon
      const n = hits.length;
      for (let i = 0; i < n; i++) {
        const fresh = i > n - 25;
        const r = fresh ? 1.9 : 1.1;
        ctx.fillStyle = fresh ? c.accent : D.alpha(c.ink, 0.62);
        ctx.fillRect(((hits[i][0] + 1) / 2) * w - r, h * 0.14 + hits[i][1] * h * 0.8 - r, 2 * r, 2 * r);
      }
      D.text(ctx, `N = ${n.toLocaleString(LOCALE)}`, 12, h - 12, { font: c.mono, color: c.muted });
    }
    const add = k => {
      for (let j = 0; j < k; j++) {
        if (hits.length >= CAP) hits.splice(0, 400);       // on recycle les plus anciens
        hits.push([-1 + 2 * (rand.pick(cdf) + Math.random()) / BINS, Math.random()]);
      }
    };
    add(reduceMotion ? 4000 : 700);                          // la page s’ouvre sur des franges déjà esquissées
    loop(stage, (dt, t) => {
      const rate = Math.min(900, 18 + t * t * 6);             // démarrage lent puis accélération
      carry += rate * dt;
      const k = Math.floor(carry);
      if (k) { carry -= k; add(k); }
      paint(view.ctx, view.size().w, view.size().h, view.colors());
    });
  }

  /* ---------- progression (lecture seule) ---------- */
  const data = window.Carnet.store.read();
  let last = null;
  document.querySelectorAll('.chapters li[data-ch]').forEach(li => {
    const s = data[li.dataset.ch];
    const prog = li.querySelector('.ch-prog');
    if (!s || !prog) return;
    const n = Object.keys(s.exos || {}).length;
    const countEl = li.querySelector('[data-exos]');
    const total = countEl ? Number(countEl.dataset.exos) : 0;
    if (n || s.done) last = li;
    prog.textContent = s.done ? t('terminé', 'finished') : (n ? `${n}${total ? ' / ' + total : ''} ${t('exercices réussis', 'exercises solved')}` : '');
    prog.classList.toggle('done', !!s.done);
  });
  if (last) {
    const resume = document.getElementById('resume');
    resume.href = last.querySelector('a').getAttribute('href');
    resume.textContent = `${t('Reprendre au chapitre', 'Resume at chapter')} ${last.querySelector('.ch-num').textContent}`;
    const line = document.getElementById('progress-line');
    line.hidden = false;
    line.textContent = t('Votre progression est enregistrée dans ce navigateur uniquement.', 'Your progress is saved in this browser only.');
  }
  /* ---------- parcours (Fonda, MSC, EEA) : choix local ; chapitres recommandés marqués dans le sommaire, trois labos suggérés ---------- */
  (() => {
    const zone = document.getElementById('parcours');
    const cartes = [...document.querySelectorAll('.ap-cartes article')];
    if (!zone || !cartes.length) return;
    const EN = window.Lab.LANG === 'en';
    const FICHIERS = {
      ch1: ['chapitres/1-etats-quantiques.html', 'chapters/1-quantum-states.html'], ch2: ['chapitres/2-mesure-operateurs.html', 'chapters/2-measurement-operators.html'],
      ch3: ['chapitres/3-dynamique.html', 'chapters/3-quantum-dynamics.html'], ch4: ['chapitres/4-intrication.html', 'chapters/4-entanglement.html'],
      ch5: ['chapitres/5-fonction-etat.html', 'chapters/5-wave-function.html'], ch6: ['chapitres/6-oscillateur.html', 'chapters/6-harmonic-oscillator.html']
    };
    const PARCOURS = {
      fonda: { nom: t('Explorateur des fondements', 'Explorer of the foundations'), chapitres: ['ch1', 'ch2', 'ch4'], labos: [
        ['ch1', 'lab-young-t', '1.1', t('Fentes d’Young, photon par photon', 'Young’s double slit, photon by photon'), t('Voir naître les franges : le point de départ de toute l’étrangeté.', 'Watch fringes emerge: where all the strangeness starts.')],
        ['ch2', 'lab-sg-t', '2.1', t('Stern-Gerlach en cascade', 'Cascaded Stern–Gerlach devices'), t('Mesurer, c’est préparer : l’expérience qui oblige à abandonner l’idée d’un état « déjà là ».', 'Measuring is preparing: the experiment that forces us to drop the idea of a state that is “already there”.')],
        ['ch4', 'lab-chsh-t', '4.2', t('Le jeu CHSH', 'The CHSH game'), t('Des corrélations qui défient toute explication locale.', 'Correlations that defy any local explanation.')]] },
      msc: { nom: t('Architecte de modèles', 'Architect of models'), chapitres: ['ch3', 'ch5', 'ch6'], labos: [
        ['ch5', 'lab-tn-t', '5.4', t('Un paquet d’ondes contre une barrière', 'A wave packet against a barrier'), t('Ce que fait un paquet d’ondes face à une barrière : la base de la microscopie à effet tunnel.', 'What a wave packet does against a barrier: the basis of scanning tunnelling microscopy.')],
        ['ch6', 'lab-lv-t', '6.2', t('Niveaux et fonctions propres', 'Levels and eigenfunctions'), t('Le modèle de base des vibrations des molécules et des solides.', 'The basic model of molecular and solid-state vibrations.')],
        ['ch6', 'lab-co-t', '6.4', t('Un état cohérent dans le puits', 'A coherent state in the well'), t('Le pont entre l’oscillateur quantique et le mouvement classique.', 'The bridge between the quantum oscillator and classical motion.')]] },
      eea: { nom: t('Ingénieur du futur', 'Engineer of the future'), chapitres: ['ch1', 'ch3', 'ch4'], labos: [
        ['ch1', 'lab-q-t', '1.4', t('Préparer et mesurer un qubit', 'Preparing and measuring a qubit'), t('L’unité de base d’un calculateur quantique.', 'The basic unit of a quantum computer.')],
        ['ch3', 'lab-rb-t', '3.3', t('Oscillations de Rabi avec désaccord', 'Rabi oscillations with detuning'), t('Comment on commande un qubit ou un atome d’horloge.', 'How a qubit or a clock atom is driven.')],
        ['ch4', 'lab-bb-t', '4.3', t('BB84 et l’espionne Ève', 'BB84 and Eve the eavesdropper'), t('La distribution quantique de clé, pour des télécommunications sûres.', 'Quantum key distribution, for secure telecommunications.')]] }
    };
    cartes.forEach(a => {
      const id = a.querySelector('.mono').textContent.trim().toLowerCase();
      if (!PARCOURS[id]) return;
      a.dataset.parcours = id;
      a.insertAdjacentHTML('beforeend', '<button type="button" class="btn ghost small parcours-btn"></button>');
      a.querySelector('.parcours-btn').addEventListener('click', () => choisir(id));
    });
    function choisir(id) {
      window.Carnet.store.update(s => { if (id) s._parcours = id; else delete s._parcours; return s; });
      afficher();
    }
    function afficher() {
      const id = window.Carnet.store.read()._parcours, p = PARCOURS[id];
      cartes.forEach(a => {
        const choisi = !!a.dataset.parcours && a.dataset.parcours === id, b = a.querySelector('.parcours-btn');
        if (!b) return;
        a.classList.toggle('choisi', choisi);
        b.textContent = choisi ? t('Parcours choisi ✓', 'Chosen path ✓') : t('Choisir ce parcours', 'Choose this path');
        b.setAttribute('aria-pressed', String(choisi));
      });
      document.querySelectorAll('.chapters li[data-ch]').forEach(li => {
        li.classList.toggle('pour-vous', !!p && p.chapitres.includes(li.dataset.ch));
        li.querySelectorAll('.ch-reco').forEach(e => e.remove());
        if (p && p.chapitres.includes(li.dataset.ch)) li.querySelector('.ch-title').insertAdjacentHTML('afterend', `<span class="ch-reco">${t('Recommandé pour votre parcours', 'Recommended for your path')}</span>`);
      });
      zone.hidden = !p;
      if (!p) { zone.innerHTML = ''; return; }
      zone.innerHTML = `<h4>${t('Pour votre parcours', 'For your path')} : ${p.nom}</h4>
        <ul>${p.labos.map(([ch, ancre, num, titre, why]) => `<li><a href="${FICHIERS[ch][EN ? 1 : 0]}#${ancre}"><b>${num}</b> ${titre}</a><span>${why}</span></li>`).join('')}</ul>
        <button type="button" class="btn ghost small" data-retirer>${t('Retirer mon parcours', 'Clear my path')}</button>
        <p class="muted">${t('Ce choix reste dans votre navigateur. Tous les chapitres restent accessibles : il ne fait que mettre en avant ceux qui vous correspondent.', 'This choice stays in your browser. All chapters remain available: it only highlights the ones that suit you.')}</p>`;
      zone.querySelector('[data-retirer]').addEventListener('click', () => choisir(null));
    }
    afficher();
  })();

  const sr = window.Carnet.serie();
  if (sr.courante >= 2) {
    const line = document.getElementById('progress-line');
    line.hidden = false;
    line.textContent = (line.textContent ? line.textContent + ' ' : '') + t(`Série en cours : ${sr.courante} jours d’affilée.`, `Current streak: ${sr.courante} days in a row.`);
  }
})();

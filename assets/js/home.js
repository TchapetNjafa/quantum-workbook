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
})();

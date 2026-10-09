/* Chapitre 6 — laboratoires : opérateurs d'échelle, niveaux et fonctions propres,
   superposition de deux niveaux, état cohérent. Unités réduites : u = x/ℓ, ℓ = √(ħ/mω),
   énergies en ħω, temps en périodes T = 2π/ω. */
(() => {
  'use strict';
  const { canvas, loop, bind, seg, draw: D } = window.Lab;
  const $ = (root, s) => root.querySelector(s);
  const TAU = 2 * Math.PI;
  const fr = (v, d = 3) => v.toFixed(d).replace('.', ',');

  /* ψ_0..ψ_nmax en u, normalisées : ∫|ψ_n|² du = 1.
     ψ_0 = π^(-1/4) e^(-u²/2), ψ_1 = √2 u ψ_0,
     ψ_{k+1} = √(2/(k+1)) u ψ_k − √(k/(k+1)) ψ_{k−1}  (équivaut à H_{k+1} = 2uH_k − 2kH_{k−1}). */
  function fock(nmax, u) {
    const out = new Float64Array(nmax + 1);
    out[0] = Math.PI ** -0.25 * Math.exp(-u * u / 2);
    if (nmax > 0) out[1] = Math.SQRT2 * u * out[0];
    for (let k = 1; k < nmax; k++) out[k + 1] = Math.sqrt(2 / (k + 1)) * u * out[k] - Math.sqrt(k / (k + 1)) * out[k - 1];
    return out;
  }
  const psi = (n, u) => fock(n, u)[n];

  // hachures diagonales sur un rectangle
  function hatch(ctx, x, y, w, h, color) {
    if (w <= 0 || h <= 0) return;
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.strokeStyle = color; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let s = -h; s < w + h; s += 7) { ctx.moveTo(x + s, y + h); ctx.lineTo(x + s + h, y); }
    ctx.stroke();
    ctx.restore();
  }

  /* =====================================================================
     1. Opérateurs d'échelle : a|n⟩ = √n |n−1⟩, a|0⟩ = 0, a†|n⟩ = √(n+1) |n+1⟩, N|n⟩ = n|n⟩.
     On suit l'état c|n⟩ avec c = √K (K entier).
     ===================================================================== */
  function ladder(root) {
    const stage = $(root, '.lab-stage');
    const TOP = 7;
    let n = 0, K = 1, n0 = 0, ops = [], anim = null, lastNote = '';
    const view = canvas(stage, (ctx, w, h, c) => paint(ctx, w, h, c));

    const yOf = (k, h) => h - 26 - (k / TOP) * (h - 52);

    function paint(ctx, w, h, c) {
      ctx.clearRect(0, 0, w, h);
      const x0 = Math.max(70, w * 0.22), x1 = Math.min(w - 90, w * 0.62);
      ctx.strokeStyle = c.muted; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x0, yOf(0, h) + 14); ctx.lineTo(x0, yOf(TOP, h) - 14);
      ctx.moveTo(x1, yOf(0, h) + 14); ctx.lineTo(x1, yOf(TOP, h) - 14); ctx.stroke();
      for (let k = 0; k <= TOP; k++) {
        const y = yOf(k, h);
        ctx.strokeStyle = k === n && K ? c.ink : c.rule; ctx.lineWidth = k === n && K ? 2.5 : 1.5;
        ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
        D.text(ctx, `|${k}⟩`, x0 - 12, y + 4, { font: c.mono, color: k === n && K ? c.ink : c.muted, align: 'right' });
        D.text(ctx, `${2 * k + 1}/2 ħω`, x1 + 10, y + 4, { font: c.mono, color: c.muted });
      }
      D.text(ctx, 'E', x1 + 10, yOf(TOP, h) - 18, { font: c.serif, color: c.muted });

      // quanton sur son barreau (animé lors d'un saut)
      let yb = yOf(n, h), alpha = K ? 1 : 0;
      if (anim) {
        const e = anim.k * anim.k * (3 - 2 * anim.k);
        yb = yOf(anim.from, h) + (yOf(anim.to, h) - yOf(anim.from, h)) * e;
        alpha = anim.vanish ? 1 - e : 1;
        if (anim.label) {
          const xm = x1 - 26;
          ctx.strokeStyle = c.accent; ctx.fillStyle = c.accent; ctx.lineWidth = 1.6;
          if (anim.to !== anim.from) D.arrow(ctx, xm, yOf(anim.from, h), xm, yOf(anim.to, h), 8);
          D.text(ctx, anim.label, xm - 8, (yOf(anim.from, h) + yOf(anim.to, h)) / 2 + 4, { font: c.mono, color: c.accent, align: 'right' });
        }
      }
      const xb = (x0 + x1) / 2;
      ctx.fillStyle = D.alpha(c.accent, 0.9 * alpha);
      ctx.beginPath(); ctx.arc(xb, yb - 9, 8, 0, TAU); ctx.fill();
      if (!K && !anim) D.text(ctx, 'vecteur nul : plus aucun état', xb, yOf(0, h) - 14, { font: c.sans, color: c.bad, align: 'center' });
    }

    const coef = k => {
      if (!k) return '0';
      const r = Math.round(Math.sqrt(k));
      return r * r === k ? String(r) : `√${k} ≈ ${fr(Math.sqrt(k))}`;
    };
    function text() {
      const lhs = (ops.length ? ops.join(' ') + ' ' : '') + `|${n0}⟩`;
      const rhs = K ? (coef(K) === '1' ? '' : coef(K).split(' ≈')[0] + ' ') + `|${n}⟩` : '0';
      $(root, '[data-out="eq"]').textContent = `${lhs} = ${rhs}`;
      $(root, '[data-out="c"]').textContent = coef(K);
      $(root, '[data-out="K"]').textContent = K;
      $(root, '[data-out="E"]').textContent = K ? `${2 * n + 1}/2 ħω` : '—';
      $(root, '[data-out="note"]').textContent = lastNote;
      root.querySelectorAll('[data-op]').forEach(b => { b.disabled = !K || (b.dataset.op === 'up' && n >= TOP); });
    }
    function animate(from, to, label, vanish) {
      const t0 = performance.now();
      anim = { from, to, label, vanish, k: 0 };
      const step = now => {
        anim.k = Math.min(1, (now - t0) / 420);
        view.redraw();
        if (anim.k < 1) requestAnimationFrame(step);
        else setTimeout(() => { anim = null; view.redraw(); }, 500);
      };
      requestAnimationFrame(step);
    }
    function apply(op) {
      if (!K || anim) return;
      if (op === 'down') {
        ops.unshift('a');
        if (n === 0) { K = 0; lastNote = 'a|0⟩ = 0 : le vide est annihilé. Le résultat est le vecteur nul, pas l’état |0⟩.'; animate(0, 0, '× 0', true); }
        else { K *= n; lastNote = `a|${n}⟩ = √${n} |${n - 1}⟩`; animate(n, n - 1, `√${n}`); n--; }
      } else if (op === 'up') {
        ops.unshift('a†'); K *= n + 1; lastNote = `a†|${n}⟩ = √${n + 1} |${n + 1}⟩`; animate(n, n + 1, `√${n + 1}`); n++;
      } else {
        ops.unshift('N'); lastNote = `N|${n}⟩ = ${n} |${n}⟩ : même état, multiplié par sa valeur propre.`;
        K *= n * n; animate(n, n, `× ${n}`, n === 0);
      }
      text();
    }
    root.querySelectorAll('[data-op]').forEach(b => b.addEventListener('click', () => apply(b.dataset.op)));
    root.querySelectorAll('[data-start]').forEach(b => b.addEventListener('click', () => {
      n = n0 = +b.dataset.start; K = 1; ops = []; anim = null; lastNote = ''; text(); view.redraw();
    }));
    text();
  }

  /* =====================================================================
     2. Niveaux E_n = (n + ½)ħω dans V(u) = u²/2, fonctions propres ψ_n(u) et densité
     classique ρ(u) = 1 / (π √(u₀² − u²)), u₀ = √(2n + 1).
     ===================================================================== */
  function levels(root) {
    const stage = $(root, '.lab-stage');
    const NMAX = 12, U = 6.4, EMAX = NMAX + 1.6;
    let n = 0, mode = 'psi';
    const view = canvas(stage, (ctx, w, h, c) => paint(ctx, w, h, c));
    const geo = () => {
      const { w, h } = view.size();
      const top = 14, base = h - 26;
      return { w, h, top, base, X: u => w / 2 + u * (w / 2 - 10) / U, Y: E => base - E * (base - top) / EMAX, sy: (base - top) / EMAX };
    };

    function paint(ctx, w, h, c) {
      ctx.clearRect(0, 0, w, h);
      const { top, base, X, Y, sy } = geo();
      const E = n + 0.5, u0 = Math.sqrt(2 * E);
      // zones classiquement interdites pour le niveau choisi
      hatch(ctx, 0, top, X(-u0), base - top, D.alpha(c.muted, 0.28));
      hatch(ctx, X(u0), top, w - X(u0), base - top, D.alpha(c.muted, 0.28));
      // axes et potentiel
      ctx.strokeStyle = c.rule; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, base + 0.5); ctx.lineTo(w, base + 0.5); ctx.moveTo(X(0) + 0.5, top); ctx.lineTo(X(0) + 0.5, base); ctx.stroke();
      ctx.strokeStyle = c.blue; ctx.lineWidth = 2.5; ctx.beginPath();
      for (let i = 0; i <= 200; i++) {
        const u = -U + 2 * U * i / 200, y = Y(u * u / 2);
        if (y < top) { ctx.moveTo(X(u), y); continue; }
        ctx.lineTo(X(u), y);
      }
      ctx.stroke();
      // tous les niveaux, entre leurs points de rebroussement
      for (let k = 0; k <= NMAX; k++) {
        const uk = Math.sqrt(2 * k + 1);
        ctx.strokeStyle = k === n ? c.ink : D.alpha(c.muted, 0.55); ctx.lineWidth = k === n ? 1.4 : 1;
        ctx.setLineDash(k === n ? [] : [3, 3]);
        ctx.beginPath(); ctx.moveTo(X(-uk), Y(k + 0.5)); ctx.lineTo(X(uk), Y(k + 0.5)); ctx.stroke();
      }
      ctx.setLineDash([]);
      // ψ_n ou |ψ_n|², tracé sur la ligne de son énergie
      const y0 = Y(E), A = mode === 'psi' ? 1.8 * sy : 3.0 * sy;
      if (mode === 'prob') {
        // densité classique, même normalisation (∫ρ du = 1)
        ctx.strokeStyle = c.ink; ctx.lineWidth = 1.4; ctx.setLineDash([5, 4]); ctx.beginPath();
        let started = false;
        for (let i = 1; i < 400; i++) {
          const u = -u0 + 2 * u0 * i / 400;
          const r = 1 / (Math.PI * Math.sqrt(u0 * u0 - u * u));
          const y = y0 - Math.min(r, 1.4) * A;
          if (started) ctx.lineTo(X(u), y); else { ctx.moveTo(X(u), y); started = true; }
        }
        ctx.stroke(); ctx.setLineDash([]);
      }
      ctx.beginPath();
      for (let i = 0; i <= 500; i++) {
        const u = -U + 2 * U * i / 500, p = psi(n, u), v = mode === 'psi' ? p : p * p;
        if (i) ctx.lineTo(X(u), y0 - v * A); else ctx.moveTo(X(u), y0 - v * A);
      }
      if (mode === 'prob') {
        ctx.lineTo(X(U), y0); ctx.lineTo(X(-U), y0); ctx.closePath();
        ctx.fillStyle = D.alpha(c.accent, 0.22); ctx.fill();
      }
      ctx.strokeStyle = c.accent; ctx.lineWidth = 2; ctx.stroke();
      D.text(ctx, `n = ${n}`, X(u0) + 6, y0 - 4, { font: c.mono, color: c.ink });
      D.text(ctx, 'x / ℓ', w - 8, h - 8, { font: c.sans, color: c.muted, align: 'right' });
      D.text(ctx, '−u₀', X(-u0), h - 8, { font: c.mono, color: c.muted, align: 'center' });
      D.text(ctx, '+u₀', X(u0), h - 8, { font: c.mono, color: c.muted, align: 'center' });
    }

    function text() {
      const u0 = Math.sqrt(2 * n + 1);
      let s = 0;                                         // P(|u| > u₀), méthode des trapèzes
      const du = 0.002;
      for (let u = u0; u < 10; u += du) s += du * (psi(n, u) ** 2 + psi(n, u + du) ** 2) / 2;
      $(root, '[data-out="E"]').textContent = `${2 * n + 1}/2 ħω`;
      $(root, '[data-out="nodes"]').textContent = n;
      $(root, '[data-out="par"]').textContent = n % 2 ? 'impaire' : 'paire';
      $(root, '[data-out="out"]').textContent = fr(100 * 2 * s, 1) + ' %';
    }

    const nIn = $(root, '#lv-n');
    bind(nIn, v => { n = v; text(); view.redraw(); }, v => v);
    seg($(root, '[data-seg="mode"]'), v => { mode = v; view.redraw(); });
    stage.addEventListener('click', e => {               // cliquer un niveau le sélectionne
      const r = stage.getBoundingClientRect(), { Y, sy } = geo();
      const E = (Y(0) - (e.clientY - r.top)) / sy;
      const k = Math.max(0, Math.min(NMAX, Math.round(E - 0.5)));
      nIn.value = k; nIn.dispatchEvent(new Event('input'));
    });
  }

  /* =====================================================================
     3. Superposition (|n⟩ + |m⟩)/√2 :
     |ψ(u,t)|² = ½[ψ_n² + ψ_m² + 2 ψ_n ψ_m cos((m − n)ωt)].
     ===================================================================== */
  function superpose(root) {
    const stage = $(root, '.lab-stage');
    const U = 5.5, N = 360;
    let n = 0, m = 1, t = 0, tab = null;
    const us = Float64Array.from({ length: N + 1 }, (_, i) => -U + 2 * U * i / N);
    const rebuild = () => { tab = Array.from(us, u => fock(Math.max(n, m), u)); };
    const density = (i, tt) => {
      const a = tab[i][n], b = tab[i][m];
      return n === m ? a * a : 0.5 * (a * a + b * b + 2 * a * b * Math.cos((m - n) * TAU * tt));
    };
    const view = canvas(stage, (ctx, w, h, c) => paint(ctx, w, h, c));

    function paint(ctx, w, h, c) {
      ctx.clearRect(0, 0, w, h);
      if (!tab) rebuild();
      const base = h - 28, top = 22, X = u => w / 2 + u * (w / 2 - 12) / U;
      let max = 0;
      for (let i = 0; i <= N; i++) { const a = tab[i][n], b = tab[i][m]; max = Math.max(max, n === m ? a * a : 0.5 * (Math.abs(a) + Math.abs(b)) ** 2); }
      const Yp = p => base - (p / max) * (base - top) * 0.95;
      ctx.strokeStyle = c.rule; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, base + 0.5); ctx.lineTo(w, base + 0.5); ctx.moveTo(X(0) + 0.5, top); ctx.lineTo(X(0) + 0.5, base); ctx.stroke();
      // moyenne temporelle
      ctx.strokeStyle = c.ink; ctx.lineWidth = 1.2; ctx.setLineDash([5, 4]); ctx.beginPath();
      for (let i = 0; i <= N; i++) { const a = tab[i][n], b = tab[i][m], p = n === m ? a * a : 0.5 * (a * a + b * b); if (i) ctx.lineTo(X(us[i]), Yp(p)); else ctx.moveTo(X(us[i]), Yp(p)); }
      ctx.stroke(); ctx.setLineDash([]);
      // densité instantanée et ⟨u⟩(t)
      let mean = 0;
      ctx.beginPath(); ctx.moveTo(X(-U), base);
      for (let i = 0; i <= N; i++) { const p = density(i, t); mean += us[i] * p * (2 * U / N); ctx.lineTo(X(us[i]), Yp(p)); }
      ctx.lineTo(X(U), base); ctx.closePath();
      ctx.fillStyle = D.alpha(c.accent, 0.25); ctx.fill();
      ctx.strokeStyle = c.accent; ctx.lineWidth = 2; ctx.stroke();
      ctx.strokeStyle = c.blue; ctx.fillStyle = c.blue; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(X(mean), base + 2); ctx.lineTo(X(mean), base + 12); ctx.stroke();
      D.text(ctx, '⟨x⟩', X(mean), base + 24, { font: c.mono, color: c.blue, align: 'center' });
      // horloge : phase ωt
      const cx = w - 26, cy = 26, r = 14;
      ctx.strokeStyle = c.muted; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
      ctx.strokeStyle = c.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.lineTo(cx + r * Math.sin(TAU * t), cy - r * Math.cos(TAU * t)); ctx.stroke();
      D.text(ctx, `t = ${fr(t % 1, 2)} T`, cx - r - 8, cy + 4, { font: c.mono, color: c.muted, align: 'right' });
      $(root, '[data-out="mean"]').textContent = fr(mean, 2) + ' ℓ';
    }

    function text() {
      const d = Math.abs(m - n);
      $(root, '[data-out="Tb"]').textContent = d ? (d === 1 ? 'T' : `T/${d}`) : '∞ (stationnaire)';
      const amp = d === 1 ? Math.sqrt((Math.max(n, m)) / 2) : 0;
      $(root, '[data-out="amp"]').textContent = fr(amp, 3) + ' ℓ';
    }
    const anim = loop(stage, dt => { t += dt / 3; paint(view.ctx, view.size().w, view.size().h, view.colors()); });
    const play = $(root, '[data-act="play"]');
    play.addEventListener('click', () => { play.textContent = anim.toggle() ? 'Pause' : 'Lecture'; });
    const changed = () => { tab = null; text(); view.redraw(); };
    bind($(root, '#sp-n'), v => { n = v; changed(); }, v => `|${v}⟩`);
    bind($(root, '#sp-m'), v => { m = v; changed(); }, v => `|${v}⟩`);
  }

  /* =====================================================================
     4. État cohérent |α⟩, α réel à t = 0 :
     |ψ(u,t)|² = π^(-1/2) exp(−(u − √2|α| cos ωt)²)  (paquet de largeur fixe),
     (⟨X̂⟩, ⟨P̂⟩) = √2|α| (cos ωt, −sin ωt),  P(n) = e^(−|α|²) |α|^(2n) / n!.
     ===================================================================== */
  function coherent(root) {
    const stage = $(root, '.lab-stage');
    const stage2 = $(root, '[data-stage="poisson"]');
    let A = 2, t = 0, counts = null, total = 0;
    const view = canvas(stage, (ctx, w, h, c) => paint(ctx, w, h, c));
    const bars = canvas(stage2, (ctx, w, h, c) => paintBars(ctx, w, h, c));
    const nTop = () => Math.min(40, Math.max(10, Math.ceil(A * A + 4 * A + 4)));
    const poisson = k => { let lp = -A * A; for (let j = 1; j <= k; j++) lp += Math.log(A * A / j); return A ? Math.exp(lp) : (k ? 0 : 1); };

    function paint(ctx, w, h, c) {
      ctx.clearRect(0, 0, w, h);
      const U = 7.2, split = h * 0.56;
      // --- espace des positions
      const base = split - 22, top = 12, X = u => w / 2 + u * (w / 2 - 10) / U;
      const Yv = v => base - v * (base - top) / 14;   // potentiel en ħω
      ctx.strokeStyle = D.alpha(c.blue, 0.6); ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 0; i <= 160; i++) { const u = -U + 2 * U * i / 160, y = Yv(u * u / 2); if (y < top) ctx.moveTo(X(u), y); else ctx.lineTo(X(u), y); }
      ctx.stroke();
      ctx.strokeStyle = c.rule; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, base + 0.5); ctx.lineTo(w, base + 0.5); ctx.stroke();
      const amp = Math.SQRT2 * A, uc = amp * Math.cos(TAU * t);
      ctx.strokeStyle = c.muted; ctx.setLineDash([2, 3]);
      [-amp, amp].forEach(u => { ctx.beginPath(); ctx.moveTo(X(u), base); ctx.lineTo(X(u), top + 10); ctx.stroke(); });
      ctx.setLineDash([]);
      const Hp = (base - top) * 0.9 / (1 / Math.sqrt(Math.PI));
      ctx.beginPath(); ctx.moveTo(X(-U), base);
      for (let i = 0; i <= 300; i++) { const u = -U + 2 * U * i / 300; ctx.lineTo(X(u), base - Hp * Math.exp(-((u - uc) ** 2)) / Math.sqrt(Math.PI)); }
      ctx.lineTo(X(U), base); ctx.closePath();
      ctx.fillStyle = D.alpha(c.accent, 0.28); ctx.fill(); ctx.strokeStyle = c.accent; ctx.lineWidth = 2; ctx.stroke();
      D.text(ctx, '|ψ(x,t)|²', 8, top + 10, { font: c.mono, color: c.accent });
      D.text(ctx, 'x / ℓ', w - 8, split - 6, { font: c.sans, color: c.muted, align: 'right' });
      // --- espace des phases (X̂, P̂)
      const pTop = split + 8, pH = h - pTop - 8, R = pH / 2, cx = Math.min(w * 0.3, R + 40), cy = pTop + R;
      const s = (R - 6) / (Math.SQRT2 * 4 + 1);
      ctx.strokeStyle = c.rule; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();
      D.text(ctx, 'X̂', cx + R - 2, cy - 5, { font: c.mono, color: c.muted, align: 'right' });
      D.text(ctx, 'P̂', cx + 5, pTop + 10, { font: c.mono, color: c.muted });
      ctx.strokeStyle = c.muted; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(cx, cy, amp * s, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      const px = cx + uc * s, py = cy + amp * Math.sin(TAU * t) * s;   // ⟨P̂⟩ = −√2|α| sin ωt, axe vers le haut
      ctx.fillStyle = D.alpha(c.accent, 0.3); ctx.strokeStyle = c.accent; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(px, py, Math.SQRT1_2 * s, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = c.ink; ctx.beginPath(); ctx.arc(cx, cy, 2, 0, TAU); ctx.fill();
      const tx = cx + R + 16;
      if (tx < w - 60) {
        D.text(ctx, 'disque : ΔX̂ = ΔP̂ = 1/√2', tx, cy - 10, { font: c.sans, color: c.muted });
        D.text(ctx, 'cercle : orbite classique', tx, cy + 10, { font: c.sans, color: c.muted });
      }
    }

    function paintBars(ctx, w, h, c) {
      ctx.clearRect(0, 0, w, h);
      const K = nTop(), base = h - 18, top = 8, bw = w / (K + 1);
      let pmax = 0; for (let k = 0; k <= K; k++) pmax = Math.max(pmax, poisson(k));
      if (counts && total) for (let k = 0; k <= K; k++) pmax = Math.max(pmax, (counts[k] || 0) / total);
      const Y = p => base - p / pmax * (base - top);
      for (let k = 0; k <= K; k++) {
        const x = k * bw;
        ctx.fillStyle = D.alpha(c.ink, 0.7); ctx.fillRect(x + 1, Y(poisson(k)), Math.max(1, bw - 2), base - Y(poisson(k)));
        if (counts && total) {
          const y = Y((counts[k] || 0) / total);
          ctx.strokeStyle = c.accent; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + bw, y); ctx.stroke();
        }
      }
      ctx.strokeStyle = c.rule; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, base + 0.5); ctx.lineTo(w, base + 0.5); ctx.stroke();
      const step = K > 20 ? 10 : 5;
      for (let k = 0; k <= K; k += step) D.text(ctx, String(k), (k + 0.5) * bw, h - 4, { font: c.mono, color: c.muted, align: 'center' });
      const xm = (A * A + 0.5) * bw;
      ctx.strokeStyle = c.blue; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(xm, top); ctx.lineTo(xm, base); ctx.stroke(); ctx.setLineDash([]);
    }

    function sample() {                                   // tirage de Poisson (méthode de Knuth, λ ≤ 16)
      const L = Math.exp(-A * A); let k = 0, p = Math.random();
      while (p > L) { k++; p *= Math.random(); }
      return k;
    }
    function text() {
      const m = A * A;
      $(root, '[data-out="n"]').textContent = fr(m, 2);
      $(root, '[data-out="dn"]').textContent = fr(A, 2);
      $(root, '[data-out="rel"]').textContent = A ? fr(1 / A, 2) : '—';
      $(root, '[data-out="p0"]').textContent = fr(Math.exp(-m), 3);
      $(root, '[data-out="cnt"]').textContent = total ? `${total} mesures de N` : '';
    }
    const anim = loop(stage, dt => { t += dt / 2.5; paint(view.ctx, view.size().w, view.size().h, view.colors()); });
    const play = $(root, '[data-act="play"]');
    play.addEventListener('click', () => { play.textContent = anim.toggle() ? 'Pause' : 'Lecture'; });
    $(root, '[data-act="count"]').addEventListener('click', () => {
      counts = counts || [];
      for (let i = 0; i < 500; i++) { const k = sample(); counts[k] = (counts[k] || 0) + 1; }
      total += 500; text(); bars.redraw();
    });
    bind($(root, '#co-a'), v => { A = v; counts = null; total = 0; text(); view.redraw(); bars.redraw(); }, v => fr(v, 2));
  }

  const labs = { ladder, levels, superpose, coherent };
  document.querySelectorAll('[data-lab]').forEach(el => { const f = labs[el.dataset.lab]; if (f) f(el); });
})();

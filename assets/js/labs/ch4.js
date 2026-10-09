/* Chapitre 4 — laboratoires : états à deux qubits, jeu CHSH, état de Werner, protocole BB84. */
(() => {
  'use strict';
  const { canvas, loop, bind, seg, draw: D } = window.Lab;
  const $ = (root, s) => root.querySelector(s);
  const out = (root, k, v) => { const el = $(root, `[data-out="${k}"]`); if (el) el.textContent = v; };
  const f = (x, d = 3) => (Math.abs(x) < 0.5 * 10 ** -d ? 0 : x).toFixed(d).replace('-', '−');
  const H2 = p => (p <= 0 || p >= 1) ? 0 : -(p * Math.log2(p) + (1 - p) * Math.log2(1 - p));
  const entropy = ls => ls.reduce((s, l) => s - (l > 1e-12 ? l * Math.log2(l) : 0), 0);

  /* =====================================================================
     1. Constructeur d'états à deux qubits (amplitudes réelles).
     |ψ⟩ = Σ c_ab |ab⟩ ; matrice C = [[c00,c01],[c10,c11]] (lignes : Alice, colonnes : Bob).
     Séparable ⇔ det C = c00c11 − c01c10 = 0.  ρ_A = C Cᵀ, valeurs propres λ± = (1 ± √(1 − 4 det²))/2,
     pureté Tr ρ_A² = 1 − 2 det², S = −Σ λ log₂ λ, vecteur de Bloch de ρ_A : (2ρ01, 0, ρ00 − ρ11).
     ===================================================================== */
  function twoQubits(root) {
    const stage = $(root, '.lab-stage');
    const ids = ['c00', 'c01', 'c10', 'c11'];
    const inputs = ids.map(k => $(root, `#st-${k}`));
    let raw = [1, 0, 0, 0], st = null;

    function compute() {
      const n = Math.hypot(...raw);
      const a = n > 1e-9 ? raw.map(x => x / n) : [1, 0, 0, 0];
      const det = a[0] * a[3] - a[1] * a[2];
      const r00 = a[0] ** 2 + a[1] ** 2, r11 = a[2] ** 2 + a[3] ** 2, r01 = a[0] * a[2] + a[1] * a[3];
      const disc = Math.sqrt(Math.max(0, 1 - 4 * det * det));
      const lp = (1 + disc) / 2, lm = (1 - disc) / 2;
      return { a, det, r00, r11, r01, lp, lm, purity: lp * lp + lm * lm, S: H2(lp), b: [2 * r01, r00 - r11], zero: n <= 1e-9 };
    }

    const view = canvas(stage, (ctx, w, h, c) => paint(ctx, w, h, c));

    function paint(ctx, w, h, c) {
      if (!st) return;
      ctx.clearRect(0, 0, w, h);
      // deux panneaux côte à côte (scène large) ou empilés (scène haute)
      const side = w >= h * 1.25;
      const P1 = side ? { x: 0, y: 0, w: w / 2, h } : { x: 0, y: 0, w, h: h / 2 };
      const P2 = side ? { x: w / 2, y: 0, w: w / 2, h } : { x: 0, y: h / 2, w, h: h / 2 };
      // ---- panneau 1 : matrice des amplitudes, aire ∝ probabilité
      const cell = Math.min(P1.w * 0.34, (P1.h - 76) / 2), mx = P1.x + P1.w / 2;
      const gx = mx - cell + 12, gy = P1.y + (P1.h - 2 * cell) / 2 + 10;
      D.text(ctx, 'amplitudes c_ab', mx + 6, P1.y + 16, { font: c.sans, color: c.muted, align: 'center' });
      D.text(ctx, 'Bob : 0', gx + cell / 2, gy - 8, { font: c.mono, color: c.muted, align: 'center' });
      D.text(ctx, '1', gx + cell * 1.5, gy - 8, { font: c.mono, color: c.muted, align: 'center' });
      D.text(ctx, 'Alice 0', gx - 6, gy + cell / 2 + 4, { font: c.mono, color: c.muted, align: 'right' });
      D.text(ctx, '1', gx - 6, gy + cell * 1.5 + 4, { font: c.mono, color: c.muted, align: 'right' });
      st.a.forEach((v, k) => {
        const x = gx + (k % 2) * cell, y = gy + Math.floor(k / 2) * cell;
        ctx.strokeStyle = c.rule; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, cell, cell);
        const s = Math.abs(v) * (cell - 8);
        ctx.fillStyle = D.alpha(v >= 0 ? c.accent : c.blue, 0.8);
        ctx.fillRect(x + (cell - s) / 2, y + (cell - s) / 2, s, s);
        D.text(ctx, f(v, 2), x + cell / 2, y + cell - 6, { font: c.mono, color: c.ink, align: 'center' });
      });
      const sep = Math.abs(st.det) < 1e-3;
      D.text(ctx, `det C = ${f(st.det)} · ${sep ? 'séparable' : 'intriqué'}`, mx + 6, gy + 2 * cell + 22, { font: c.mono, color: sep ? c.ok : c.accent, align: 'center' });
      // ---- panneau 2 : coupe xz de la sphère de Bloch, état réduit d'Alice
      const R = Math.min(P2.w * 0.34, (P2.h - 64) / 2), cx = P2.x + P2.w / 2, cy = P2.y + P2.h / 2 + 12;
      D.text(ctx, 'état réduit ρ(A), plan xz', cx, P2.y + 16, { font: c.sans, color: c.muted, align: 'center' });
      ctx.fillStyle = D.alpha(c.ink, 0.04); ctx.beginPath(); ctx.arc(cx, cy, R, 0, 2 * Math.PI); ctx.fill();
      ctx.strokeStyle = c.ink2; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 2 * Math.PI); ctx.stroke();
      ctx.strokeStyle = c.rule; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();
      D.text(ctx, '|0⟩', cx, cy - R - 6, { font: c.serif, color: c.ink, align: 'center' });
      D.text(ctx, '|1⟩', cx, cy + R + 16, { font: c.serif, color: c.ink, align: 'center' });
      D.text(ctx, '|+⟩', cx + R + 4, cy + 5, { font: c.serif, color: c.ink });
      D.text(ctx, '|−⟩', cx - R - 4, cy + 5, { font: c.serif, color: c.ink, align: 'right' });
      const [bx, bz] = st.b, tx = cx + bx * R, ty = cy - bz * R;
      ctx.strokeStyle = c.accent; ctx.fillStyle = c.accent; ctx.lineWidth = 2.5;
      if (Math.hypot(bx, bz) > 0.02) D.arrow(ctx, cx, cy, tx, ty, 10);
      ctx.beginPath(); ctx.arc(tx, ty, 4.5, 0, 2 * Math.PI); ctx.fill();
      D.text(ctx, `|b| = ${f(Math.hypot(bx, bz), 2)}`, cx + R + 4, cy + R, { font: c.mono, color: c.muted, align: 'center' });
    }

    function update() {
      st = compute();
      ids.forEach((k, i) => out(root, k, f(st.a[i], 3)));
      out(root, 'det', f(st.det));
      out(root, 'pur', f(st.purity));
      out(root, 'lam', `${f(st.lp)} ; ${f(st.lm)}`);
      out(root, 'S', f(st.S) + ' bit');
      out(root, 'verdict', st.zero ? 'Toutes les amplitudes sont nulles : ce n’est pas un état. On garde |00⟩.'
        : Math.abs(st.det) < 1e-3 ? 'c₀₀c₁₁ = c₀₁c₁₀ : l’état se factorise, ρ_A est pur et S = 0.'
          : `c₀₀c₁₁ ≠ c₀₁c₁₀ : état intriqué. ρ_A est mixte (pureté ${f(st.purity, 2)} < 1).`);
      view.redraw();
    }
    // l'utilisateur règle des amplitudes brutes ; l'affichage montre l'état normalisé
    inputs.forEach((inp, i) => bind(inp, v => { raw[i] = v; if (st) update(); }, v => v.toFixed(2)));
    const set = vals => { vals.forEach((v, i) => { inputs[i].value = v; raw[i] = v; $(root, `output[for="${inputs[i].id}"]`).textContent = (+v).toFixed(2); }); update(); };
    const s2 = Math.SQRT1_2;
    const presets = {
      prod: [1, 0, 0, 0], pm: [0.5, -0.5, 0.5, -0.5],
      phip: [s2, 0, 0, s2], phim: [s2, 0, 0, -s2], psip: [0, s2, s2, 0], psim: [0, s2, -s2, 0]
    };
    root.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => set(presets[b.dataset.preset])));
    bind($(root, '#st-theta'), v => {
      const t = v * Math.PI / 180;
      if (st) set([Math.cos(t), 0, 0, Math.sin(t)]);
    }, v => v + '°');
    update();
  }

  /* =====================================================================
     2. Jeu CHSH sur |Φ+⟩ = (|00⟩ + |11⟩)/√2, mesures de spin dans le plan xz de la sphère de Bloch.
     Quantique : E(a,b) = cos(a − b).  Variables cachées locales (direction λ aléatoire,
     A = signe cos(a − λ)) : E(a,b) = 1 − 2|a − b|/π.
     S = E(a,b) − E(a,b') + E(a',b) + E(a',b') ; |S| ≤ 2 (local), ≤ 2√2 (Tsirelson).
     ===================================================================== */
  function chsh(root) {
    const stage = $(root, '.lab-stage');
    const ang = { a: 0, a2: 90, b: 45, b2: 135 };
    let model = 'Q', n, s, flights = [], carry = 0, lastOut = { A: null, B: null, i: 0, j: 0, t: 0 };
    const rad = x => x * Math.PI / 180;
    const wrap = d => { d = ((d + 180) % 360 + 360) % 360 - 180; return d; };
    const Eth = (x, y) => model === 'Q' ? Math.cos(rad(x - y)) : 1 - 2 * Math.abs(wrap(x - y)) / 180;
    const A = () => [ang.a, ang.a2], B = () => [ang.b, ang.b2];
    const Sof = E => E[0][0] - E[0][1] + E[1][0] + E[1][1];
    const reset = () => { n = [[0, 0], [0, 0]]; s = [[0, 0], [0, 0]]; flights = []; update(); };

    function pair() {
      const i = Math.random() < 0.5 ? 0 : 1, j = Math.random() < 0.5 ? 0 : 1;
      const x = A()[i], y = B()[j];
      let ra, rb;
      if (model === 'Q') {
        ra = Math.random() < 0.5 ? 1 : -1;                       // résultat local : 50/50
        rb = Math.random() < (1 + Math.cos(rad(x - y))) / 2 ? ra : -ra;
      } else {
        const lam = Math.random() * 360;                          // instruction cachée emportée par la paire
        ra = Math.cos(rad(x - lam)) >= 0 ? 1 : -1;
        rb = Math.cos(rad(y - lam)) >= 0 ? 1 : -1;
      }
      n[i][j]++; s[i][j] += ra * rb;
      return { i, j, ra, rb };
    }

    const est = () => [0, 1].map(i => [0, 1].map(j => n[i][j] ? s[i][j] / n[i][j] : NaN));

    const view = canvas(stage, (ctx, w, h, c) => paint(ctx, w, h, c));

    function analyzer(ctx, x, y, r, angle, sel, other, c, name, res) {
      ctx.strokeStyle = c.rule; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI); ctx.stroke();
      [[other, D.alpha(c.ink2, 0.3)], [angle, c.ink]].forEach(([g, col], k) => {
        const u = [Math.sin(rad(g)), -Math.cos(rad(g))];
        ctx.strokeStyle = k ? (sel ? c.accent : c.ink) : col; ctx.lineWidth = k ? 2.5 : 1.5;
        ctx.beginPath(); ctx.moveTo(x - u[0] * r, y - u[1] * r); ctx.lineTo(x + u[0] * r, y + u[1] * r); ctx.stroke();
      });
      D.text(ctx, name, x, y + r + 18, { font: c.sans, color: c.muted, align: 'center' });
      if (res) D.text(ctx, res > 0 ? '+1' : '−1', x, y - r - 8, { font: c.mono, color: res > 0 ? c.accent : c.blue, align: 'center' });
    }

    function paint(ctx, w, h, c) {
      ctx.clearRect(0, 0, w, h);
      const top = h * 0.36, r = Math.min(top * 0.32, w * 0.09), ay = top * 0.52;
      const xa = w * 0.14, xb = w * 0.86, xs = w / 2;
      const fresh = lastOut.t > 0;
      analyzer(ctx, xa, ay, r, A()[lastOut.i], fresh, A()[1 - lastOut.i], c, 'Alice', fresh ? lastOut.A : 0);
      analyzer(ctx, xb, ay, r, B()[lastOut.j], fresh, B()[1 - lastOut.j], c, 'Bob', fresh ? lastOut.B : 0);
      ctx.fillStyle = c.ink; ctx.beginPath(); ctx.arc(xs, ay, 6, 0, 2 * Math.PI); ctx.fill();
      D.text(ctx, model === 'Q' ? 'source |Φ+⟩' : 'source classique', xs, ay + 24, { font: c.sans, color: c.muted, align: 'center' });
      for (const p of flights) {
        const u = Math.min(1, p.t);
        ctx.fillStyle = D.alpha(c.accent, 0.9);
        [[xs + (xa + r - xs) * u], [xs + (xb - r - xs) * u]].forEach(([x]) => { ctx.beginPath(); ctx.arc(x, ay, 3.5, 0, 2 * Math.PI); ctx.fill(); });
      }
      // ---- courbe E(Δ)
      const x0 = 34, x1 = w - 12, y0 = top + 14, y1 = h * 0.8, ym = (y0 + y1) / 2;
      const X = d => x0 + (d + 180) / 360 * (x1 - x0), Y = e => ym - e * (y1 - y0) / 2;
      ctx.strokeStyle = c.rule; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x0, ym); ctx.lineTo(x1, ym); ctx.moveTo(X(0), y0); ctx.lineTo(X(0), y1); ctx.stroke();
      [[1, '+1'], [-1, '−1']].forEach(([e, l]) => D.text(ctx, l, x0 - 4, Y(e) + 4, { font: c.mono, color: c.muted, align: 'right' }));
      [[-180, 'left'], [-90, 'center'], [0, 'center'], [90, 'center'], [180, 'right']].forEach(([d, al]) => D.text(ctx, (d > 0 ? '+' : '') + d + '°', X(d), y1 + 14, { font: c.mono, color: c.muted, align: al }));
      D.text(ctx, 'E(Δ), Δ = angle Alice − angle Bob', x0 + 4, y0 + 2, { font: c.sans, color: c.muted });
      const curve = (fn, col, dash) => {
        ctx.strokeStyle = col; ctx.lineWidth = 1.8; ctx.setLineDash(dash); ctx.beginPath();
        for (let k = 0; k <= 180; k++) { const d = -180 + 2 * k; k ? ctx.lineTo(X(d), Y(fn(d))) : ctx.moveTo(X(d), Y(fn(d))); }
        ctx.stroke(); ctx.setLineDash([]);
      };
      curve(d => Math.cos(rad(d)), model === 'Q' ? c.accent : D.alpha(c.accent, 0.35), []);
      curve(d => 1 - 2 * Math.abs(d) / 180, model === 'Q' ? D.alpha(c.blue, 0.4) : c.blue, [5, 4]);
      const E = est(), names = [['ab', 'ab′'], ['a′b', 'a′b′']];
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
        if (!n[i][j]) continue;
        const d = wrap(A()[i] - B()[j]), px = X(d), py = Y(E[i][j]);
        ctx.fillStyle = c.ink; ctx.beginPath(); ctx.arc(px, py, 4.5, 0, 2 * Math.PI); ctx.fill();
        D.text(ctx, names[i][j], px + 7, py - 6, { font: c.mono, color: c.ink });
      }
      // ---- jauge de S
      const gy = h - 18, g0 = 34, g1 = w - 20, G = v => g0 + Math.min(3, Math.max(0, v)) / 3 * (g1 - g0);
      ctx.strokeStyle = c.rule; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(g0, gy); ctx.lineTo(g1, gy); ctx.stroke();
      ctx.strokeStyle = D.alpha(c.accent, 0.35); ctx.beginPath(); ctx.moveTo(G(2), gy); ctx.lineTo(G(2 * Math.SQRT2), gy); ctx.stroke();
      ctx.lineWidth = 1.5;
      [[2, '2'], [2 * Math.SQRT2, '2√2']].forEach(([v, l]) => {
        ctx.strokeStyle = c.ink; ctx.beginPath(); ctx.moveTo(G(v), gy - 8); ctx.lineTo(G(v), gy + 8); ctx.stroke();
        D.text(ctx, l, G(v), gy - 11, { font: c.mono, color: c.muted, align: 'center' });
      });
      D.text(ctx, '|S|', g0 - 6, gy + 4, { font: c.mono, color: c.muted, align: 'right' });
      const Se = Sof(E);
      if (Number.isFinite(Se)) { ctx.fillStyle = c.accent; ctx.beginPath(); ctx.arc(G(Math.abs(Se)), gy, 6, 0, 2 * Math.PI); ctx.fill(); }
    }

    function update() {
      const E = est(), N = n[0][0] + n[0][1] + n[1][0] + n[1][1];
      const Th = [0, 1].map(i => [0, 1].map(j => Eth(A()[i], B()[j])));
      [['ab', 0, 0], ['ab2', 0, 1], ['a2b', 1, 0], ['a2b2', 1, 1]].forEach(([k, i, j]) =>
        out(root, k, Number.isFinite(E[i][j]) ? f(E[i][j], 2) : '—'));
      const Se = Sof(E);
      let err = 0; for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) if (n[i][j]) err += (1 - E[i][j] ** 2) / n[i][j];
      out(root, 'S', Number.isFinite(Se) ? `${f(Se, 2)} ± ${Math.sqrt(err).toFixed(2)}` : '—');
      out(root, 'Sth', f(Sof(Th), 3));
      out(root, 'N', N.toLocaleString('fr-FR'));
      view.redraw();
    }

    const anim = loop(stage, dt => {
      carry += 5 * dt;
      while (carry >= 1) { carry--; const p = pair(); flights.push({ t: 0, ...p }); }
      for (const p of flights) p.t += dt * 1.8;
      const done = flights.filter(p => p.t >= 1);
      if (done.length) { const p = done[done.length - 1]; lastOut = { A: p.ra, B: p.rb, i: p.i, j: p.j, t: 0.8 }; update(); }
      flights = flights.filter(p => p.t < 1);
      lastOut.t = Math.max(0, lastOut.t - dt);
      paint(view.ctx, view.size().w, view.size().h, view.colors());
    }, { autoplay: false });

    const playBtn = $(root, '[data-act="play"]');
    playBtn.addEventListener('click', () => { const on = anim.toggle(); playBtn.textContent = on ? 'Pause' : 'Envoyer des paires'; });
    $(root, '[data-act="burst"]').addEventListener('click', () => { for (let k = 0; k < 1000; k++) pair(); update(); });
    $(root, '[data-act="reset"]').addEventListener('click', reset);
    const ins = { a: $(root, '#ch-a'), a2: $(root, '#ch-a2'), b: $(root, '#ch-b'), b2: $(root, '#ch-b2') };
    Object.entries(ins).forEach(([k, el]) => bind(el, v => { ang[k] = v; if (n) reset(); }, v => v + '°'));
    const setAngles = v => { Object.entries(v).forEach(([k, x]) => { ins[k].value = x; ins[k].dispatchEvent(new Event('input')); }); };
    $(root, '[data-act="opt"]').addEventListener('click', () => setAngles({ a: 0, a2: 90, b: 45, b2: 135 }));
    $(root, '[data-act="same"]').addEventListener('click', () => setAngles({ a: 0, a2: 90, b: 0, b2: 90 }));
    seg($(root, '[data-seg="model"]'), v => { model = v; if (n) reset(); });
    reset();
  }

  /* =====================================================================
     3. État de Werner ρ_W = p |Ψ−⟩⟨Ψ−| + (1 − p) I/4.
     Valeurs propres : (1+3p)/4 et (1−p)/4 (×3). Transposée partielle : (1+p)/4 (×3) et (1−3p)/4.
     Pureté (1 + 3p²)/4 ; ρ_A = I/2 pour tout p ; |S_CHSH|max = 2√2 p.
     Intriqué ⇔ p > 1/3 (critère PPT, exact pour 2 qubits) ; violation de CHSH ⇔ p > 1/√2.
     ===================================================================== */
  function werner(root) {
    const stage = $(root, '.lab-stage');
    let p = 0.5;
    const view = canvas(stage, (ctx, w, h, c) => paint(ctx, w, h, c));

    function group(ctx, x0, x1, base, unit, vals, title, c) {
      const bw = (x1 - x0) / vals.length;
      D.text(ctx, title, (x0 + x1) / 2, 18, { font: c.sans, color: c.muted, align: 'center' });
      ctx.strokeStyle = c.rule; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0, base); ctx.lineTo(x1, base); ctx.stroke();
      vals.forEach((v, k) => {
        const x = x0 + k * bw + bw * 0.18, hh = v * unit;
        ctx.fillStyle = v < -1e-9 ? c.bad : D.alpha(c.ink, 0.75);
        ctx.fillRect(x, hh >= 0 ? base - hh : base, bw * 0.64, Math.abs(hh));
        D.text(ctx, f(v, 2), x + bw * 0.32, hh >= 0 ? base - hh - 5 : base - hh + 14, { font: c.mono, color: v < -1e-9 ? c.bad : c.ink, align: 'center' });
      });
    }

    function paint(ctx, w, h, c) {
      ctx.clearRect(0, 0, w, h);
      const base = h * 0.5, unit = h * 0.38;
      const ev = [(1 + 3 * p) / 4, (1 - p) / 4, (1 - p) / 4, (1 - p) / 4];
      const pt = [(1 + p) / 4, (1 + p) / 4, (1 + p) / 4, (1 - 3 * p) / 4];
      group(ctx, 16, w / 2 - 12, base, unit, ev, 'valeurs propres de ρ_W', c);
      group(ctx, w / 2 + 12, w - 16, base, unit, pt, 'transposée partielle (Bob)', c);
      // axe p avec les trois régimes
      const x0 = 20, x1 = w - 20, y = h - 34, X = v => x0 + v * (x1 - x0);
      const zones = [[0, 1 / 3, c.ok, 'séparable'], [1 / 3, Math.SQRT1_2, c.accent, 'intriqué'], [Math.SQRT1_2, 1, c.bad, 'viole CHSH']];
      zones.forEach(([a, b, col, l]) => {
        ctx.fillStyle = D.alpha(col, 0.22); ctx.fillRect(X(a), y - 7, X(b) - X(a), 14);
        D.text(ctx, l, (X(a) + X(b)) / 2, y + 26, { font: c.sans, color: col, align: 'center' });
      });
      [[0, '0'], [1 / 3, '1/3'], [Math.SQRT1_2, '1/√2'], [1, '1']].forEach(([v, l]) =>
        D.text(ctx, l, X(v), y - 11, { font: c.mono, color: c.muted, align: 'center' }));
      ctx.fillStyle = c.ink; ctx.beginPath(); ctx.moveTo(X(p), y + 9); ctx.lineTo(X(p) - 6, y + 17); ctx.lineTo(X(p) + 6, y + 17); ctx.fill();
      ctx.fillRect(X(p) - 1, y - 9, 2, 18);
    }

    bind($(root, '#w-p'), v => {
      p = v;
      const ev = [(1 + 3 * p) / 4, (1 - p) / 4, (1 - p) / 4, (1 - p) / 4];
      out(root, 'pur', f((1 + 3 * p * p) / 4));
      out(root, 'S', f(entropy(ev)) + ' bit');
      out(root, 'SA', '1.000 bit');
      out(root, 'min', f((1 - 3 * p) / 4));
      out(root, 'chsh', f(2 * Math.SQRT2 * p, 3));
      out(root, 'verdict', p <= 1 / 3 + 1e-9 ? 'Toutes les valeurs propres de la transposée partielle sont ≥ 0 : l’état est séparable.'
        : p <= Math.SQRT1_2 ? 'Une valeur propre de la transposée partielle est négative : l’état est intriqué, mais il ne viole pas l’inégalité CHSH.'
          : 'Intriqué, et |S| peut dépasser 2 : un test de Bell détecte cette intrication.');
      view.redraw();
    }, v => v.toFixed(2));
  }

  /* =====================================================================
     4. BB84 : bases Z (H/V) et X (±45°), option interception-renvoi par Ève, bruit de canal.
     Sans Ève : QBER = bruit. Avec Ève : QBER ≈ 25 % sur la clé tamisée.
     P(Ève non détectée | m bits comparés) = (3/4)^m.
     ===================================================================== */
  function bb84(root) {
    const stage = $(root, '.lab-stage');
    const tbody = $(root, 'tbody');
    let eve = false, noise = 0, N = 200, rows = [], queue = 0, cur = null, all = [];
    const bit = () => (Math.random() < 0.5 ? 0 : 1);
    const basis = () => (Math.random() < 0.5 ? 'Z' : 'X');
    const angle = (b, v) => b === 'Z' ? (v ? 90 : 0) : (v ? -45 : 45);   // polarisation en degrés
    const measure = (pb, pv, mb) => (pb === mb ? pv : bit());

    function photon() {
      const ab = basis(), av = bit();
      let pb = ab, pv = av, eb = null, ev = null;
      if (eve) { eb = basis(); ev = measure(pb, pv, eb); pb = eb; pv = ev; }   // Ève renvoie l'état qu'elle a mesuré
      const bb = basis();
      let bv = measure(pb, pv, bb);
      if (Math.random() < noise) bv = 1 - bv;
      return { ab, av, eb, ev, bb, bv, keep: ab === bb };
    }

    function stats() {
      const sifted = all.filter(r => r.keep);
      // on sacrifie un bit tamisé sur deux (tirés au hasard) pour estimer le taux d'erreur
      const test = sifted.filter(r => r.test), key = sifted.filter(r => !r.test);
      const e = test.filter(r => r.av !== r.bv).length;
      const q = test.length ? e / test.length : NaN;
      out(root, 'N', all.length.toLocaleString('fr-FR'));
      out(root, 'sift', sifted.length ? `${sifted.length} (${(100 * sifted.length / all.length).toFixed(0)} %)` : '—');
      out(root, 'test', test.length ? `${e} / ${test.length}` : '—');
      out(root, 'qber', Number.isFinite(q) ? (100 * q).toFixed(1) + ' %' : '—');
      out(root, 'key', key.length);
      const L = test.length * Math.log10(0.75), ex = Math.floor(L);   // (3/4)^m sans sous-dépassement
      out(root, 'pnd', test.length ? `${(10 ** (L - ex)).toFixed(1)} × 10^${ex}`.replace('-', '−') : '—');
      out(root, 'verdict', !test.length ? '' : q > 0.11
        ? 'Taux d’erreur supérieur à 11 % : Alice et Bob jettent la clé.'
        : 'Taux d’erreur faible : après correction d’erreurs et amplification de confidentialité, la clé est conservée.');
    }

    function addRow(r) {
      r.test = r.keep && Math.random() < 0.5;
      all.push(r);
      rows.unshift(r); rows = rows.slice(0, 12);
      tbody.innerHTML = rows.map(x => `<tr><td>${x.n}</td><td>${x.ab} · ${x.av}</td><td>${x.eb ? x.eb + ' · ' + x.ev : '—'}</td><td>${x.bb} · ${x.bv}</td>`
        + `<td>${x.keep ? (x.test ? 'test' : 'clé') : 'jeté'}</td><td>${x.keep ? (x.av === x.bv ? 'oui' : '<b style="color:var(--bad)">non</b>') : ''}</td></tr>`).join('');
    }

    const view = canvas(stage, (ctx, w, h, c) => paint(ctx, w, h, c));

    function pol(ctx, x, y, deg, L, col) {
      const a = deg * Math.PI / 180, dx = Math.cos(a) * L, dy = -Math.sin(a) * L;
      ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 2;
      D.arrow(ctx, x, y, x + dx, y + dy, 6); D.arrow(ctx, x, y, x - dx, y - dy, 6);
    }

    function station(ctx, x, y, name, b, v, c) {
      ctx.strokeStyle = c.ink2; ctx.lineWidth = 1.2; ctx.strokeRect(x - 22, y - 22, 44, 44);
      D.text(ctx, name, x, y + 40, { font: c.sans, color: c.muted, align: 'center' });
      if (b) D.text(ctx, b === 'Z' ? '+' : '×', x, y + 7, { font: '500 22px "IBM Plex Mono", monospace', color: c.ink, align: 'center' });
      if (v !== null && v !== undefined) D.text(ctx, 'bit ' + v, x, y - 30, { font: c.mono, color: c.accent, align: 'center' });
    }

    function paint(ctx, w, h, c) {
      ctx.clearRect(0, 0, w, h);
      const y = h * 0.5, xa = w * 0.1, xb = w * 0.9, xe = w * 0.5;
      ctx.strokeStyle = c.rule; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(xa, y); ctx.lineTo(xb, y); ctx.stroke(); ctx.setLineDash([]);
      D.text(ctx, 'canal quantique (photons uniques)', w / 2, h - 10, { font: c.sans, color: c.muted, align: 'center' });
      const r = cur, t = r ? r.t : 0;
      station(ctx, xa, y, 'Alice', r && r.ab, r && r.av, c);
      if (eve) station(ctx, xe, y, 'Ève', r && t > 1 ? r.eb : null, r && t > 1 ? r.ev : null, c);
      station(ctx, xb, y, 'Bob', r && t >= 2 ? r.bb : null, r && t >= 2 ? r.bv : null, c);
      if (r && t < 2) {
        const first = t < 1, u = first ? t : t - 1;
        const x = first ? xa + 26 + (xe - xa - 52) * u : xe + 26 + (xb - xe - 52) * u;
        const deg = first || !eve ? angle(r.ab, r.av) : angle(r.eb, r.ev);
        pol(ctx, x, y, deg, 14, c.accent);
      }
      if (r && t >= 2) D.text(ctx, r.keep ? (r.av === r.bv ? 'même base : bit conservé' : 'même base, bits différents : erreur') : 'bases différentes : bit jeté',
        w / 2, 22, { font: c.sans, color: r.keep ? (r.av === r.bv ? c.ok : c.bad) : c.muted, align: 'center' });
    }

    let count = 0;
    const anim = loop(stage, dt => {
      if (!cur && queue > 0) { queue--; cur = { ...photon(), n: ++count, t: 0 }; }
      if (cur) {
        cur.t += dt * 1.6;
        if (cur.t >= 2 && !cur.logged) { cur.logged = true; addRow(cur); stats(); }
        if (cur.t >= 2.8) { if (queue > 0) cur = null; else anim.pause(); }   // le dernier photon reste affiché
      }
      paint(view.ctx, view.size().w, view.size().h, view.colors());
    }, { autoplay: false });

    const reset = () => { all = []; rows = []; count = 0; queue = 0; cur = null; tbody.innerHTML = ''; stats(); view.redraw(); };
    $(root, '[data-act="anim"]').addEventListener('click', () => { anim.play(); if (cur && cur.t >= 2) cur = null; queue += 12; });
    $(root, '[data-act="many"]').addEventListener('click', () => {
      for (let k = 0; k < N; k++) addRow({ ...photon(), n: ++count });
      stats(); view.redraw();
    });
    $(root, '[data-act="reset"]').addEventListener('click', reset);
    $(root, '#bb-eve').addEventListener('change', e => { eve = e.target.checked; reset(); });
    bind($(root, '#bb-noise'), v => { noise = v / 100; }, v => v.toFixed(0) + ' %');
    bind($(root, '#bb-n'), v => { N = Math.round(10 ** v); }, v => Math.round(10 ** v).toLocaleString('fr-FR'));
    reset();
  }

  const labs = { twoq: twoQubits, chsh, werner, bb84 };
  document.querySelectorAll('[data-lab]').forEach(el => { const fn = labs[el.dataset.lab]; if (fn) fn(el); });
})();

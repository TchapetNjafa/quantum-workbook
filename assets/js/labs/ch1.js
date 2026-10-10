/* Chapitre 1 — laboratoires : fentes d'Young, Mach-Zehnder, phaseurs, qubit sur la sphère de Bloch. */
(() => {
  'use strict';
  const { canvas, loop, bind, seg, drag, draw: D, rand, t, LOCALE } = window.Lab;
  const $ = (root, s) => root.querySelector(s);
  const pct = p => (100 * p).toFixed(1) + t(' %', '%');

  /* =====================================================================
     1. Fentes d'Young, photon par photon, avec information de chemin.
     I(x) ∝ sinc²(πa x) · [1 + V cos(2π d x)],  V = √(1 − D²)  (dualité D² + V² ≤ 1)
     ===================================================================== */
  function young(root) {
    const stage = $(root, '.lab-stage');
    const BINS = 300, SHOW = 90, A = 1.25;
    let d = 4, Dpath = 0, rate = 60, carry = 0, n = 0;
    let hist = new Uint32Array(SHOW), hits = [], cdf;
    const weights = new Float64Array(BINS);
    const dots = document.createElement('canvas');      // impacts accumulés (hors écran)
    const dctx = dots.getContext('2d');

    const xAt = i => -1 + (2 * (i + 0.5)) / BINS;
    const sinc2 = u => (u === 0 ? 1 : (Math.sin(u) / u) ** 2);
    const V = () => Math.sqrt(Math.max(0, 1 - Dpath * Dpath));
    const intensity = x => sinc2(Math.PI * A * x) * (1 + V() * Math.cos(2 * Math.PI * d * x));
    const rebuild = () => { for (let i = 0; i < BINS; i++) weights[i] = intensity(xAt(i)); cdf = rand.cdf(weights); };
    rebuild();

    const view = canvas(stage, (ctx, w, h, c) => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      dots.width = Math.round(w * dpr); dots.height = Math.round(h * 0.56 * dpr);
      dctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dctx.fillStyle = c.ink;
      for (const [x, y] of hits) plot(x, y, w, h);
      paint(ctx, w, h, c);
    });

    function plot(x, y, w, h) {
      dctx.globalAlpha = 0.6;
      dctx.fillRect(((x + 1) / 2) * w - 0.8, y * h * 0.56 - 0.8, 1.6, 1.6);
    }

    function paint(ctx, w, h, c) {
      ctx.clearRect(0, 0, w, h);
      const top = h * 0.56, base = h - 22, H = base - top - 18;
      ctx.fillStyle = c.paper2; ctx.fillRect(0, 0, w, top);
      ctx.drawImage(dots, 0, 0, w, top);
      D.text(ctx, n ? t(`${n.toLocaleString(LOCALE)} photon${n === 1 ? "" : "s"} détecté${n === 1 ? "" : "s"}`, `${n.toLocaleString(LOCALE)} photon${n === 1 ? '' : 's'} detected`) : t('Écran vide — envoyez des photons', 'Empty screen — send some photons'), 10, 18, { font: c.sans, color: c.muted });
      // histogramme des impacts
      let max = 1; for (const v of hist) if (v > max) max = v;
      const bw = w / SHOW;
      ctx.fillStyle = D.alpha(c.ink, 0.78);
      for (let i = 0; i < SHOW; i++) {
        const bh = (hist[i] / max) * H;
        ctx.fillRect(i * bw + 0.5, base - bh, Math.max(1, bw - 1), bh);
      }
      // loi de probabilité théorique, à l'échelle du nombre de coups attendu
      let s = 0, wmax = 0;
      for (let i = 0; i < BINS; i++) { s += weights[i]; if (weights[i] > wmax) wmax = weights[i]; }
      const ref = n > 30 ? max : 1;                        // en coups : pic attendu = n·wmax/s·(BINS/SHOW)
      const peak = n > 30 ? (wmax / s) * n * (BINS / SHOW) : 1;
      ctx.strokeStyle = c.accent; ctx.lineWidth = 1.6; ctx.setLineDash([5, 4]);
      ctx.beginPath();
      for (let i = 0; i <= 240; i++) {
        const x = -1 + 2 * i / 240, X = (i / 240) * w;
        const Y = base - Math.min(H * 1.2, (intensity(x) / wmax) * (peak / ref) * H);
        if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y);
      }
      ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = c.rule; ctx.beginPath(); ctx.moveTo(0, base + 0.5); ctx.lineTo(w, base + 0.5); ctx.stroke();
      D.text(ctx, t('position x sur l’écran', 'position x on the screen'), w / 2, h - 6, { font: c.sans, color: c.muted, align: 'center' });
    }

    function emit(k) {
      const { w, h } = view.size();
      dctx.fillStyle = view.colors().ink;
      for (let j = 0; j < k; j++) {
        const x = xAt(rand.pick(cdf)) + (Math.random() - 0.5) * (2 / BINS);
        const y = Math.random();
        hist[Math.min(SHOW - 1, Math.max(0, Math.floor(((x + 1) / 2) * SHOW)))]++;
        if (hits.length < 40000) hits.push([x, y]);
        plot(x, y, w, h);
        n++;
      }
    }

    function clear() {
      hist = new Uint32Array(SHOW); hits = []; n = 0; carry = 0;
      dctx.clearRect(0, 0, dots.width, dots.height);
      view.redraw();
    }

    const anim = loop(stage, dt => {
      carry += rate * dt;
      const k = Math.floor(carry);
      if (k) { carry -= k; emit(k); }
      paint(view.ctx, view.size().w, view.size().h, view.colors());
    }, { autoplay: false });

    const playBtn = $(root, '[data-act="play"]');
    playBtn.addEventListener('click', () => { const on = anim.toggle(); playBtn.textContent = on ? t('Pause', 'Pause') : t('Envoyer des photons', 'Send photons'); });
    $(root, '[data-act="one"]').addEventListener('click', () => { emit(1); view.redraw(); });
    $(root, '[data-act="clear"]').addEventListener('click', clear);
    bind($(root, '#young-d'), v => { d = v; rebuild(); clear(); }, v => v.toFixed(1));
    bind($(root, '#young-D'), v => {
      Dpath = v; rebuild(); clear();
      $(root, '[data-out="V"]').textContent = V().toFixed(2);
    }, v => v.toFixed(2));
    bind($(root, '#young-rate'), v => { rate = Math.round(10 ** v); }, v => Math.round(10 ** v) + ' /s');
  }

  /* =====================================================================
     2. Interféromètre de Mach-Zehnder (MZ3/MZ4 du cours).
     P(Dx) = cos²(φ/2), P(Dy) = sin²(φ/2) si les chemins sont indiscernables ; ½ sinon.
     ===================================================================== */
  function machZehnder(root) {
    const stage = $(root, '.lab-stage');
    let phi = 0, whichPath = false, bs2 = true;
    let counts = [0, 0], photon = null, flash = [0, 0], queued = 0;

    const G = { S: [0.05, 0.8], BS1: [0.22, 0.8], Mt: [0.22, 0.32], Mr: [0.68, 0.8], BS2: [0.68, 0.32], Dx: [0.92, 0.32], Dy: [0.68, 0.08], plate: [0.45, 0.32], eye: [0.45, 0.8] };
    const pD = () => (bs2 && !whichPath) ? Math.cos(phi / 2) ** 2 : 0.5;
    const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

    const view = canvas(stage, (ctx, w, h, c) => paint(ctx, w, h, c));

    function paint(ctx, w, h, c) {
      ctx.clearRect(0, 0, w, h);
      const P = k => [G[k][0] * w, G[k][1] * h];
      const s = Math.min(w, h) / 22;
      ctx.lineWidth = 1; ctx.strokeStyle = c.rule;
      const beam = (a, b) => { ctx.beginPath(); ctx.moveTo(...P(a)); ctx.lineTo(...P(b)); ctx.stroke(); };
      beam('S', 'BS1'); beam('BS1', 'Mt'); beam('Mt', 'BS2'); beam('BS1', 'Mr'); beam('Mr', 'BS2'); beam('BS2', 'Dx'); beam('BS2', 'Dy');
      const plate45 = (k, thick, col) => {
        const [x, y] = P(k); ctx.strokeStyle = col; ctx.lineWidth = thick;
        ctx.beginPath(); ctx.moveTo(x - s, y + s); ctx.lineTo(x + s, y - s); ctx.stroke();
      };
      plate45('BS1', 3, D.alpha(c.blue, 0.85));
      if (bs2) plate45('BS2', 3, D.alpha(c.blue, 0.85));
      plate45('Mt', 4, c.ink); plate45('Mr', 4, c.ink);
      const [px, py] = P('plate');                      // lame de phase
      ctx.fillStyle = D.alpha(c.accent, 0.18); ctx.strokeStyle = c.accent; ctx.lineWidth = 1.2;
      ctx.fillRect(px - s * 0.35, py - s * 1.1, s * 0.7, s * 2.2); ctx.strokeRect(px - s * 0.35, py - s * 1.1, s * 0.7, s * 2.2);
      D.text(ctx, 'φ', px, py - s * 1.5, { font: c.serif, color: c.accent, align: 'center' });
      if (whichPath) {                                   // détecteur de chemin
        const [ex, ey] = P('eye');
        ctx.strokeStyle = c.bad; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(ex, ey, s * 0.9, s * 0.55, 0, 0, 2 * Math.PI); ctx.stroke();
        ctx.fillStyle = c.bad; ctx.beginPath(); ctx.arc(ex, ey, s * 0.25, 0, 2 * Math.PI); ctx.fill();
        D.text(ctx, t('détecteur de chemin', 'which-path detector'), ex, ey + s * 1.7, { font: c.sans, color: c.bad, align: 'center' });
      }
      const [sx, sy] = P('S');
      ctx.fillStyle = c.ink; ctx.fillRect(sx - s * 0.6, sy - s * 0.6, s * 1.2, s * 1.2);
      D.text(ctx, t('source', 'source'), sx, sy + s * 1.9, { font: c.sans, color: c.muted, align: 'center' });
      ['Dx', 'Dy'].forEach((k, i) => {
        const [x, y] = P(k);
        ctx.fillStyle = D.alpha(c.accent, Math.min(0.9, flash[i]));
        ctx.beginPath(); ctx.arc(x, y, s * 1.15, 0, 2 * Math.PI); ctx.fill();
        ctx.strokeStyle = c.ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, s * 0.9, 0, 2 * Math.PI); ctx.stroke();
        D.text(ctx, i ? 'Dy' : 'Dx', x + (i ? s * 1.6 : 0), y + (i ? 4 : s * 2.3), { font: c.mono, color: c.ink, align: i ? 'left' : 'center' });
      });
      D.text(ctx, 'BS₁', P('BS1')[0] - s * 2.6, P('BS1')[1] - s * 0.8, { font: c.mono, color: c.muted });
      if (bs2) D.text(ctx, 'BS₂', P('BS2')[0] + s * 1.0, P('BS2')[1] + s * 1.8, { font: c.mono, color: c.muted });
      D.text(ctx, 'M', P('Mt')[0] - s * 2, P('Mt')[1] - s * 0.8, { font: c.mono, color: c.muted });
      D.text(ctx, 'M', P('Mr')[0] + s * 1.0, P('Mr')[1] + s * 1.6, { font: c.mono, color: c.muted });

      if (photon) {
        const glow = (p, a) => {
          const g = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], s * 1.4);
          g.addColorStop(0, D.alpha(c.accent, a)); g.addColorStop(1, D.alpha(c.accent, 0));
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p[0], p[1], s * 1.4, 0, 2 * Math.PI); ctx.fill();
          ctx.fillStyle = D.alpha(c.accent, Math.min(1, a + 0.25)); ctx.beginPath(); ctx.arc(p[0], p[1], s * 0.28, 0, 2 * Math.PI); ctx.fill();
        };
        for (const q of photon.positions(P)) glow(q.p, q.a);
      }
    }

    // trajectoire en 3 temps : source → BS1, bras, BS2 → détecteur
    function launch() {
      const branch = whichPath ? (Math.random() < 0.5 ? 'up' : 'right') : 'both';
      // sans BS₂, chaque bras mène à un seul détecteur : bras du haut → Dx, bras du bas → Dy
      const outcome = (!bs2 && branch !== 'both') ? (branch === 'up' ? 0 : 1) : (Math.random() < pD() ? 0 : 1);
      photon = {
        t: 0, outcome,
        positions(P) {
          const t = this.t;
          if (t < 1) return [{ p: lerp(P('S'), P('BS1'), t), a: 0.9 }];
          if (t < 2) {
            const u = t - 1;
            const up = u < 0.5 ? lerp(P('BS1'), P('Mt'), u * 2) : lerp(P('Mt'), P('BS2'), (u - 0.5) * 2);
            const rt = u < 0.5 ? lerp(P('BS1'), P('Mr'), u * 2) : lerp(P('Mr'), P('BS2'), (u - 0.5) * 2);
            if (branch === 'up') return [{ p: up, a: 0.9 }];
            if (branch === 'right') return [{ p: rt, a: 0.9 }];
            return [{ p: up, a: 0.5 }, { p: rt, a: 0.5 }];   // l'amplitude occupe les deux bras
          }
          return [{ p: lerp(P('BS2'), P(outcome ? 'Dy' : 'Dx'), Math.min(1, t - 2)), a: 0.9 }];
        }
      };
    }

    const anim = loop(stage, dt => {
      flash = flash.map(f => Math.max(0, f - dt * 2.2));
      if (photon) {
        photon.t += dt * 2.4;
        if (photon.t >= 3) {
          counts[photon.outcome]++; flash[photon.outcome] = 1; updateBars();
          photon = null;
          if (queued > 0) { queued--; launch(); }
        }
      }
      paint(view.ctx, view.size().w, view.size().h, view.colors());
    });

    function updateBars() {
      const N = counts[0] + counts[1], p = pD();
      [[0, p], [1, 1 - p]].forEach(([i, th]) => {
        const bar = $(root, `[data-bar="${i}"]`);
        $(bar, '.fill').style.width = (N ? 100 * counts[i] / N : 0) + '%';
        $(bar, '.theory').style.left = `calc(${100 * th}% - 1px)`;
        $(bar, '.val').textContent = counts[i];
      });
      $(root, '[data-out="pth"]').textContent = pct(p);
      $(root, '[data-out="N"]').textContent = N;
    }
    const reset = () => { counts = [0, 0]; updateBars(); };

    $(root, '[data-act="one"]').addEventListener('click', () => { anim.play(); if (photon) queued = Math.min(queued + 1, 20); else launch(); });
    $(root, '[data-act="burst"]').addEventListener('click', () => {
      for (let i = 0; i < 500; i++) counts[Math.random() < pD() ? 0 : 1]++;
      updateBars();
    });
    $(root, '[data-act="reset"]').addEventListener('click', reset);
    bind($(root, '#mz-phi'), v => { phi = v * Math.PI / 180; reset(); view.redraw(); }, v => v + '°');
    $(root, '#mz-which').addEventListener('change', e => { whichPath = e.target.checked; reset(); view.redraw(); });
    $(root, '#mz-bs2').addEventListener('change', e => { bs2 = e.target.checked; reset(); view.redraw(); });
    updateBars();
  }

  /* =====================================================================
     3. Phaseurs : additionner des amplitudes (nombres complexes).
     ===================================================================== */
  function phasors(root) {
    const stage = $(root, '.lab-stage');
    let A = [[0.7, 0], [0.5, 0.5]];       // [re, im]
    let grab = -1;
    const view = canvas(stage, (ctx, w, h, c) => paint(ctx, w, h, c));
    const geo = () => { const { w, h } = view.size(); return { cx: w / 2, cy: h / 2, u: Math.min(w, h) * 0.27 }; };

    function paint(ctx, w, h, c) {
      ctx.clearRect(0, 0, w, h);
      const { cx, cy, u } = geo();
      ctx.strokeStyle = c.rule; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, u, 0, 2 * Math.PI); ctx.stroke();
      ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.arc(cx, cy, 2 * u, 0, 2 * Math.PI); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(w, cy); ctx.moveTo(cx, 0); ctx.lineTo(cx, h); ctx.stroke();
      D.text(ctx, 'Re', w - 8, cy - 6, { font: c.mono, color: c.muted, align: 'right' });
      D.text(ctx, 'Im', cx + 6, 14, { font: c.mono, color: c.muted });
      D.text(ctx, '1', cx + u + 3, cy + 14, { font: c.mono, color: c.muted });
      const S = [A[0][0] + A[1][0], A[0][1] + A[1][1]];
      const toPx = z => [cx + z[0] * u, cy - z[1] * u];
      const p1 = toPx(A[0]), p2 = toPx(A[1]), ps = toPx(S);
      ctx.lineWidth = 2;
      ctx.strokeStyle = D.alpha(c.ink, 0.3); ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(...p2); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = c.blue; ctx.fillStyle = c.blue; D.arrow(ctx, cx, cy, ...p1, 9);
      ctx.strokeStyle = c.ink; ctx.fillStyle = c.ink; D.arrow(ctx, ...p1, ...ps, 9);
      if (Math.hypot(...S) > 0.02) { ctx.strokeStyle = c.accent; ctx.fillStyle = c.accent; ctx.lineWidth = 3; D.arrow(ctx, cx, cy, ...ps, 11); }
      [[p1, c.blue, 'A₁'], [p2, c.ink, t('A₂ (glisser)', 'A₂ (drag)')]].forEach(([p, col, l]) => {
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(p[0], p[1], 7, 0, 2 * Math.PI); ctx.fill();
        D.text(ctx, l, p[0] + 10, p[1] - 10, { font: c.serif, color: col });
      });
      D.text(ctx, 'A₁ + A₂', ps[0] + 10, ps[1] + 18, { font: c.serif, color: c.accent });
      readout(S);
    }
    function readout(S) {
      const m2 = z => z[0] * z[0] + z[1] * z[1];
      const pol = z => `${Math.sqrt(m2(z)).toFixed(2)} ∠ ${Math.round(Math.atan2(z[1], z[0]) * 180 / Math.PI)}°`;
      $(root, '[data-out="a1"]').textContent = pol(A[0]);
      $(root, '[data-out="a2"]').textContent = pol(A[1]);
      $(root, '[data-out="cl"]').textContent = (m2(A[0]) + m2(A[1])).toFixed(3);
      $(root, '[data-out="qu"]').textContent = m2(S).toFixed(3);
      $(root, '[data-out="int"]').textContent = (2 * (A[0][0] * A[1][0] + A[0][1] * A[1][1])).toFixed(3);
    }
    const handle = i => { const { cx, cy, u } = geo(); return [cx + A[i][0] * u, cy - A[i][1] * u]; };
    drag(stage, {
      start: p => {
        const d = [0, 1].map(i => Math.hypot(p.x - handle(i)[0], p.y - handle(i)[1]));
        const m = Math.min(...d);
        grab = m < 40 ? d.indexOf(m) : -1;
      },
      move: p => {
        if (grab < 0) return;
        const { cx, cy, u } = geo();
        let z = [(p.x - cx) / u, (cy - p.y) / u];
        const r = Math.hypot(...z);
        if (r > 1.4) z = z.map(x => x * 1.4 / r);
        A[grab] = z; view.redraw();
      },
      end: () => { grab = -1; }
    });
    const presets = { plus: [[1, 0], [1, 0]], minus: [[1, 0], [-1, 0]], i: [[1, 0], [0, 1]], mz: [[-0.5, 0], [-0.5, 0]] };
    root.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => {
      const target = presets[b.dataset.preset];
      const from = A.map(z => z.slice());
      const t0 = performance.now();
      const step = now => {               // transition douce vers le préréglage
        const k = Math.min(1, (now - t0) / 450), e = 1 - (1 - k) ** 3;
        A = from.map((z, i) => [z[0] + (target[i][0] - z[0]) * e, z[1] + (target[i][1] - z[1]) * e]);
        view.redraw();
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }));
  }

  /* =====================================================================
     4. Qubit : |ψ⟩ = cos(θ/2)|0⟩ + e^{iφ} sin(θ/2)|1⟩ et mesure projective.
     ===================================================================== */
  function qubit(root) {
    const stage = $(root, '.lab-stage');
    const st = { theta: Math.PI / 3, phi: Math.PI / 4, vec: null };
    const viewAngles = { yaw: -0.55, elev: 0.32 };
    let basis = 'Z', counts = [0, 0], busy = false;
    const view = canvas(stage, (ctx, w, h, c) => window.Bloch.draw(ctx, w, h, c, { ...st, view: viewAngles }));
    window.Bloch.orbit(stage, viewAngles, () => view.redraw());

    const axis = { Z: [0, 0, 1], X: [1, 0, 0], Y: [0, 1, 0] };
    const labels = { Z: ['|0⟩', '|1⟩'], X: ['|+⟩', '|−⟩'], Y: ['|+i⟩', '|−i⟩'] };
    const bloch = () => window.Bloch.fromAngles(st.theta, st.phi);
    const pPlus = () => { const r = bloch(), a = axis[basis]; return (1 + r[0] * a[0] + r[1] * a[1] + r[2] * a[2]) / 2; };

    function text() {
      const a = Math.cos(st.theta / 2), b = Math.sin(st.theta / 2);
      const re = b * Math.cos(st.phi), im = b * Math.sin(st.phi);
      $(root, '[data-out="alpha"]').textContent = a.toFixed(3);
      $(root, '[data-out="beta"]').textContent = `${re.toFixed(3)} ${im < 0 ? '−' : '+'} ${Math.abs(im).toFixed(3)}i`;
      $(root, '[data-out="p0"]').textContent = (a * a).toFixed(3);
      $(root, '[data-out="p1"]').textContent = (b * b).toFixed(3);
    }
    function bars() {
      const N = counts[0] + counts[1], p = pPlus();
      [[0, p], [1, 1 - p]].forEach(([i, th]) => {
        const bar = $(root, `[data-bar="${i}"]`);
        $(bar, '.k').textContent = labels[basis][i];
        $(bar, '.fill').style.width = (N ? 100 * counts[i] / N : 0) + '%';
        $(bar, '.theory').style.left = `calc(${100 * th}% - 1px)`;
        $(bar, '.val').textContent = counts[i];
      });
    }
    const thetaIn = $(root, '#q-theta'), phiIn = $(root, '#q-phi');
    const changed = () => { st.vec = null; counts = [0, 0]; text(); bars(); view.redraw(); };
    bind(thetaIn, v => { st.theta = v * Math.PI / 180; changed(); }, v => v + '°');
    bind(phiIn, v => { st.phi = v * Math.PI / 180; changed(); }, v => v + '°');
    seg($(root, '[data-seg="basis"]'), v => { basis = v; counts = [0, 0]; bars(); });
    const presets = { '0': [0, 0], '1': [180, 0], '+': [90, 0], '-': [90, 180], '+i': [90, 90], '-i': [90, 270] };
    root.querySelectorAll('[data-state]').forEach(b => b.addEventListener('click', () => {
      const [th, ph] = presets[b.dataset.state];
      thetaIn.value = th; phiIn.value = ph;
      thetaIn.dispatchEvent(new Event('input')); phiIn.dispatchEvent(new Event('input'));
    }));

    // une mesure : le vecteur bascule vers le résultat obtenu (projection), puis on re-prépare |ψ⟩
    $(root, '[data-act="measure"]').addEventListener('click', () => {
      if (busy) return;
      busy = true;
      const plus = Math.random() < pPlus();
      counts[plus ? 0 : 1]++; bars();
      const target = axis[basis].map(x => plus ? x : -x);
      const start = bloch(), t0 = performance.now();
      const out = $(root, '[data-out="last"]');
      out.textContent = t(`Résultat : ${labels[basis][plus ? 0 : 1]}. L’état est projeté sur ce vecteur.`, `Outcome: ${labels[basis][plus ? 0 : 1]}. The state is projected onto this vector.`);
      const step = now => {
        const k = Math.min(1, (now - t0) / 380), e = k * k * (3 - 2 * k);
        const v = start.map((s, i) => s + (target[i] - s) * e), nrm = Math.hypot(...v) || 1;
        st.vec = v.map(x => x / nrm); view.redraw();
        if (k < 1) requestAnimationFrame(step);
        else setTimeout(() => { st.vec = null; busy = false; view.redraw(); }, 900);
      };
      requestAnimationFrame(step);
    });
    $(root, '[data-act="many"]').addEventListener('click', () => {
      const p = pPlus();
      for (let i = 0; i < 1000; i++) counts[Math.random() < p ? 0 : 1]++;
      bars();
      $(root, '[data-out="last"]').textContent = t(`${(counts[0] + counts[1]).toLocaleString(LOCALE)} copies identiques mesurées.`, `${(counts[0] + counts[1]).toLocaleString(LOCALE)} identical copies measured.`);
    });
    text(); bars();
  }

  const labs = { young, mz: machZehnder, phasors, qubit };
  document.querySelectorAll('[data-lab]').forEach(el => { const f = labs[el.dataset.lab]; if (f) f(el); });
})();

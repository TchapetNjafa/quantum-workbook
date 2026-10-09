/* Chapitre 2 — laboratoires : Stern-Gerlach en cascade, opérateur σn et mesure, indétermination de Robertson. */
(() => {
  'use strict';
  const { canvas, loop, bind, seg, draw: D } = window.Lab;
  const $ = (root, s) => root.querySelector(s);
  const pct = p => (100 * p).toFixed(1) + ' %';
  const RAD = Math.PI / 180;
  const num = (x, d = 3) => (Math.abs(x) < 0.5 * 10 ** -d ? 0 : x).toFixed(d).replace('-', '−');
  /** nombre complexe re + i·im en texte court */
  function cplx(re, im, d = 3) {
    const r0 = Math.abs(re) < 5e-4, i0 = Math.abs(im) < 5e-4;
    if (i0) return num(re, d);
    if (r0) return num(im, d) + 'i';
    return `${num(re, d)} ${im < 0 ? '−' : '+'} ${Math.abs(im).toFixed(d)}i`;
  }
  function setBars(root, counts, theory, labels) {
    const N = counts[0] + counts[1];
    [0, 1].forEach(i => {
      const bar = $(root, `[data-bar="${i}"]`);
      if (labels) $(bar, '.k').textContent = labels[i];
      $(bar, '.fill').style.width = (N ? 100 * counts[i] / N : 0) + '%';
      $(bar, '.theory').style.left = `calc(${100 * (i ? 1 - theory : theory)}% - 1px)`;
      $(bar, '.val').textContent = counts[i];
    });
  }

  /* =====================================================================
     1. Stern-Gerlach en cascade (orientations dans le plan xz).
     Un appareil d'angle a (compté depuis +z vers +x) mesure Sn, n = (sin a, 0, cos a).
     Atome de spin orienté selon d : P(+) = cos²((a − d)/2). Jet issu du four : mélange, P(+) = ½.
     ===================================================================== */
  function sternGerlach(root) {
    const stage = $(root, '.lab-stage');
    const ang = [0, 90, 0], keep = ['+', '+'];
    let n = 3, atoms = [], carry = 0, rate = 9;
    let sent = 0, done = 0, blocked = [0, 0], fin = [0, 0], flash = [0, 0];

    const pPlus = (d, a) => d === null ? 0.5 : Math.cos((a - d) * RAD / 2) ** 2;
    function fate() {
      let d = null; const path = [];
      for (let k = 0; k < n; k++) {
        const plus = Math.random() < pPlus(d, ang[k]);
        path.push(plus);
        if (k < n - 1 && (plus ? '+' : '-') !== keep[k]) return { path, stop: k };
        d = plus ? ang[k] : ang[k] + 180;
      }
      return { path, stop: -1 };
    }
    function theory() {
      let d = null, reach = 1;
      for (let k = 0; k < n - 1; k++) {
        const p = pPlus(d, ang[k]), plus = keep[k] === '+';
        reach *= plus ? p : 1 - p;
        d = plus ? ang[k] : ang[k] + 180;
      }
      return { reach, pLast: pPlus(d, ang[n - 1]) };
    }
    function tally(f) {
      done++;
      if (f.stop >= 0) blocked[f.stop]++;
      else { const i = f.path[n - 1] ? 0 : 1; fin[i]++; flash[i] = 1; }
    }

    // géométrie en coordonnées normalisées (x/w, y/h)
    const geo = () => {
      const xs = n === 3 ? [0.24, 0.5, 0.76] : [0.3, 0.62];
      return { xs, bw: 0.1, y0: 0.47, dy: 0.2, xc: 0.93 };
    };
    function waypoints(f) {
      const { xs, bw, y0, dy, xc } = geo();
      const pts = [[0.04, y0]];
      for (let k = 0; k < f.path.length; k++) {
        const s = f.path[k] ? -1 : 1, x1 = xs[k] - bw / 2, x2 = xs[k] + bw / 2;
        pts.push([x1, y0], [x2, y0 + s * dy * 0.3]);
        if (k === n - 1) pts.push([xc - 0.03, y0 + s * dy]);
        else if (k === f.stop) pts.push([x2 + 0.07, y0 + s * dy * 0.75]);
        else pts.push([(x2 + xs[k + 1] - bw / 2) / 2, y0 + s * dy * 0.75]);
      }
      return pts;
    }

    const view = canvas(stage, (ctx, w, h, c) => paint(ctx, w, h, c));
    const dirLabel = a => ({ 0: 'z', 90: 'x', 180: '−z', 270: '−x' })[a] || `${a}°`;

    function paint(ctx, w, h, c) {
      ctx.clearRect(0, 0, w, h);
      const { xs, bw, y0, dy, xc } = geo();
      const X = x => x * w, Y = y => y * h, s = Math.min(w, h) / 24;
      // faisceaux
      ctx.lineWidth = 1.2; ctx.strokeStyle = c.rule;
      const line = pts => { ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1]))); ctx.stroke(); };
      line([[0.04, y0], [xs[0] - bw / 2, y0]]);
      for (let k = 0; k < n; k++) {
        const x2 = xs[k] + bw / 2;
        [-1, 1].forEach(sg => {
          const kept = k === n - 1 || (sg < 0) === (keep[k] === '+');
          if (k === n - 1) line([[x2, y0 + sg * dy * 0.3], [xc - 0.03, y0 + sg * dy]]);
          else if (kept) line([[x2, y0 + sg * dy * 0.3], [(x2 + xs[k + 1] - bw / 2) / 2, y0 + sg * dy * 0.75], [xs[k + 1] - bw / 2, y0]]);
          else {
            line([[x2, y0 + sg * dy * 0.3], [x2 + 0.07, y0 + sg * dy * 0.75]]);
            ctx.fillStyle = c.ink;                           // cache qui bloque la voie
            ctx.fillRect(X(x2 + 0.07) - 2, Y(y0 + sg * dy * 0.75) - s * 0.9, 5, s * 1.8);
            D.text(ctx, `${blocked[k]} bloqués`, X(x2 + 0.07), Y(y0 + sg * dy * 0.75) + sg * s * 1.9 + (sg > 0 ? 6 : 0), { font: c.sans, color: c.muted, align: 'center' });
            ctx.strokeStyle = c.rule;
          }
        });
      }
      // source (four)
      ctx.fillStyle = c.ink; ctx.fillRect(X(0.04) - s * 0.7, Y(y0) - s * 0.9, s * 1.4, s * 1.8);
      D.text(ctx, 'four', X(0.04), Y(y0) + s * 2.2, { font: c.sans, color: c.muted, align: 'center' });
      // appareils
      for (let k = 0; k < n; k++) {
        const x = X(xs[k] - bw / 2), bwp = bw * w, top = Y(y0) - s * 1.6, hh = s * 3.2;
        ctx.fillStyle = c.paper2; ctx.strokeStyle = c.ink; ctx.lineWidth = 1.4;
        ctx.fillRect(x, top, bwp, hh); ctx.strokeRect(x, top, bwp, hh);
        // pièces polaires : N pointu en haut, S plat en bas
        ctx.fillStyle = D.alpha(c.blue, 0.75);
        ctx.beginPath(); ctx.moveTo(x + 3, top + 3); ctx.lineTo(x + bwp - 3, top + 3); ctx.lineTo(x + bwp / 2, top + hh * 0.36); ctx.closePath(); ctx.fill();
        ctx.fillRect(x + 3, top + hh * 0.72, bwp - 6, hh * 0.28 - 3);
        D.text(ctx, `SG${'₁₂₃'[k]}`, X(xs[k]), top - 8, { font: c.mono, color: c.ink, align: 'center' });
        // cadran : direction mesurée dans le plan xz (z vers le haut, x vers la droite)
        const cx = X(xs[k]), cy = Y(0.85), r = Math.min(s * 1.5, h * 0.07);
        ctx.strokeStyle = c.rule; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, 2 * Math.PI); ctx.stroke();
        ctx.strokeStyle = c.accent; ctx.fillStyle = c.accent; ctx.lineWidth = 2;
        D.arrow(ctx, cx, cy, cx + r * Math.sin(ang[k] * RAD), cy - r * Math.cos(ang[k] * RAD), 6);
        D.text(ctx, dirLabel(ang[k]), cx + r + 6, cy + 4, { font: c.mono, color: c.ink });
      }
      // compteurs finaux
      ['+', '−'].forEach((l, i) => {
        const cx = X(xc), cy = Y(y0 + (i ? 1 : -1) * dy), r = s * 1.1;
        ctx.fillStyle = D.alpha(c.accent, Math.min(0.85, flash[i]));
        ctx.beginPath(); ctx.arc(cx, cy, r * 1.25, 0, 2 * Math.PI); ctx.fill();
        ctx.strokeStyle = c.ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 2 * Math.PI); ctx.stroke();
        D.text(ctx, l, cx, cy + 5, { font: c.mono, color: c.ink, align: 'center' });
        D.text(ctx, String(fin[i]), cx, cy + (i ? r + 18 : -r - 8), { font: c.mono, color: c.ink, align: 'center' });
      });
      // atomes en vol
      ctx.fillStyle = c.accent;
      for (const a of atoms) {
        const p = a.pos(w, h);
        ctx.beginPath(); ctx.arc(p[0], p[1], 2.6, 0, 2 * Math.PI); ctx.fill();
      }
    }

    function launch() {
      const f = fate(), pts = waypoints(f);
      atoms.push({
        f, pts, d: 0,
        pos(w, h) {                                   // position à la distance parcourue d (pixels)
          let rest = this.d;
          for (let i = 1; i < pts.length; i++) {
            const ax = pts[i - 1][0] * w, ay = pts[i - 1][1] * h, bx = pts[i][0] * w, by = pts[i][1] * h;
            const L = Math.hypot(bx - ax, by - ay);
            if (rest <= L) return [ax + (bx - ax) * rest / L, ay + (by - ay) * rest / L];
            rest -= L;
          }
          this.done = true;
          return [pts[pts.length - 1][0] * w, pts[pts.length - 1][1] * h];
        }
      });
      sent++;
    }

    const anim = loop(stage, dt => {
      const { w, h } = view.size();
      carry += rate * dt;
      while (carry >= 1 && atoms.length < 120) { carry--; launch(); }
      flash = flash.map(f => Math.max(0, f - dt * 2.5));
      for (const a of atoms) { a.d += dt * w * 0.32; a.pos(w, h); if (a.done) tally(a.f); }
      atoms = atoms.filter(a => !a.done);
      paint(view.ctx, w, h, view.colors());
      update();
    });

    function update() {
      const th = theory(), N = fin[0] + fin[1];
      setBars(root, fin, th.pLast);
      $(root, '[data-out="sent"]').textContent = sent.toLocaleString('fr-FR');
      $(root, '[data-out="frac"]').textContent = done ? pct(N / done) : '—';
      $(root, '[data-out="reach"]').textContent = pct(th.reach);
      $(root, '[data-out="plast"]').textContent = pct(th.pLast);
    }
    function reset() {
      atoms = []; sent = 0; done = 0; blocked = [0, 0]; fin = [0, 0]; carry = 0;
      update(); view.redraw();
    }

    const playBtn = $(root, '[data-act="play"]');
    const label = () => { playBtn.textContent = anim.running ? 'Pause' : 'Lancer le jet'; };
    playBtn.addEventListener('click', () => { anim.toggle(); label(); });
    $(root, '[data-act="burst"]').addEventListener('click', () => {
      for (let i = 0; i < 1000; i++) { tally(fate()); sent++; }
      flash = [0, 0]; update(); view.redraw();
    });
    $(root, '[data-act="reset"]').addEventListener('click', reset);

    const inputs = [0, 1, 2].map(k => $(root, `#sg-a${k + 1}`));
    const fmtA = v => ({ 0: '0° (z)', 90: '90° (x)', 180: '180° (−z)', 270: '270° (−x)' })[v] || v + '°';
    inputs.forEach((inp, k) => bind(inp, v => { ang[k] = v; reset(); }, fmtA));
    [0, 1].forEach(k => seg($(root, `[data-seg="keep${k}"]`), v => { keep[k] = v; reset(); }));
    const show = () => root.querySelectorAll('[data-only3]').forEach(el => { el.style.display = n === 3 ? '' : 'none'; });
    seg($(root, '[data-seg="n"]'), v => { n = +v; show(); reset(); });

    const presets = {
      zz: [2, [0, 0], ['+']], zx: [2, [0, 90], ['+']],
      zxz: [3, [0, 90, 0], ['+', '+']], zthx: [3, [0, 60, 90], ['+', '+']]
    };
    const pressSeg = (sel, v) => { const b = $(root, `[data-seg="${sel}"] [data-v="${v}"]`); if (b) b.click(); };
    root.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => {
      const [nn, as, ks] = presets[b.dataset.preset];
      pressSeg('n', nn);
      as.forEach((a, k) => { inputs[k].value = a; inputs[k].dispatchEvent(new Event('input')); });
      ks.forEach((v, k) => pressSeg(`keep${k}`, v));
    }));
    label(); update();
  }

  /* =====================================================================
     2. Opérateur σn = n·σ, ses vecteurs propres et la mesure.
     σn = [[cosθ, sinθ e^{−iφ}], [sinθ e^{iφ}, −cosθ]] ;  |n+⟩ = (cos θ/2, e^{iφ} sin θ/2),
     |n−⟩ = (sin θ/2, −e^{iφ} cos θ/2) ;  ⟨σn⟩ = r·n ;  P(+1) = (1 + r·n)/2 ;  Δσn = √(1 − ⟨σn⟩²).
     ===================================================================== */
  function operator(root) {
    const stage = $(root, '.lab-stage');
    const nA = { theta: 90 * RAD, phi: 0 }, st = { theta: 0, phi: 0, vec: null };
    const viewAngles = { yaw: -0.55, elev: 0.32 };
    let counts = [0, 0], busy = false;
    const B = window.Bloch;
    const nVec = () => B.fromAngles(nA.theta, nA.phi);
    const rVec = () => B.fromAngles(st.theta, st.phi);
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const mean = () => dot(rVec(), nVec());

    const view = canvas(stage, (ctx, w, h, c) => {
      B.draw(ctx, w, h, c, { ...st, view: viewAngles });
      const R = Math.min(w, h) * 0.36, cx = w / 2, cy = h / 2 + 4;
      const P = p => B.project(p, viewAngles, cx, cy, R);
      const nv = nVec(), a = P(nv.map(x => -x * 1.12)), b = P(nv.map(x => x * 1.12));
      ctx.strokeStyle = c.blue; ctx.fillStyle = c.blue; ctx.lineWidth = 1.6;
      D.arrow(ctx, a.x, a.y, b.x, b.y, 8);
      D.text(ctx, 'n', b.x + 8, b.y - 4, { font: c.serif, color: c.blue });
      [[nv, '|n+⟩'], [nv.map(x => -x), '|n−⟩']].forEach(([v, l]) => {
        const q = P(v);
        ctx.fillStyle = c.blue; ctx.beginPath(); ctx.arc(q.x, q.y, 4, 0, 2 * Math.PI); ctx.fill();
        D.text(ctx, l, q.x - 8, q.y + 16, { font: c.mono, color: c.blue, align: 'right' });
      });
    });
    B.orbit(stage, viewAngles, () => view.redraw());

    const out = k => $(root, `[data-out="${k}"]`);
    function text() {
      const t = nA.theta, f = nA.phi, ct = Math.cos(t), stt = Math.sin(t);
      out('m00').textContent = num(ct);
      out('m01').textContent = cplx(stt * Math.cos(f), -stt * Math.sin(f));
      out('m10').textContent = cplx(stt * Math.cos(f), stt * Math.sin(f));
      out('m11').textContent = num(-ct);
      const c2 = Math.cos(t / 2), s2 = Math.sin(t / 2);
      out('vp').textContent = `(${num(c2)}, ${cplx(s2 * Math.cos(f), s2 * Math.sin(f))})`;
      out('vm').textContent = `(${num(s2)}, ${cplx(-c2 * Math.cos(f), -c2 * Math.sin(f))})`;
      const m = mean();
      out('mean').textContent = num(m);
      out('p').textContent = pct((1 + m) / 2);
      out('dev').textContent = num(Math.sqrt(Math.max(0, 1 - m * m)));
    }
    function bars() {
      setBars(root, counts, (1 + mean()) / 2);
      const N = counts[0] + counts[1];
      out('emp').textContent = N ? num((counts[0] - counts[1]) / N) : '—';
    }
    const changed = () => { st.vec = null; counts = [0, 0]; text(); bars(); view.redraw(); };
    const ins = { nt: $(root, '#op-nt'), np: $(root, '#op-np'), st: $(root, '#op-st'), sp: $(root, '#op-sp') };
    bind(ins.nt, v => { nA.theta = v * RAD; changed(); }, v => v + '°');
    bind(ins.np, v => { nA.phi = v * RAD; changed(); }, v => v + '°');
    bind(ins.st, v => { st.theta = v * RAD; changed(); }, v => v + '°');
    bind(ins.sp, v => { st.phi = v * RAD; changed(); }, v => v + '°');
    const setIn = (el, v) => { el.value = v; el.dispatchEvent(new Event('input')); };
    const axes = { z: [0, 0], x: [90, 0], y: [90, 90] };
    root.querySelectorAll('[data-axis]').forEach(b => b.addEventListener('click', () => {
      const [t, p] = axes[b.dataset.axis]; setIn(ins.nt, t); setIn(ins.np, p);
    }));
    $(root, '[data-act="align"]').addEventListener('click', () => { setIn(ins.st, ins.nt.value); setIn(ins.sp, ins.np.value); });

    $(root, '[data-act="measure"]').addEventListener('click', () => {
      if (busy) return;
      busy = true;
      const plus = Math.random() < (1 + mean()) / 2;
      counts[plus ? 0 : 1]++; bars();
      const target = nVec().map(x => plus ? x : -x), start = rVec(), t0 = performance.now();
      out('last').textContent = `Résultat : ${plus ? '+1' : '−1'}. L’état devient ${plus ? '|n+⟩' : '|n−⟩'}.`;
      const step = now => {
        const k = Math.min(1, (now - t0) / 380), e = k * k * (3 - 2 * k);
        let v = start.map((s0, i) => s0 + (target[i] - s0) * e);
        const nrm = Math.hypot(...v);
        v = nrm > 1e-6 ? v.map(x => x / nrm) : target;
        st.vec = v; view.redraw();
        if (k < 1) requestAnimationFrame(step);
        else setTimeout(() => { st.vec = null; busy = false; view.redraw(); }, 900);
      };
      requestAnimationFrame(step);
    });
    $(root, '[data-act="many"]').addEventListener('click', () => {
      const p = (1 + mean()) / 2;
      for (let i = 0; i < 1000; i++) counts[Math.random() < p ? 0 : 1]++;
      bars();
      out('last').textContent = `${(counts[0] + counts[1]).toLocaleString('fr-FR')} copies de |ψ⟩ mesurées.`;
    });
    text(); bars();
  }

  /* =====================================================================
     3. Indétermination de Robertson pour σx et σy.
     ⟨σi⟩ = ri ; Δσx = √(1 − rx²), Δσy = √(1 − ry²) ; borne ½|⟨[σx,σy]⟩| = |⟨σz⟩| = |cos θ|.
     ===================================================================== */
  function robertson(root) {
    const stage = $(root, '.lab-stage');
    const st = { theta: 50 * RAD, phi: 30 * RAD };
    const viewAngles = { yaw: -0.55, elev: 0.32 };
    const B = window.Bloch;
    const prod = (t, f) => Math.sqrt(Math.max(0, (1 - (Math.sin(t) * Math.cos(f)) ** 2) * (1 - (Math.sin(t) * Math.sin(f)) ** 2)));
    const view = canvas(stage, (ctx, w, h, c) => paint(ctx, w, h, c));

    function paint(ctx, w, h, c) {
      const ws = Math.round(w * (w < 560 ? 0.42 : 0.4));
      B.draw(ctx, ws, h, c, { ...st, view: viewAngles });
      ctx.clearRect(ws, 0, w - ws, h);
      // graphe Δσx·Δσy et borne |cos θ| en fonction de θ, à φ fixé
      const L = ws + 34, Rr = w - 26, T = 18, Bt = h - 34;
      const px = t => L + (t / Math.PI) * (Rr - L), py = v => Bt - v * (Bt - T);
      ctx.strokeStyle = c.rule; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(L, T); ctx.lineTo(L, Bt); ctx.lineTo(Rr, Bt); ctx.stroke();
      [0, 0.5, 1].forEach(v => D.text(ctx, String(v).replace('.', ','), L - 6, py(v) + 4, { font: c.mono, color: c.muted, align: 'right' }));
      [[0, '0'], [Math.PI / 2, '90°'], [Math.PI, '180°']].forEach(([t, l]) => D.text(ctx, l, px(t), Bt + 15, { font: c.mono, color: c.muted, align: 'center' }));
      D.text(ctx, 'θ', Rr + 8, Bt + 5, { font: c.serif, color: c.muted });
      const M = 160;
      ctx.fillStyle = D.alpha(c.accent, 0.1);                 // zone interdite par la borne
      ctx.beginPath(); ctx.moveTo(px(0), py(0));
      for (let i = 0; i <= M; i++) { const t = Math.PI * i / M; ctx.lineTo(px(t), py(Math.abs(Math.cos(t)))); }
      ctx.lineTo(px(Math.PI), py(0)); ctx.closePath(); ctx.fill();
      D.text(ctx, 'interdit', px(Math.PI * 0.12), py(0.12), { font: c.sans, color: c.accent });
      ctx.strokeStyle = c.accent; ctx.lineWidth = 1.6; ctx.setLineDash([5, 4]);
      ctx.beginPath();
      for (let i = 0; i <= M; i++) { const t = Math.PI * i / M, X = px(t), Y = py(Math.abs(Math.cos(t))); if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); }
      ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = c.ink; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i <= M; i++) { const t = Math.PI * i / M, X = px(t), Y = py(prod(t, st.phi)); if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); }
      ctx.stroke();
      const x = px(st.theta);
      ctx.fillStyle = c.ink; ctx.beginPath(); ctx.arc(x, py(prod(st.theta, st.phi)), 5, 0, 2 * Math.PI); ctx.fill();
      ctx.fillStyle = c.accent; ctx.beginPath(); ctx.arc(x, py(Math.abs(Math.cos(st.theta))), 4, 0, 2 * Math.PI); ctx.fill();
      D.text(ctx, `φ = ${Math.round(((st.phi / RAD) % 360 + 360) % 360)}°`, Rr, T + 2, { font: c.mono, color: c.muted, align: 'right' });
    }

    const out = k => $(root, `[data-out="${k}"]`);
    function text() {
      const r = B.fromAngles(st.theta, st.phi);
      const dx = Math.sqrt(Math.max(0, 1 - r[0] ** 2)), dy = Math.sqrt(Math.max(0, 1 - r[1] ** 2));
      out('sx').textContent = num(r[0]); out('sy').textContent = num(r[1]); out('sz').textContent = num(r[2]);
      out('dx').textContent = num(dx); out('dy').textContent = num(dy);
      out('prod').textContent = num(dx * dy); out('bound').textContent = num(Math.abs(r[2]));
    }
    const thIn = $(root, '#rb-t'), phIn = $(root, '#rb-p');
    bind(thIn, v => { st.theta = v * RAD; text(); view.redraw(); }, v => v + '°');
    bind(phIn, v => { st.phi = v * RAD; text(); view.redraw(); }, v => v + '°');

    let t0 = 0;
    const anim = loop(stage, (dt, t) => {             // l'état décrit une trajectoire lente sur la sphère
      t0 += dt;
      st.theta = Math.PI / 2 + 0.47 * Math.PI * Math.sin(0.45 * t0);
      st.phi = (st.phi + 0.7 * dt) % (2 * Math.PI);
      thIn.value = Math.round(st.theta / RAD); phIn.value = Math.round(st.phi / RAD) % 360;
      $(root, 'output[for="rb-t"]').textContent = thIn.value + '°';
      $(root, 'output[for="rb-p"]').textContent = phIn.value + '°';
      text(); view.redraw();
    }, { autoplay: false });
    const btn = $(root, '[data-act="move"]');
    btn.addEventListener('click', () => {
      const u = Math.max(-1, Math.min(1, (st.theta - Math.PI / 2) / (0.47 * Math.PI)));
      t0 = Math.asin(u) / 0.45;                      // reprendre la trajectoire depuis l'état courant
      const on = anim.toggle(); btn.textContent = on ? 'Arrêter' : 'Faire bouger l’état'; });
    text();
  }

  const labs = { sg: sternGerlach, op: operator, rb: robertson };
  document.querySelectorAll('[data-lab]').forEach(el => { const f = labs[el.dataset.lab]; if (f) f(el); });
})();

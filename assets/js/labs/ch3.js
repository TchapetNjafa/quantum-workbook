/* Chapitre 3 — laboratoires : postulats en action, précession de Larmor, oscillations de Rabi, franges de Ramsey.
   Conventions : r = (sinθ cosφ, sinθ sinφ, cosθ), |0⟩ au pôle nord.
   Pour H = (ħ/2) w·σ, le vecteur de Bloch obéit à dr/dt = w × r : rotation d'angle |w|t autour de w (sens direct). */
(() => {
  'use strict';
  const { canvas, loop, bind, seg, draw: D } = window.Lab;
  const B = window.Bloch;
  const $ = (root, s) => root.querySelector(s);
  const fr = (x, d = 3) => x.toFixed(d).replace('-', '−');

  /* ---------- outils communs ---------- */
  const norm = v => { const n = Math.hypot(...v) || 1; return v.map(x => x / n); };
  /** Rotation de v d'un angle a autour de l'axe unitaire n (formule de Rodrigues). */
  function rot(v, n, a) {
    const c = Math.cos(a), s = Math.sin(a), d = (1 - c) * (n[0] * v[0] + n[1] * v[1] + n[2] * v[2]);
    const x = [n[1] * v[2] - n[2] * v[1], n[2] * v[0] - n[0] * v[2], n[0] * v[1] - n[1] * v[0]];
    return [0, 1, 2].map(i => v[i] * c + x[i] * s + n[i] * d);
  }

  /** Flèche d'axe de rotation dessinée par-dessus la sphère (même géométrie que Bloch.draw). */
  function axisArrow(ctx, w, h, c, view, u, label) {
    const R = Math.min(w, h) * 0.36, cx = w / 2, cy = h / 2 + 4;
    const a1 = B.project(u.map(x => -x * 1.1), view, cx, cy, R), a2 = B.project(u.map(x => x * 1.1), view, cx, cy, R);
    ctx.strokeStyle = c.blue; ctx.fillStyle = c.blue; ctx.lineWidth = 1.5;
    D.arrow(ctx, a1.x, a1.y, a2.x, a2.y, 7);
    D.text(ctx, label, a2.x + 8, a2.y - 4, { font: c.serif, color: c.blue });
  }

  /** Petit tracé de courbes : o = {x0,x1,y0,y1,xlabel,yticks,series:[{f,color,dash,width}],dots,cursor,vlines}. */
  function plot(ctx, w, h, c, o) {
    ctx.clearRect(0, 0, w, h);
    const L = 34, Rm = 10, T = 12, Bm = 26, W = w - L - Rm, H = h - T - Bm;
    const X = x => L + (x - o.x0) / (o.x1 - o.x0) * W;
    const Y = y => T + (1 - (y - o.y0) / (o.y1 - o.y0)) * H;
    ctx.lineWidth = 1; ctx.strokeStyle = c.rule;
    for (const yt of o.yticks) {
      ctx.beginPath(); ctx.moveTo(L, Y(yt) + 0.5); ctx.lineTo(L + W, Y(yt) + 0.5); ctx.stroke();
      D.text(ctx, fr(yt, Number.isInteger(yt) ? 0 : 1), L - 6, Y(yt) + 4, { font: c.mono, color: c.muted, align: 'right' });
    }
    D.text(ctx, o.xlabel, L + W, h - 6, { font: c.sans, color: c.muted, align: 'right' });
    if (o.x0label !== undefined) D.text(ctx, o.x0label, L, h - 6, { font: c.mono, color: c.muted });
    (o.vlines || []).forEach((v, j) => {
      if (v.x < o.x0 || v.x > o.x1) return;
      ctx.strokeStyle = D.alpha(c.ink2, 0.5); ctx.setLineDash([2, 3]);
      ctx.beginPath(); ctx.moveTo(X(v.x) + 0.5, T); ctx.lineTo(X(v.x) + 0.5, T + H); ctx.stroke(); ctx.setLineDash([]);
      D.text(ctx, v.label, X(v.x) + 3, T + 11 + 13 * j, { font: c.mono, color: c.ink2 });
    });
    for (const s of o.series) {
      ctx.strokeStyle = s.color; ctx.lineWidth = s.width || 2; ctx.setLineDash(s.dash || []);
      ctx.beginPath();
      const N = s.n || 300;
      for (let i = 0; i <= N; i++) {
        const x = o.x0 + (o.x1 - o.x0) * i / N, y = Y(Math.max(o.y0, Math.min(o.y1, s.f(x))));
        if (i) ctx.lineTo(X(x), y); else ctx.moveTo(X(x), y);
      }
      ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.fillStyle = c.ink;
    for (const [x, y] of o.dots || []) { ctx.beginPath(); ctx.arc(X(x), Y(y), 3, 0, 2 * Math.PI); ctx.fill(); }
    if (o.cursor !== undefined) {
      const { x, y } = o.cursor;
      ctx.strokeStyle = D.alpha(c.accent, 0.5); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(X(x) + 0.5, T); ctx.lineTo(X(x) + 0.5, T + H); ctx.stroke();
      ctx.fillStyle = c.accent; ctx.beginPath(); ctx.arc(X(x), Y(y), 5, 0, 2 * Math.PI); ctx.fill();
    }
  }

  /* ---------- nombres complexes [re, im] ---------- */
  const cm = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
  const cj = a => [a[0], -a[1]];
  const ca = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const cs = (a, k) => [a[0] * k, a[1] * k];
  const a2 = a => a[0] * a[0] + a[1] * a[1];
  const polar = z => {
    const r = Math.sqrt(a2(z));
    return r < 5e-4 ? '0' : `${r.toFixed(3)} ∠ ${fr(Math.atan2(z[1], z[0]) * 180 / Math.PI, 0)}°`;
  };
  const blochOf = ([a, b]) => { const ab = cm(cj(a), b); return [2 * ab[0], 2 * ab[1], a2(a) - a2(b)]; };

  /* =====================================================================
     1. Les postulats en action : préparer → évoluer (U unitaire) → mesurer (Born) → projection.
     U(s) = cos(s/2) 1 − i sin(s/2) n·σ,  avec s = ωt et H = (ħω/2) n·σ.
     ===================================================================== */
  function postulats(root) {
    const stage = $(root, '.lab-stage');
    const viewAngles = { yaw: -0.55, elev: 0.32 };
    const S2 = Math.SQRT1_2;
    const preps = { '0': [[1, 0], [0, 0]], '+': [[S2, 0], [S2, 0]], '+i': [[S2, 0], [0, S2]] };
    const prepName = { '0': '|0⟩', '+': '|+⟩', '+i': '|+i⟩' };
    const eig = {
      Z: [{ v: [[1, 0], [0, 0]], l: '|0⟩', k: '0' }, { v: [[0, 0], [1, 0]], l: '|1⟩', k: '1' }],
      X: [{ v: [[S2, 0], [S2, 0]], l: '|+⟩', k: '+' }, { v: [[S2, 0], [-S2, 0]], l: '|−⟩', k: '−' }]
    };
    let prep = '0', ham = 'X', basis = 'Z', angle = Math.PI / 2;
    let psi = preps[prep].map(z => z.slice()), trail = [], busy = false, log = [];
    let shown = null;                                          // vecteur affiché pendant la projection

    const nsig = (n, [a, b]) => (n === 'Z' ? [a, cs(b, -1)] : [b, a]);
    const applyU = (s, n, p) => {
      const c = Math.cos(s / 2), si = Math.sin(s / 2), q = nsig(n, p);
      return [0, 1].map(i => ca(cs(p[i], c), cs([q[i][1], -q[i][0]], si)));   // −i·z = (im, −re)
    };

    const view = canvas(stage, (ctx, w, h, c) => {
      B.draw(ctx, w, h, c, { vec: shown || blochOf(psi), view: viewAngles, trail });
      axisArrow(ctx, w, h, c, viewAngles, ham === 'Z' ? [0, 0, 1] : [1, 0, 0], 'H');
    });
    B.orbit(stage, viewAngles, () => view.redraw());

    const out = k => $(root, `[data-out="${k}"]`);
    function text() {
      out('alpha').textContent = polar(psi[0]);
      out('beta').textContent = polar(psi[1]);
      out('norm').textContent = (a2(psi[0]) + a2(psi[1])).toFixed(4);
      const p = a2(ca(cm(cj(eig[basis][0].v[0]), psi[0]), cm(cj(eig[basis][0].v[1]), psi[1])));
      out('p').textContent = `${eig[basis][0].l} : ${(100 * p).toFixed(1)} %   ${eig[basis][1].l} : ${(100 * (1 - p)).toFixed(1)} %`;
      out('log').textContent = log.join('  →  ');
    }

    function evolve(sign) {
      if (busy) return;
      busy = true;
      const p0 = psi, n = ham, total = sign * angle, t0 = performance.now(), dur = 300 + 900 * angle / Math.PI;
      const step = now => {
        const k = Math.min(1, (now - t0) / dur);
        psi = applyU(total * k, n, p0);
        trail.push(blochOf(psi)); if (trail.length > 240) trail.shift();
        text(); view.redraw();
        if (k < 1) requestAnimationFrame(step);
        else {
          busy = false;
          log.push(`${sign > 0 ? 'U' : 'U†'}(${Math.round(angle * 180 / Math.PI)}°, σ${n.toLowerCase()})`);
          text();
        }
      };
      requestAnimationFrame(step);
    }

    function measure() {
      if (busy) return;
      const [e0, e1] = eig[basis];
      const amp = e => ca(cm(cj(e.v[0]), psi[0]), cm(cj(e.v[1]), psi[1]));   // ⟨φn|ψ⟩
      const c0 = amp(e0), p0 = a2(c0);
      const pick = Math.random() < p0 ? e0 : e1, c = pick === e0 ? c0 : amp(e1);
      const ph = cs(c, 1 / Math.sqrt(a2(c)));                                 // Pn|ψ⟩ / ‖Pn|ψ⟩‖
      const after = [cm(pick.v[0], ph), cm(pick.v[1], ph)];
      busy = true;
      const from = blochOf(psi), to = blochOf(after), t0 = performance.now();
      const step = now => {
        const k = Math.min(1, (now - t0) / 380), e = k * k * (3 - 2 * k);
        shown = norm(from.map((s, i) => s + (to[i] - s) * e + 1e-9));
        view.redraw();
        if (k < 1) { requestAnimationFrame(step); return; }
        shown = null; psi = after; trail = []; busy = false;
        log.push(`mesure ${basis} : ${pick.l}`);
        text(); view.redraw();
      };
      requestAnimationFrame(step);
    }

    function prepare() {
      if (busy) return;
      psi = preps[prep].map(z => z.slice()); trail = []; log = [`préparé ${prepName[prep]}`];
      text(); view.redraw();
    }

    seg($(root, '[data-seg="prep"]'), v => { prep = v; prepare(); });
    seg($(root, '[data-seg="ham"]'), v => { ham = v; view.redraw(); });
    seg($(root, '[data-seg="basis"]'), v => { basis = v; text(); });
    bind($(root, '#pq-angle'), v => { angle = v * Math.PI / 180; }, v => v + '°');
    $(root, '[data-act="prep"]').addEventListener('click', prepare);
    $(root, '[data-act="evolve"]').addEventListener('click', () => evolve(1));
    $(root, '[data-act="undo"]').addEventListener('click', () => evolve(-1));
    $(root, '[data-act="measure"]').addEventListener('click', measure);
    prepare();
  }

  /* =====================================================================
     2. Précession de Larmor : H = (ħω/2) σz.
     ⟨σx⟩ = sinθ cos(φ0 + ωt), ⟨σy⟩ = sinθ sin(φ0 + ωt), ⟨σz⟩ = cosθ (constant).
     ===================================================================== */
  function larmor(root) {
    const stage = $(root, '.lab-stage.square'), pstage = $(root, '.lab-stage.plot');
    const viewAngles = { yaw: -0.55, elev: 0.38 };
    const PHI0 = 0;
    let theta = Math.PI / 2, f = 0.5, t = 0;
    const omega = () => 2 * Math.PI * f;
    const vecAt = s => B.fromAngles(theta, PHI0 + omega() * s);
    const trail = () => {
      if (!f) return [];
      const span = Math.min(t, 0.85 / Math.abs(f)), pts = [];
      for (let i = 0; i <= 60; i++) pts.push(vecAt(t - span + span * i / 60));
      return pts;
    };

    const view = canvas(stage, (ctx, w, h, c) => {
      B.draw(ctx, w, h, c, { vec: vecAt(t), view: viewAngles, trail: trail() });
      if (f) axisArrow(ctx, w, h, c, viewAngles, [0, 0, Math.sign(f)], 'ω');
    });
    B.orbit(stage, viewAngles, () => view.redraw());
    const pview = canvas(pstage, (ctx, w, h, c) => plot(ctx, w, h, c, {
      x0: t - 4, x1: t, y0: -1.1, y1: 1.1, yticks: [-1, 0, 1], xlabel: 't (s) →',
      series: [
        { f: s => Math.cos(theta), color: c.muted, dash: [4, 4], width: 1.5 },
        { f: s => Math.sin(theta) * Math.sin(PHI0 + omega() * s), color: c.blue, width: 1.6 },
        { f: s => Math.sin(theta) * Math.cos(PHI0 + omega() * s), color: c.accent }
      ],
      cursor: { x: t, y: Math.sin(theta) * Math.cos(PHI0 + omega() * t) }
    }));

    const out = k => $(root, `[data-out="${k}"]`);
    function refresh() {
      const v = vecAt(t);
      out('sx').textContent = fr(v[0], 2); out('sy').textContent = fr(v[1], 2); out('sz').textContent = fr(v[2], 2);
      out('T').textContent = f ? (1 / Math.abs(f)).toFixed(2) + ' s' : '∞';
      view.redraw(); pview.redraw();
    }
    const anim = loop(stage, dt => { t += dt; refresh(); });
    const playBtn = $(root, '[data-act="play"]');
    const sync = () => { playBtn.textContent = anim.running ? 'Pause' : 'Lancer'; };
    playBtn.addEventListener('click', () => { anim.toggle(); sync(); });
    $(root, '[data-act="reset"]').addEventListener('click', () => { t = 0; refresh(); });
    bind($(root, '#lm-theta'), v => { theta = v * Math.PI / 180; refresh(); }, v => v + '°');
    bind($(root, '#lm-f'), v => { f = v; refresh(); }, v => fr(v, 2) + ' tr/s');
    sync();
  }

  /* =====================================================================
     3. Oscillations de Rabi (référentiel tournant) : H̃ = (ħ/2)(Ω σx + Δ σz).
     Rotation autour de (Ω, 0, Δ) à la pulsation Ω' = √(Ω² + Δ²) ;
     P1(t) = (Ω²/Ω'²) sin²(Ω' t / 2). Unités : MHz (Ω/2π, Δ/2π) et µs.
     ===================================================================== */
  function rabi(root) {
    const stage = $(root, '.lab-stage.square'), pstage = $(root, '.lab-stage.plot');
    const viewAngles = { yaw: -0.9, elev: 0.3 };
    const TAU = 2 * Math.PI, SPEED = 0.5;                    // 1 s affichée = 0,5 µs simulée
    let fO = 0.5, fD = 0, t = 0, stopAt = Infinity, dots = [];
    const Om = () => TAU * fO, De = () => TAU * fD, Op = () => Math.hypot(Om(), De());
    const n = () => [Om() / Op(), 0, De() / Op()];
    const P1 = s => (Om() / Op()) ** 2 * Math.sin(Op() * s / 2) ** 2;
    const tPi = () => Math.PI / Om();
    const period = () => TAU / Op();
    const windowT = () => period() * Math.max(2, Math.ceil(1.15 * tPi() / period()));
    const vecAt = s => rot([0, 0, 1], n(), Op() * s);

    const view = canvas(stage, (ctx, w, h, c) => {
      const span = Math.min(t, period()), trail = [];
      for (let i = 0; i <= 80; i++) trail.push(vecAt(t - span + span * i / 80));
      B.draw(ctx, w, h, c, { vec: vecAt(t), view: viewAngles, trail, axis: [Om(), 0, De()] });
    });
    B.orbit(stage, viewAngles, () => view.redraw());
    const pview = canvas(pstage, (ctx, w, h, c) => plot(ctx, w, h, c, {
      x0: 0, x1: windowT(), y0: 0, y1: 1.05, yticks: [0, 0.5, 1], xlabel: `t (µs) → ${windowT().toFixed(1)}`, x0label: '0',
      vlines: [{ x: tPi() / 2, label: 'π/2' }, { x: tPi(), label: 'π' }],
      series: [{ f: P1, color: c.accent, n: 400 }],
      dots, cursor: { x: t, y: P1(t) }
    }));

    const out = k => $(root, `[data-out="${k}"]`);
    function refresh() {
      out('p1').textContent = P1(t).toFixed(3);
      out('t').textContent = t.toFixed(2) + ' µs';
      out('pmax').textContent = ((Om() / Op()) ** 2).toFixed(3);
      out('op').textContent = (Op() / TAU).toFixed(2) + ' MHz';
      out('tpi').textContent = tPi().toFixed(2) + ' µs';
      view.redraw(); pview.redraw();
    }
    const playBtn = $(root, '[data-act="play"]');
    const anim = loop(stage, dt => {
      t += dt * SPEED;
      if (t >= stopAt) { t = stopAt; stopAt = Infinity; anim.pause(); sync(); }
      else if (t > windowT()) t -= windowT();               // la fenêtre contient un nombre entier de périodes
      refresh();
    });
    const sync = () => { playBtn.textContent = anim.running ? 'Pause' : 'Lancer'; };
    playBtn.addEventListener('click', () => { stopAt = Infinity; anim.toggle(); sync(); });
    const pulse = k => { t = 0; stopAt = k * tPi(); anim.play(); sync(); };
    $(root, '[data-act="pi2"]').addEventListener('click', () => pulse(0.5));
    $(root, '[data-act="pi"]').addEventListener('click', () => pulse(1));
    $(root, '[data-act="reset"]').addEventListener('click', () => { t = 0; dots = []; refresh(); });
    $(root, '[data-act="shots"]').addEventListener('click', () => {
      const p = P1(t); let k = 0;
      for (let i = 0; i < 200; i++) if (Math.random() < p) k++;
      dots.push([t, k / 200]); refresh();
    });
    const changed = () => { dots = []; if (t > windowT()) t = 0; refresh(); };
    bind($(root, '#rb-O'), v => { fO = v; changed(); }, v => v.toFixed(2) + ' MHz');
    bind($(root, '#rb-D'), v => { fD = v; changed(); }, v => fr(v, 2) + ' MHz');
    sync();
  }

  /* =====================================================================
     4. Franges de Ramsey contre raie de Rabi (calcul exact par rotations).
     Rabi : une impulsion π de durée π/Ω.  Ramsey : π/2 — précession libre ΔT autour de z — π/2.
     ===================================================================== */
  function ramsey(root) {
    const stage = $(root, '.lab-stage');
    const TAU = 2 * Math.PI, SPAN = 3;                       // Δ/2π ∈ [−3, 3] MHz
    let fO = 1, T = 2;
    const pulseP = (fd, area) => {                           // impulsion d'aire `area` (π ou π/2 à résonance)
      const O = TAU * fO, Dl = TAU * fd, Op = Math.hypot(O, Dl);
      return { n: [O / Op, 0, Dl / Op], a: Op * area / O };
    };
    const rabiP = fd => { const p = pulseP(fd, Math.PI); return (1 - rot([0, 0, 1], p.n, p.a)[2]) / 2; };
    const ramseyP = fd => {
      const p = pulseP(fd, Math.PI / 2);
      let v = rot([0, 0, 1], p.n, p.a);
      v = rot(v, [0, 0, 1], TAU * fd * T);
      v = rot(v, p.n, p.a);
      return (1 - v[2]) / 2;
    };
    const fwhm = f => { let x = 0; while (x < SPAN && f(x) > 0.5) x += 0.0005; return 2 * x; };

    const view = canvas(stage, (ctx, w, h, c) => plot(ctx, w, h, c, {
      x0: -SPAN, x1: SPAN, y0: 0, y1: 1.05, yticks: [0, 0.5, 1], xlabel: 'désaccord Δ/2π (MHz) → +3', x0label: '−3',
      series: [
        { f: rabiP, color: c.blue, width: 1.8, n: 600 },
        { f: ramseyP, color: c.accent, width: 1.6, n: Math.max(600, Math.round(240 * T * SPAN)) }
      ]
    }));
    function refresh() {
      const wR = fwhm(rabiP), wS = fwhm(ramseyP);
      $(root, '[data-out="wrabi"]').textContent = wR.toFixed(3) + ' MHz';
      $(root, '[data-out="wram"]').textContent = wS.toFixed(3) + ' MHz';
      $(root, '[data-out="th"]').textContent = (1 / (2 * T)).toFixed(3) + ' MHz';
      view.redraw();
    }
    bind($(root, '#rm-T'), v => { T = v; refresh(); }, v => v.toFixed(1) + ' µs');
    bind($(root, '#rm-O'), v => { fO = v; refresh(); }, v => v.toFixed(2) + ' MHz');
  }

  const labs = { postulats, larmor, rabi, ramsey };
  document.querySelectorAll('[data-lab]').forEach(el => { const f = labs[el.dataset.lab]; if (f) f(el); });
})();

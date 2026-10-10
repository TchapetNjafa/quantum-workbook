/* Chapitre 5 — laboratoires : densité de probabilité, dualité position/impulsion,
   paquet d'ondes libre, effet tunnel. Unités réduites ħ = m = 1 partout. */
(() => {
  'use strict';
  const { canvas, loop, bind, seg, drag, draw: D, t: tr } = window.Lab;
  const $ = (root, s) => root.querySelector(s);
  const f3 = v => (Math.abs(v) < 5e-4 ? 0 : v).toFixed(3);

  /* <physique> — fonctions pures, testées hors navigateur */
  const linspace = (a, b, n) => Float64Array.from({ length: n }, (_, i) => a + (b - a) * i / (n - 1));

  // intégrale par trapèzes de rho sur [lo, hi] (grille régulière xs)
  function integrate(xs, rho, lo = -Infinity, hi = Infinity) {
    const dx = xs[1] - xs[0];
    let s = 0;
    for (let i = 0; i < xs.length - 1; i++) {
      const a = Math.max(lo, xs[i]), b = Math.min(hi, xs[i + 1]);
      if (b <= a) continue;
      // interpolation linéaire de rho sur la portion [a, b] de la maille
      const r = x => rho[i] + (rho[i + 1] - rho[i]) * (x - xs[i]) / dx;
      s += 0.5 * (r(a) + r(b)) * (b - a);
    }
    return s;
  }

  // norme, moyenne, écart-type d'une densité
  function moments(xs, rho) {
    let n = 0, m1 = 0, m2 = 0;
    const dx = xs[1] - xs[0];
    for (let i = 0; i < xs.length; i++) { const w = rho[i] * dx; n += w; m1 += w * xs[i]; m2 += w * xs[i] * xs[i]; }
    const mean = m1 / n;
    return { norm: n, mean, sd: Math.sqrt(Math.max(0, m2 / n - mean * mean)) };
  }

  // paquet gaussien libre, solution exacte (Δx(0) = s0, impulsion moyenne p0, centre x0)
  // ψ(x,t) = (2π s0²)^(-1/4) (1 + i t/2s0²)^(-1/2) exp[-(x - x0 - p0 t)² / 4s0²(1 + i t/2s0²) + i p0 (x - x0) - i p0² t/2]
  function freePacket(x, t, s0, p0, x0) {
    const ar = 1, ai = t / (2 * s0 * s0);                 // α = 1 + i t / 2s0²
    const den = ar * ar + ai * ai;
    const u = x - x0 - p0 * t;
    const q = u * u / (4 * s0 * s0);
    const er = -q * ar / den, ei = q * ai / den + p0 * (x - x0) - p0 * p0 * t / 2;   // −q/α
    const mod = Math.pow(2 * Math.PI * s0 * s0, -0.25) * Math.pow(den, -0.25);       // |α|^(-1/2)
    const ph = -0.5 * Math.atan2(ai, ar);                                               // arg α^(-1/2)
    const A = mod * Math.exp(er);
    return [A * Math.cos(ei + ph), A * Math.sin(ei + ph)];
  }
  const spread = (s0, t) => s0 * Math.sqrt(1 + (t / (2 * s0 * s0)) ** 2);

  // coefficient de transmission d'une barrière rectangulaire (hauteur V0, largeur a), onde plane d'énergie E
  function barrierT(E, V0, a) {
    if (E <= 0) return 0;
    if (V0 === 0) return 1;
    if (Math.abs(E - V0) < 1e-9) return 1 / (1 + V0 * a * a / 2);
    if (E < V0) {
      const k = Math.sqrt(2 * (V0 - E)), sh = Math.sinh(k * a);
      return 1 / (1 + V0 * V0 * sh * sh / (4 * E * (V0 - E)));
    }
    const k = Math.sqrt(2 * (E - V0)), sn = Math.sin(k * a);
    return 1 / (1 + V0 * V0 * sn * sn / (4 * E * (E - V0)));
  }
  // transmission moyennée sur la distribution d'impulsion gaussienne du paquet (Δp = 1/2s0)
  function packetT(p0, s0, V0, a) {
    const dp = 1 / (2 * s0);
    let s = 0, n = 0;
    for (let i = -400; i <= 400; i++) {
      const p = p0 + dp * 6 * i / 400, w = Math.exp(-((p - p0) ** 2) / (2 * dp * dp));
      n += w; if (p > 0) s += w * barrierT(p * p / 2, V0, a);
    }
    return s / n;
  }

  // FFT radix 2 en place (inverse si inv = true, sans normalisation)
  function fft(re, im, inv) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = (inv ? 2 : -2) * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < len / 2; k++) {
          const a = i + k, b = a + len / 2;
          const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
          re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
          const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
        }
      }
    }
  }

  // Schrödinger 1D par la méthode split-operator : e^{-iVdt/2} e^{-iKdt} e^{-iVdt/2}
  function tunnelSim({ N = 1024, L = 200, x0 = -40, s0 = 5, p0, V0, a, dt = 0.05 }) {
    const dx = L / N, xs = Float64Array.from({ length: N }, (_, i) => -L / 2 + i * dx);
    const re = new Float64Array(N), im = new Float64Array(N);
    const vc = new Float64Array(N), vs = new Float64Array(N), kc = new Float64Array(N), ks = new Float64Array(N);
    const A = Math.pow(2 * Math.PI * s0 * s0, -0.25);
    for (let i = 0; i < N; i++) {
      const x = xs[i], g = A * Math.exp(-((x - x0) ** 2) / (4 * s0 * s0));
      re[i] = g * Math.cos(p0 * x); im[i] = g * Math.sin(p0 * x);
      // fraction de la maille [x − dx/2, x + dx/2] couverte par la barrière [0, a] : largeur effective exacte
      const V = V0 * Math.max(0, Math.min(x + dx / 2, a) - Math.max(x - dx / 2, 0)) / dx;
      vc[i] = Math.cos(V * dt / 2); vs[i] = -Math.sin(V * dt / 2);
      const k = 2 * Math.PI / L * (i < N / 2 ? i : i - N);
      kc[i] = Math.cos(k * k * dt / 2); ks[i] = -Math.sin(k * k * dt / 2);
    }
    const mul = (c, s) => { for (let i = 0; i < N; i++) { const r = re[i] * c[i] - im[i] * s[i]; im[i] = re[i] * s[i] + im[i] * c[i]; re[i] = r; } };
    let t = 0;
    return {
      xs, re, im, dx, get t() { return t; },
      step(n = 1) {
        for (let s = 0; s < n; s++) {
          mul(vc, vs); fft(re, im, false); mul(kc, ks); fft(re, im, true);
          for (let i = 0; i < N; i++) { re[i] /= N; im[i] /= N; }
          mul(vc, vs); t += dt;
        }
      },
      prob(lo, hi) { let s = 0; for (let i = 0; i < N; i++) if (xs[i] > lo && xs[i] <= hi) s += (re[i] ** 2 + im[i] ** 2) * dx; return s; }
    };
  }
  /* </physique> */

  /* ---------- tracé : repère commun ---------- */
  function frame(ctx, w, h, c, { xmin, xmax, ymax, top = 14, bottom = 26, label = 'x' }) {
    const L = 12, R = w - 12, B = h - bottom, T = top;
    const X = x => L + (x - xmin) / (xmax - xmin) * (R - L);
    const Y = y => B - (y / ymax) * (B - T);
    ctx.strokeStyle = c.rule; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(L, B + 0.5); ctx.lineTo(R, B + 0.5); ctx.stroke();
    D.text(ctx, label, R, B + 18, { font: c.mono, color: c.muted, align: 'right' });
    return { X, Y, B, T, L, R };
  }
  function curve(ctx, xs, ys, X, Y) {
    ctx.beginPath();
    for (let i = 0; i < xs.length; i++) { const px = X(xs[i]), py = Y(ys[i]); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
    ctx.stroke();
  }
  function fillCurve(ctx, xs, ys, X, Y, B) {
    ctx.beginPath(); ctx.moveTo(X(xs[0]), B);
    for (let i = 0; i < xs.length; i++) ctx.lineTo(X(xs[i]), Y(ys[i]));
    ctx.lineTo(X(xs[xs.length - 1]), B); ctx.closePath(); ctx.fill();
  }

  /* =====================================================================
     1. Densité de probabilité : P([a,b]) = ∫ₐᵇ |ψ|² dx, ⟨x⟩, Δx.
     Gaussienne ψ = (πσ²)^(-1/4) e^{-x²/2σ²} ; deux gaussiennes ; boîte ψ = √(2/L) sin(nπ(x−x_g)/L).
     ===================================================================== */
  function density(root) {
    const stage = $(root, '.lab-stage');
    const XS = linspace(-5, 5, 1001), LBOX = 6, XG = -3;
    let mode = 'g', sigma = 0.8, d = 2.4, n = 1, lo = -0.5, hi = 0.5, grab = -1;
    let psi = new Float64Array(XS.length), rho = new Float64Array(XS.length);

    function build() {
      for (let i = 0; i < XS.length; i++) {
        const x = XS[i];
        let v;
        if (mode === 'g') v = Math.pow(Math.PI * sigma * sigma, -0.25) * Math.exp(-x * x / (2 * sigma * sigma));
        else if (mode === 'gg') {
          const N = 1 / Math.sqrt(2 * Math.sqrt(Math.PI) * sigma * (1 + Math.exp(-d * d / (4 * sigma * sigma))));
          v = N * (Math.exp(-((x - d / 2) ** 2) / (2 * sigma * sigma)) + Math.exp(-((x + d / 2) ** 2) / (2 * sigma * sigma)));
        } else v = (x >= XG && x <= XG + LBOX) ? Math.sqrt(2 / LBOX) * Math.sin(n * Math.PI * (x - XG) / LBOX) : 0;
        psi[i] = v; rho[i] = v * v;
      }
      update();
    }
    const fmtX = x => mode === 'box' ? ((x - XG) / LBOX).toFixed(2) + ' L' : x.toFixed(2);

    function update() {
      const m = moments(XS, rho);
      const out = k => $(root, `[data-out="${k}"]`);
      out('P').textContent = integrate(XS, rho, lo, hi).toFixed(3);
      out('norm').textContent = m.norm.toFixed(3);
      out('mean').textContent = mode === 'box' ? fmtX(m.mean) : f3(m.mean);
      out('sd').textContent = mode === 'box' ? (m.sd / LBOX).toFixed(3) + ' L' : m.sd.toFixed(3);
      out('ab').textContent = `${fmtX(lo)} → ${fmtX(hi)}`;
      view.redraw();
    }

    const view = canvas(stage, (ctx, w, h, c) => {
      ctx.clearRect(0, 0, w, h);
      let ymax = 0; for (let i = 0; i < XS.length; i++) ymax = Math.max(ymax, rho[i], Math.abs(psi[i]));
      const { X, Y, B, T } = frame(ctx, w, h, c, { xmin: -5, xmax: 5, ymax: ymax * 1.15 || 1, top: 28 });
      if (mode === 'box') {                                    // parois de la boîte
        ctx.fillStyle = D.alpha(c.ink, 0.08);
        ctx.fillRect(X(-5), T, X(XG) - X(-5), B - T); ctx.fillRect(X(XG + LBOX), T, X(5) - X(XG + LBOX), B - T);
      }
      // aire sous |ψ|² entre les bornes
      const sel = [], sy = [];
      for (let i = 0; i < XS.length; i++) if (XS[i] >= lo && XS[i] <= hi) { sel.push(XS[i]); sy.push(rho[i]); }
      if (sel.length > 1) { ctx.fillStyle = D.alpha(c.accent, 0.28); fillCurve(ctx, sel, sy, X, Y, B); }
      // ψ(x) (axe central à mi-hauteur pour voir le signe)
      const mid = (B + T) / 2, half = (B - T) / 2;
      ctx.lineWidth = 1.4; ctx.setLineDash([5, 4]);
      ctx.strokeStyle = D.alpha(c.blue, 0.25);
      ctx.beginPath(); ctx.moveTo(X(-5), mid); ctx.lineTo(X(5), mid); ctx.stroke();
      ctx.strokeStyle = D.alpha(c.blue, 0.9);
      curve(ctx, XS, psi, X, y => mid - (y / (ymax * 1.15)) * half);
      ctx.setLineDash([]);
      ctx.strokeStyle = c.ink; ctx.lineWidth = 2; curve(ctx, XS, rho, X, Y);
      // bornes déplaçables
      [lo, hi].forEach((v, k) => {
        const px = X(v);
        ctx.strokeStyle = c.accent; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(px, T - 6); ctx.lineTo(px, B); ctx.stroke();
        ctx.fillStyle = c.accent; ctx.beginPath(); ctx.arc(px, T - 6, 7, 0, 2 * Math.PI); ctx.fill();
        D.text(ctx, k ? 'b' : 'a', px, T - 2, { font: '600 10px "IBM Plex Sans", sans-serif', color: '#fff', align: 'center', base: 'middle' });
      });
      D.text(ctx, `P = ${integrate(XS, rho, lo, hi).toFixed(3)}`, 14, 16, { font: c.mono, color: c.accent });
    });

    const pos = px => { const { w } = view.size(); return -5 + (px - 12) / (w - 24) * 10; };
    drag(stage, {
      start: p => { const x = pos(p.x); grab = Math.abs(x - lo) <= Math.abs(x - hi) ? 0 : 1; },
      move: p => {
        const x = Math.max(-5, Math.min(5, pos(p.x)));
        if (grab === 0) lo = Math.min(x, hi); else if (grab === 1) hi = Math.max(x, lo);
        update();
      },
      end: () => { grab = -1; }
    });

    const show = (sel, on) => root.querySelectorAll(sel).forEach(e => { e.hidden = !on; e.style.display = on ? '' : 'none'; });   // .ctrl/.btn imposent display
    seg($(root, '[data-seg="state"]'), v => {
      mode = v;
      show('[data-for="sigma"]', v !== 'box'); show('[data-for="d"]', v === 'gg'); show('[data-for="n"]', v === 'box');
      show('[data-preset]', v === 'box');
      build();
    });
    bind($(root, '#dens-sigma'), v => { sigma = v; build(); }, v => v.toFixed(2));
    bind($(root, '#dens-d'), v => { d = v; build(); }, v => v.toFixed(1));
    bind($(root, '#dens-n'), v => { n = v; build(); }, v => String(v));
    const presets = { mid: [XG + LBOX / 3, XG + 2 * LBOX / 3], quart: [XG, XG + LBOX / 4], all: [-5, 5] };
    root.querySelectorAll('[data-preset], [data-bounds]').forEach(b => b.addEventListener('click', () => {
      [lo, hi] = presets[b.dataset.preset || b.dataset.bounds]; update();
    }));
  }

  /* =====================================================================
     2. Dualité position / impulsion.
     ψ = N[g(x − d/2) + s g(x + d/2)], g = e^{-x²/2σ²}  ⇒  |φ(p)|² ∝ e^{-p²σ²} (1 + s cos pd)   (ħ = 1)
     d = 0, s = +1 : gaussienne seule, Δx Δp = ħ/2.
     ===================================================================== */
  function duality(root) {
    const stage = $(root, '.lab-stage');
    const XS = linspace(-20, 20, 2401), PS = linspace(-20, 20, 2401);
    let mode = 'g', sigma = 1, d = 3;
    const rx = new Float64Array(XS.length), rp = new Float64Array(PS.length);

    function build() {
      const s = mode === 'm' ? -1 : 1, dd = mode === 'g' ? 0 : d;
      for (let i = 0; i < XS.length; i++) {
        const x = XS[i];
        const v = Math.exp(-((x - dd / 2) ** 2) / (2 * sigma * sigma)) + s * Math.exp(-((x + dd / 2) ** 2) / (2 * sigma * sigma));
        rx[i] = v * v;
        const p = PS[i];
        rp[i] = Math.exp(-p * p * sigma * sigma) * (1 + s * Math.cos(p * dd));
      }
      const nx = integrate(XS, rx), np = integrate(PS, rp);
      for (let i = 0; i < XS.length; i++) { rx[i] /= nx; rp[i] /= np; }
      const mx = moments(XS, rx), mp = moments(PS, rp);
      $(root, '[data-out="dx"]').textContent = mx.sd.toFixed(3);
      $(root, '[data-out="dp"]').textContent = mp.sd.toFixed(3) + ' ħ';
      $(root, '[data-out="prod"]').textContent = (mx.sd * mp.sd).toFixed(3) + ' ħ';
      view.redraw();
    }

    const view = canvas(stage, (ctx, w, h, c) => {
      ctx.clearRect(0, 0, w, h);
      const hh = h / 2;
      const panel = (y0, xs, r, lbl, col, name) => {
        ctx.save(); ctx.translate(0, y0);
        let m = 0; for (let i = 0; i < r.length; i++) if (Math.abs(xs[i]) <= 6) m = Math.max(m, r[i]);
        const { X, Y, B } = frame(ctx, w, hh, c, { xmin: -6, xmax: 6, ymax: m * 1.12, top: 22, bottom: 24, label: lbl });
        const sx = [], sy = [];
        for (let i = 0; i < xs.length; i++) if (Math.abs(xs[i]) <= 6) { sx.push(xs[i]); sy.push(r[i]); }
        ctx.fillStyle = D.alpha(col, 0.16); fillCurve(ctx, sx, sy, X, Y, B);
        ctx.strokeStyle = col; ctx.lineWidth = 2; curve(ctx, sx, sy, X, Y);
        D.text(ctx, name, 14, 16, { font: c.serif, color: col });
        ctx.restore();
      };
      panel(0, XS, rx, 'x', c.ink, '|ψ(x)|²');
      panel(hh, PS, rp, tr('p (unités de ħ)', 'p (units of ħ)'), c.accent, '|φ(p)|²');
    });

    seg($(root, '[data-seg="pair"]'), v => { mode = v; root.querySelectorAll('[data-for="d2"]').forEach(e => { e.hidden = v === 'g'; e.style.display = v === 'g' ? 'none' : ''; }); build(); });
    bind($(root, '#dual-sigma'), v => { sigma = v; build(); }, v => v.toFixed(2));
    bind($(root, '#dual-d'), v => { d = v; build(); }, v => v.toFixed(1));
  }

  /* =====================================================================
     3. Paquet d'ondes libre (solution exacte), ħ = m = 1.
     Δx(t) = Δx₀ √(1 + (t / 2Δx₀²)²), v_g = p₀, v_φ = p₀/2.
     ===================================================================== */
  function packet(root) {
    const stage = $(root, '.lab-stage');
    const XMIN = -5, XMAX = 35, NX = 900, XS = linspace(XMIN, XMAX, NX);
    const re = new Float64Array(NX), im = new Float64Array(NX), rho = new Float64Array(NX);
    let s0 = 0.8, p0 = 3, t = 0;
    const RATE = 1.5;

    function compute() {
      for (let i = 0; i < NX; i++) { const [a, b] = freePacket(XS[i], t, s0, p0, 0); re[i] = a; im[i] = b; rho[i] = a * a + b * b; }
      const m = moments(XS, rho);
      $(root, '[data-out="t"]').textContent = t.toFixed(2);
      $(root, '[data-out="mean"]').textContent = f3(m.mean);
      $(root, '[data-out="sd"]').textContent = m.sd.toFixed(3);
      $(root, '[data-out="sdth"]').textContent = spread(s0, t).toFixed(3);
    }

    const view = canvas(stage, (ctx, w, h, c) => {
      ctx.clearRect(0, 0, w, h);
      const A0 = Math.pow(2 * Math.PI * s0 * s0, -0.25);          // max |ψ| à t = 0
      const { X, B, T } = frame(ctx, w, h, c, { xmin: XMIN, xmax: XMAX, ymax: 1.1, top: 30, bottom: 28 });
      const mid = (B + T) / 2 + 10, half = (B - T) / 2 - 8;
      const Ym = y => mid - (y / A0) * half;
      ctx.strokeStyle = D.alpha(c.ink, 0.12); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(X(XMIN), mid); ctx.lineTo(X(XMAX), mid); ctx.stroke();
      ctx.fillStyle = D.alpha(c.accent, 0.18);
      fillCurve(ctx, XS, Array.from(rho, r => mid - r / (A0 * A0) * half), X, y => y, mid);
      ctx.lineWidth = 1.3;
      ctx.strokeStyle = D.alpha(c.muted, 0.9); curve(ctx, XS, im, X, Ym);
      ctx.strokeStyle = c.blue; curve(ctx, XS, re, X, Ym);
      ctx.strokeStyle = c.accent; ctx.lineWidth = 2;
      curve(ctx, XS, Array.from(rho, r => r / (A0 * A0)), X, y => mid - y * half);
      // marqueurs : enveloppe (v_g) et phase de la porteuse (v_φ)
      const tri = (x, col, txt, side) => {
        if (x < XMIN || x > XMAX) return;
        const px = X(x);
        ctx.strokeStyle = D.alpha(col, 0.5); ctx.setLineDash([3, 3]); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(px, T); ctx.lineTo(px, B); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(px, B - 1); ctx.lineTo(px - 6, B + 9); ctx.lineTo(px + 6, B + 9); ctx.closePath(); ctx.fill();
        D.text(ctx, txt, px + side * 9, B + 20, { font: c.mono, color: col, align: side > 0 ? 'left' : 'right' });
      };
      tri(p0 * t, c.accent, 'v_g', 1);
      tri(p0 * t / 2, c.blue, 'v_φ', -1);
    });

    const anim = loop(stage, dt => {
      t += dt * RATE;
      const m = moments(XS, rho);
      if (m.mean + 2.5 * m.sd > XMAX || spread(s0, t) > 9) t = 0;
      compute(); view.redraw();
    }, { autoplay: false });

    const playBtn = $(root, '[data-act="play"]');
    playBtn.addEventListener('click', () => { const on = anim.toggle(); playBtn.textContent = on ? 'Pause' : tr('Lancer', 'Start'); });
    $(root, '[data-act="reset"]').addEventListener('click', () => { t = 0; compute(); view.redraw(); });
    const speeds = () => {
      $(root, '[data-out="vg"]').textContent = p0.toFixed(2);
      $(root, '[data-out="vphi"]').textContent = (p0 / 2).toFixed(2);
      $(root, '[data-out="t0"]').textContent = (2 * s0 * s0).toFixed(2);
    };
    bind($(root, '#pk-s0'), v => { s0 = v; t = 0; speeds(); compute(); view.redraw(); }, v => v.toFixed(2));
    bind($(root, '#pk-p0'), v => { p0 = v; t = 0; speeds(); compute(); view.redraw(); }, v => v.toFixed(1));
  }

  /* =====================================================================
     4. Effet tunnel : paquet gaussien sur une barrière rectangulaire (split-operator FFT).
     Prévision : T̄ = ∫ |φ(p)|² T(p²/2) dp avec T(E) de la barrière rectangulaire.
     ===================================================================== */
  function tunnel(root) {
    const stage = $(root, '.lab-stage');
    const S0 = 5, X0 = -40, VIEW = 70, DT = 0.05;
    let V0 = 1, a = 1, p0 = 1.2, sim = null, tStop = 0, done = false;

    function reset() {
      sim = tunnelSim({ x0: X0, s0: S0, p0, V0, a, dt: DT });
      tStop = 85 / p0; done = false;
      const E = p0 * p0 / 2;
      $(root, '[data-out="E"]').textContent = E.toFixed(3);
      $(root, '[data-out="Tpw"]').textContent = barrierT(E, V0, a).toFixed(3);
      $(root, '[data-out="Tth"]').textContent = packetT(p0, S0, V0, a).toFixed(3);
      out();
      view.redraw();
    }
    function out() {
      $(root, '[data-out="Tnum"]').textContent = sim.prob(a, Infinity).toFixed(3);
      $(root, '[data-out="R"]').textContent = sim.prob(-Infinity, 0).toFixed(3);
    }

    const view = canvas(stage, (ctx, w, h, c) => {
      ctx.clearRect(0, 0, w, h);
      if (!sim) return;
      const ymax = 1.15 * Math.pow(2 * Math.PI * S0 * S0, -0.5);
      const { X, Y, B, T } = frame(ctx, w, h, c, { xmin: -VIEW, xmax: VIEW, ymax, top: 26, bottom: 26 });
      // barrière, à l'échelle de l'énergie : la ligne E = p0²/2 est à mi-hauteur de la zone
      const E = p0 * p0 / 2, eScale = (B - T) * 0.5 / Math.max(E, 1e-9);
      const vh = Math.min(B - T, V0 * eScale);
      ctx.fillStyle = D.alpha(c.ink, 0.14); ctx.fillRect(X(0), B - vh, Math.max(2, X(a) - X(0)), vh);
      ctx.strokeStyle = c.ink; ctx.lineWidth = 1; ctx.strokeRect(X(0), B - vh, Math.max(2, X(a) - X(0)), vh);
      ctx.strokeStyle = D.alpha(c.blue, 0.8); ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(X(-VIEW), B - E * eScale); ctx.lineTo(X(VIEW), B - E * eScale); ctx.stroke(); ctx.setLineDash([]);
      D.text(ctx, 'E', X(-VIEW) + 4, B - E * eScale - 5, { font: c.serif, color: c.blue });
      D.text(ctx, 'V₀', X(a) + 6, Math.max(T + 12, B - vh + 12), { font: c.serif, color: c.ink });
      const { xs, re, im } = sim, sx = [], sy = [];
      for (let i = 0; i < xs.length; i++) if (Math.abs(xs[i]) <= VIEW) { sx.push(xs[i]); sy.push(re[i] ** 2 + im[i] ** 2); }
      ctx.fillStyle = D.alpha(c.accent, 0.22); fillCurve(ctx, sx, sy, X, Y, B);
      ctx.strokeStyle = c.accent; ctx.lineWidth = 2; curve(ctx, sx, sy, X, Y);
      D.text(ctx, `t = ${sim.t.toFixed(1)}`, 14, 16, { font: c.mono, color: c.muted });
      D.text(ctx, '|ψ(x, t)|²', w - 14, 16, { font: c.serif, color: c.accent, align: 'right' });
    });

    const anim = loop(stage, () => {
      if (!sim || done) return;
      const per = Math.max(1, Math.ceil(tStop / DT / 300));     // ≈ 5 s d'animation, quel que soit p0
      sim.step(per);
      if (sim.t >= tStop) { done = true; anim.pause(); playBtn.textContent = tr('Relancer', 'Restart'); }
      out(); view.redraw();
    }, { autoplay: false });

    const playBtn = $(root, '[data-act="play"]');
    playBtn.addEventListener('click', () => {
      if (done) { reset(); anim.play(); playBtn.textContent = 'Pause'; return; }
      const on = anim.toggle(); playBtn.textContent = on ? 'Pause' : tr('Lancer', 'Start');
    });
    const changed = () => { anim.pause(); playBtn.textContent = tr('Lancer', 'Start'); reset(); };
    bind($(root, '#tn-V0'), v => { V0 = v; if (sim) changed(); }, v => v.toFixed(2));
    bind($(root, '#tn-a'), v => { a = v; if (sim) changed(); }, v => v.toFixed(2));
    bind($(root, '#tn-p0'), v => { p0 = v; if (sim) changed(); }, v => v.toFixed(2));
    reset();
  }

  const labs = { density, duality, packet, tunnel };
  document.querySelectorAll('[data-lab]').forEach(el => { const f = labs[el.dataset.lab]; if (f) f(el); });
})();

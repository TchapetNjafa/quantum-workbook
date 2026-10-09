/* Rendu de la sphère de Bloch sur canvas 2D (projection orthographique, sans WebGL).
   Vecteur de Bloch : r = (sinθ cosφ, sinθ sinφ, cosθ), |0⟩ au pôle nord.
   Utilisé par les chapitres 1 (qubit), 2 (mesure) et 3 (Rabi). */
(() => {
  'use strict';

  /** Projette un point 3D selon la vue {yaw, elev} → {x, y, z} (z > 0 : face à l'observateur). */
  function project(p, view, cx, cy, R) {
    const cyw = Math.cos(view.yaw), syw = Math.sin(view.yaw);
    const a = p[0] * cyw - p[1] * syw;          // axe vers l'observateur (avant élévation)
    const b = p[0] * syw + p[1] * cyw;          // axe écran, vers la droite
    const ce = Math.cos(view.elev), se = Math.sin(view.elev);
    return { x: cx + R * b, y: cy - R * (p[2] * ce - a * se), z: a * ce + p[2] * se };
  }

  const fromAngles = (theta, phi) => [Math.sin(theta) * Math.cos(phi), Math.sin(theta) * Math.sin(phi), Math.cos(theta)];

  /** Grand cercle en deux passes : arrière pointillé, avant plein. */
  function circle(ctx, pts, front, back) {
    for (const pass of ['back', 'front']) {
      ctx.beginPath();
      let pen = false;
      for (const q of pts) {
        const visible = pass === 'front' ? q.z >= 0 : q.z < 0;
        if (visible) { if (pen) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); pen = true; } else pen = false;
      }
      ctx.setLineDash(pass === 'back' ? [3, 4] : []);
      ctx.strokeStyle = pass === 'back' ? back : front;
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  /**
   * draw(ctx, w, h, colors, opts)
   * opts : { theta, phi | vec:[x,y,z], view:{yaw,elev}, trail:[[x,y,z]…], axis:[x,y,z], axisLabel:'Ω', ghost:[x,y,z] }
   */
  function draw(ctx, w, h, c, o) {
    const D = window.Lab.draw;
    ctx.clearRect(0, 0, w, h);
    const R = Math.min(w, h) * 0.36;
    const cx = w / 2, cy = h / 2 + 4;
    const P = p => project(p, o.view, cx, cy, R);

    // léger volume
    const g = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
    g.addColorStop(0, D.alpha(c.ink, 0));
    g.addColorStop(1, D.alpha(c.ink, 0.07));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 2 * Math.PI); ctx.fill();
    ctx.lineWidth = 1.2; ctx.strokeStyle = c.ink2;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 2 * Math.PI); ctx.stroke();

    ctx.lineWidth = 1;
    const N = 96, eq = [], mer = [], mer2 = [];
    for (let i = 0; i <= N; i++) {
      const t = (i / N) * 2 * Math.PI;
      eq.push(P([Math.cos(t), Math.sin(t), 0]));
      mer.push(P([Math.sin(t), 0, Math.cos(t)]));
      mer2.push(P([0, Math.sin(t), Math.cos(t)]));
    }
    circle(ctx, eq, c.ink2, c.muted);
    ctx.globalAlpha = 0.5; circle(ctx, mer, c.muted, c.rule); circle(ctx, mer2, c.muted, c.rule); ctx.globalAlpha = 1;

    const axes = [
      { v: [0, 0, 1], l: '|0⟩' }, { v: [0, 0, -1], l: '|1⟩' },
      { v: [1, 0, 0], l: '|+⟩' }, { v: [-1, 0, 0], l: '|−⟩' },
      { v: [0, 1, 0], l: '|+i⟩' }, { v: [0, -1, 0], l: '|−i⟩' }
    ];
    const o0 = P([0, 0, 0]);
    for (const a of axes) {
      const e = P(a.v), lab = P(a.v.map(x => x * 1.22));
      ctx.strokeStyle = e.z < 0 ? c.rule : c.muted; ctx.setLineDash(e.z < 0 ? [2, 3] : []);
      ctx.beginPath(); ctx.moveTo(o0.x, o0.y); ctx.lineTo(e.x, e.y); ctx.stroke(); ctx.setLineDash([]);
      D.text(ctx, a.l, lab.x, lab.y, { font: c.serif, color: e.z < -0.2 ? c.muted : c.ink, align: 'center', base: 'middle' });
    }

    if (o.axis) {                                   // axe de rotation (Rabi)
      const n = Math.hypot(o.axis[0], o.axis[1], o.axis[2]) || 1, u = o.axis.map(x => x / n);
      const a1 = P(u.map(x => -x * 1.08)), a2 = P(u.map(x => x * 1.08));
      ctx.strokeStyle = c.blue; ctx.fillStyle = c.blue; ctx.lineWidth = 1.5;
      D.arrow(ctx, a1.x, a1.y, a2.x, a2.y, 7);
      D.text(ctx, o.axisLabel || 'Ω', a2.x + 8, a2.y - 6, { font: c.serif, color: c.blue });
    }

    if (o.trail && o.trail.length > 1) {            // traînée
      ctx.lineWidth = 1.6;
      for (let i = 1; i < o.trail.length; i++) {
        const p1 = P(o.trail[i - 1]), p2 = P(o.trail[i]);
        ctx.strokeStyle = D.alpha(c.accent, (0.12 + 0.6 * i / o.trail.length) * (p2.z >= 0 ? 1 : 0.45));
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
      }
    }

    if (o.ghost) {
      const gq = P(o.ghost);
      ctx.strokeStyle = D.alpha(c.ink2, 0.35); ctx.setLineDash([4, 4]); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(o0.x, o0.y); ctx.lineTo(gq.x, gq.y); ctx.stroke(); ctx.setLineDash([]);
    }

    const v = o.vec || fromAngles(o.theta, o.phi);  // vecteur d'état
    const tip = P(v), foot = P([v[0], v[1], 0]);
    ctx.strokeStyle = D.alpha(c.accent, 0.45); ctx.setLineDash([2, 3]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(tip.x, tip.y); ctx.lineTo(foot.x, foot.y); ctx.lineTo(o0.x, o0.y); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = c.accent; ctx.fillStyle = c.accent; ctx.lineWidth = 2.5;
    D.arrow(ctx, o0.x, o0.y, tip.x, tip.y, 10);
    ctx.beginPath(); ctx.arc(tip.x, tip.y, 4.5, 0, 2 * Math.PI); ctx.fill();
    D.text(ctx, '|ψ⟩', tip.x + 9, tip.y - 9, { font: c.serif, color: c.accent });
  }

  /** Faire tourner la vue en glissant sur la sphère. */
  function orbit(stage, view, redraw) {
    let start = null;
    window.Lab.drag(stage, {
      start: p => { start = { x: p.x, y: p.y, yaw: view.yaw, elev: view.elev }; },
      move: p => {
        if (!start) return;
        view.yaw = start.yaw + (p.x - start.x) * 0.01;
        view.elev = Math.max(-1.2, Math.min(1.2, start.elev + (p.y - start.y) * 0.01));
        redraw();
      },
      end: () => { start = null; }
    });
    return view;
  }

  window.Bloch = { draw, project, fromAngles, orbit };
})();

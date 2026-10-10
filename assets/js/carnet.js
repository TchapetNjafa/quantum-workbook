/* Carnet PHY321 — comportements communs : thème, progression, sommaire, exercices,
   et petite boîte à outils pour les laboratoires (canvas). Aucune dépendance. */
(() => {
  'use strict';
  document.documentElement.classList.add('js');

  const STORE = 'phy321.workbook.v2';
  // Langue de la page : <html lang="fr"> ou <html lang="en">. t(fr, en) choisit le bon texte.
  const LANG = (document.documentElement.lang || 'fr').toLowerCase().startsWith('en') ? 'en' : 'fr';
  const t = (fr, en) => (LANG === 'en' ? en : fr);
  const LOCALE = LANG === 'en' ? 'en-GB' : 'fr-FR';

  // hors connexion : sw.js est à la racine du site, deux niveaux au-dessus de ce script
  const scriptSrc = document.currentScript && document.currentScript.src;
  if (scriptSrc && 'serviceWorker' in navigator && location.protocol !== 'file:') {
    addEventListener('load', () => {
      navigator.serviceWorker.register(new URL('../../sw.js', scriptSrc), { scope: new URL('../../', scriptSrc).pathname })
        .catch(err => console.warn(t('Mode hors connexion indisponible :', 'Offline mode unavailable:'), err.message));
    });
  }
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- stockage local (peut être indisponible : navigation privée) ---------- */
  const store = {
    read() {
      try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; }
    },
    write(data) {
      try { localStorage.setItem(STORE, JSON.stringify(data)); } catch { /* stockage bloqué : on continue sans */ }
    },
    update(fn) { const next = fn(JSON.parse(JSON.stringify(this.read()))); this.write(next); return next; }
  };

  /* ---------- thème : auto → clair → sombre ---------- */
  const THEMES = ['auto', 'light', 'dark'];
  const themeLabel = LANG === 'en'
    ? { auto: 'Theme: system', light: 'Theme: light', dark: 'Theme: dark' }
    : { auto: 'Thème : système', light: 'Thème : clair', dark: 'Thème : sombre' };
  function applyTheme(t) {
    if (t === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = t;
    document.querySelectorAll('[data-theme-toggle]').forEach(b => {
      b.setAttribute('aria-label', themeLabel[t]); b.title = themeLabel[t]; b.dataset.mode = t;
    });
    window.dispatchEvent(new CustomEvent('themechange'));
  }
  let theme = (() => { try { return localStorage.getItem('phy321.theme') || 'auto'; } catch { return 'auto'; } })();
  applyTheme(theme);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => window.dispatchEvent(new CustomEvent('themechange')));

  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-theme-toggle]');
    if (!btn) return;
    theme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
    try { localStorage.setItem('phy321.theme', theme); } catch { /* ignoré */ }
    applyTheme(theme);
  });

  /* ---------- bascule de langue : lit <link rel="alternate" hreflang="…"> de la page ---------- */
  function initLangSwitch() {
    const other = LANG === 'en' ? 'fr' : 'en';
    const alt = document.querySelector(`link[rel="alternate"][hreflang="${other}"]`);
    const bar = document.querySelector('.topbar');
    if (!alt || !bar) return;
    const a = document.createElement('a');
    a.className = 'lang-switch';
    a.hreflang = other;
    a.lang = other;
    a.textContent = other.toUpperCase();
    a.title = other === 'en' ? 'Read in English' : 'Lire en français';
    a.setAttribute('aria-label', a.title);
    const go = () => { a.href = alt.getAttribute('href') + location.hash; };
    go();
    addEventListener('hashchange', go);
    a.addEventListener('pointerdown', go);
    const theme = bar.querySelector('[data-theme-toggle]');
    bar.insertBefore(a, theme);
  }

  /* ---------- barre de lecture + sommaire actif ---------- */
  function initReading() {
    const bar = document.querySelector('.readbar');
    const links = [...document.querySelectorAll('.toc a[href^="#"]')];
    const targets = links.map(a => document.getElementById(a.hash.slice(1))).filter(Boolean);
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const h = document.documentElement;
        const p = h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight);
        if (bar) bar.style.setProperty('--read', p.toFixed(4));
        let current = targets[0];
        for (const t of targets) if (t.getBoundingClientRect().top < innerHeight * 0.3) current = t;
        links.forEach(a => a.classList.toggle('is-active', !!current && a.hash === '#' + current.id));
        ticking = false;
      });
    };
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    const toc = document.querySelector('.toc details');
    if (toc && innerWidth >= 1080) toc.open = true;
    // sur mobile, refermer le sommaire après un choix
    links.forEach(a => a.addEventListener('click', () => {
      const d = a.closest('details');
      if (d && innerWidth < 1080) d.open = false;
    }));
  }

  /* ---------- apparitions ---------- */
  function initRise() {
    const els = document.querySelectorAll('.rise');
    if (reduceMotion || !('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('in')); return; }
    const io = new IntersectionObserver(entries => entries.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    }), { rootMargin: '0px 0px -8% 0px' });
    els.forEach(e => io.observe(e));
  }

  /* ---------- progression ---------- */
  const chapterId = document.body.dataset.chapter || null;

  function markExercise(id, ok) {
    if (!chapterId || !id || !ok) return;
    store.update(s => {
      s[chapterId] = s[chapterId] || { exos: {} };
      s[chapterId].exos = s[chapterId].exos || {};
      s[chapterId].exos[id] = true;
      return s;
    });
  }

  function initDone() {
    const box = document.querySelector('[data-done]');
    if (!box || !chapterId) return;
    box.checked = !!(store.read()[chapterId] || {}).done;
    box.addEventListener('change', () => store.update(s => {
      s[chapterId] = s[chapterId] || { exos: {} };
      s[chapterId].done = box.checked;
      return s;
    }));
  }

  /* ---------- signaler une erreur (formulaire d'issue GitHub prérempli) ---------- */
  function initReport() {
    const foot = document.querySelector('.chapter-foot');
    if (!foot || !chapterId) return;
    const a = document.createElement('a');
    a.className = 'report-link';
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = t('Signaler une erreur dans ce chapitre', 'Report an error in this chapter');
    const update = () => {
      const active = document.querySelector('.toc a.is-active');
      const section = active ? [...active.childNodes].map(n => n.textContent.trim()).filter(Boolean).join(' ') : t('Chapitre ', 'Chapter ') + chapterId.slice(2);
      const params = new URLSearchParams({
        template: t('erreur.yml', 'error.yml'), title: `[${section}] `, section,
        page: location.href.split('#')[0] + (active ? active.hash : '')
      });
      a.href = 'https://github.com/TchapetNjafa/quantum-workbook/issues/new?' + params;
    };
    a.addEventListener('pointerdown', update);
    a.addEventListener('focus', update);
    update();
    foot.append(a);
  }

  /* ---------- évaluation sûre d'une réponse numérique ----------
     Accepte : 0.5, 1/2, 1/sqrt(2), 2*pi, 3e-4, π, √2, virgule décimale.
     Liste blanche stricte de caractères avant toute évaluation. */
  function parseNumber(raw) {
    let s = String(raw).trim().toLowerCase().replace(/,/g, '.').replace(/π/g, 'pi').replace(/√/g, 'sqrt').replace(/×/g, '*').replace(/\s+/g, '');
    if (!s || s.length > 40) return NaN;
    if (!/^(?:[0-9.e+\-*/^()]|sqrt|pi)+$/.test(s)) return NaN;
    s = s.replace(/sqrt/g, 'Math.sqrt').replace(/pi/g, 'Math.PI').replace(/\^/g, '**');
    try {
      const v = Function('"use strict";return (' + s + ')')();
      return typeof v === 'number' && isFinite(v) ? v : NaN;
    } catch { return NaN; }
  }

  function initExercises() {
    const solved = chapterId ? ((store.read()[chapterId] || {}).exos || {}) : {};
    document.querySelectorAll('.exo[data-id]').forEach(exo => {
      const id = exo.dataset.id;
      const fb = exo.querySelector('.feedback');
      const btn = exo.querySelector('[data-check]');
      if (!btn) return;
      if (solved[id]) exo.classList.add('was-solved');

      btn.addEventListener('click', () => {
        if (exo.dataset.answer !== undefined) {          // QCM
          const picked = exo.querySelector('input[type=radio]:checked');
          exo.querySelectorAll('.choice').forEach(c => c.classList.remove('is-right', 'is-wrong'));
          if (!picked) { say(fb, 'ko', t('Choisissez une réponse d’abord.', 'Choose an answer first.')); return; }
          const label = picked.closest('.choice');
          const ok = picked.value === exo.dataset.answer;
          label.classList.add(ok ? 'is-right' : 'is-wrong');
          say(fb, ok ? 'ok' : 'ko', label.dataset.why || (ok ? t('Exact.', 'Correct.') : t('Pas tout à fait. Relisez l’encadré au-dessus.', 'Not quite. Reread the box above.')));
          markExercise(id, ok);
          return;
        }
        if (exo.dataset.num !== undefined) {             // numérique
          const input = exo.querySelector('.num-answer input');
          const v = parseNumber(input.value);
          const target = Number(exo.dataset.num);
          const tol = Number(exo.dataset.tol || 0.01) * Math.max(1, Math.abs(target));
          if (Number.isNaN(v)) { say(fb, 'ko', t('Écrivez un nombre (ex. 0.25, 1/4 ou 1/sqrt(2)).', 'Enter a number (e.g. 0.25, 1/4 or 1/sqrt(2)).')); return; }
          const ok = Math.abs(v - target) <= tol;
          say(fb, ok ? 'ok' : 'ko', ok ? (exo.dataset.ok || t('Exact.', 'Correct.')) : (exo.dataset.ko || t(`Vous trouvez ${fmt(v)}. Reprenez le calcul.`, `You get ${fmt(v)}. Check your working.`)));
          markExercise(id, ok);
        }
      });
      const input = exo.querySelector('.num-answer input');
      if (input) input.addEventListener('keydown', e => { if (e.key === 'Enter') btn.click(); });
    });
  }

  function say(el, kind, msg) {
    if (!el) return;
    el.className = 'feedback ' + kind;
    el.innerHTML = msg;
    el.setAttribute('role', 'status');
    if (window.MathJax && MathJax.typesetPromise) MathJax.typesetPromise([el]).catch(() => {});
  }
  const fmt = v => (Math.abs(v) < 1e-3 || Math.abs(v) >= 1e4) ? v.toExponential(3) : String(+v.toFixed(4));

  /* ==========================================================================
     Lab : outils pour les simulations canvas
     ========================================================================== */
  const cssVar = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const palette = () => ({
    paper: cssVar('--paper'), paper2: cssVar('--paper-2'), ink: cssVar('--ink'), ink2: cssVar('--ink-2'),
    muted: cssVar('--muted'), rule: cssVar('--rule'), accent: cssVar('--accent'), blue: cssVar('--blue'),
    ok: cssVar('--ok'), bad: cssVar('--bad'),
    mono: '500 12px "IBM Plex Mono", ui-monospace, monospace',
    sans: '500 12px "IBM Plex Sans", system-ui, sans-serif',
    serif: 'italic 16px "Newsreader", Georgia, serif'
  });

  /** Canvas HiDPI dans `stage`, redessiné au redimensionnement et au changement de thème.
      draw(ctx, w, h, colors) — w, h en pixels CSS. */
  function canvas(stage, draw) {
    const cv = document.createElement('canvas');
    cv.setAttribute('aria-hidden', 'true');
    stage.prepend(cv);
    const ctx = cv.getContext('2d');
    let w = 0, h = 0, colors = palette();
    const redraw = () => { if (draw && w > 1) draw(ctx, w, h, colors); };
    const fit = () => {
      const r = stage.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.max(1, r.width); h = Math.max(1, r.height);
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      redraw();
    };
    // le ResizeObserver déclenche le premier dessin de façon asynchrone :
    // le labo appelant a fini de déclarer son état avant le premier draw()
    new ResizeObserver(fit).observe(stage);
    addEventListener('themechange', () => { colors = palette(); redraw(); });
    return { ctx, canvas: cv, size: () => ({ w, h }), redraw, colors: () => colors };
  }

  /** Boucle d'animation active seulement si le labo est visible (batterie des téléphones).
      step(dt en s, t en s). */
  function loop(stage, step, { autoplay = !reduceMotion } = {}) {
    let raf = 0, last = 0, t = 0, wanted = autoplay, visible = false;
    const tick = now => {
      const dt = Math.min(0.05, (now - last) / 1000 || 0);
      last = now; t += dt;
      step(dt, t);
      raf = requestAnimationFrame(tick);
    };
    const sync = () => {
      const should = wanted && visible && !document.hidden;
      if (should && !raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
      if (!should && raf) { cancelAnimationFrame(raf); raf = 0; }
    };
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; sync(); }, { threshold: 0.05 }).observe(stage);
    document.addEventListener('visibilitychange', sync);
    const api = {
      play() { wanted = true; sync(); },
      pause() { wanted = false; sync(); },
      toggle() { wanted ? api.pause() : api.play(); return wanted; },
      get running() { return wanted; }
    };
    return api;
  }

  /** Relie un <input type=range> à son <output for=id> et à un callback. */
  function bind(input, cb, format = v => v) {
    const out = input.id ? document.querySelector(`output[for="${input.id}"]`) : null;
    const go = () => { const v = parseFloat(input.value); if (out) out.textContent = format(v); cb(v); };
    input.addEventListener('input', go);
    go();
    return go;
  }

  /** Boutons segmentés : <div class="seg"><button data-v="…" aria-pressed="true|false"> */
  function seg(root, cb) {
    const btns = [...root.querySelectorAll('button')];
    const pick = b => { btns.forEach(x => x.setAttribute('aria-pressed', String(x === b))); cb(b.dataset.v); };
    btns.forEach(b => b.addEventListener('click', () => pick(b)));
    pick(btns.find(b => b.getAttribute('aria-pressed') === 'true') || btns[0]);
    return pick;
  }

  /** Glisser souris/tactile, coordonnées relatives au stage. */
  function drag(stage, { start, move, end } = {}) {
    stage.classList.add('drag');
    let active = false;
    const pos = e => { const r = stage.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    stage.addEventListener('pointerdown', e => { active = true; stage.setPointerCapture(e.pointerId); if (start) start(pos(e)); });
    stage.addEventListener('pointermove', e => { if (active && move) move(pos(e)); });
    const stop = e => { if (!active) return; active = false; if (end) end(pos(e)); };
    stage.addEventListener('pointerup', stop);
    stage.addEventListener('pointercancel', stop);
  }

  const draw = {
    arrow(ctx, x1, y1, x2, y2, head = 8) {
      const a = Math.atan2(y2 - y1, x2 - x1);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - head * Math.cos(a - 0.4), y2 - head * Math.sin(a - 0.4));
      ctx.lineTo(x2 - head * Math.cos(a + 0.4), y2 - head * Math.sin(a + 0.4));
      ctx.closePath(); ctx.fill();
    },
    text(ctx, s, x, y, { font, color, align = 'left', base = 'alphabetic' } = {}) {
      if (font) ctx.font = font;
      if (color) ctx.fillStyle = color;
      ctx.textAlign = align; ctx.textBaseline = base; ctx.fillText(s, x, y);
    },
    /** #rrggbb → rgba(…, a) */
    alpha(color, a) {
      const m = /^#?([0-9a-f]{6})$/i.exec(String(color).trim());
      if (!m) return color;
      const n = parseInt(m[1], 16);
      return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
    }
  };

  /* Tirages aléatoires : gaussienne et loi discrète (règle de Born). */
  const rand = {
    gauss() { let u = 0; while (!u) u = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random()); },
    cdf(weights) { const out = new Float64Array(weights.length); let s = 0; for (let i = 0; i < weights.length; i++) { s += weights[i]; out[i] = s; } for (let i = 0; i < out.length; i++) out[i] /= s || 1; return out; },
    pick(cdf) { const r = Math.random(); let lo = 0, hi = cdf.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (cdf[m] < r) lo = m + 1; else hi = m; } return lo; }
  };

  window.Lab = { canvas, loop, bind, seg, drag, draw, rand, palette, reduceMotion, parseNumber, t, LANG, LOCALE };
  window.Carnet = { store, markExercise };

  const ready = () => { initLangSwitch(); initReading(); initRise(); initExercises(); initDone(); initReport(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready); else ready();
})();

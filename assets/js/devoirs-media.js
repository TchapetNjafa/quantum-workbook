/* Médias des devoirs : figures, extrait audio (clics), animations (impacts, compteurs) et tableaux de données.
   Tout est fabriqué par le navigateur à partir de DONNÉES contenues dans la question (voir api/_lib/media.js) : aucun fichier externe,
   aucune bibliothèque. Les séquences sont tirées à l'avance par l'auteur du devoir ; le paramètre caché n'est jamais envoyé à l'étudiant. */
(() => {
  'use strict';
  const EN = (document.documentElement.lang || 'fr').startsWith('en');
  const t = (fr, en) => (EN ? en : fr);
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const couleur = (nom, repli) => getComputedStyle(document.documentElement).getPropertyValue(nom).trim() || repli;
  const PHI = 0.6180339887; // répartition régulière des hauteurs d'impacts (purement visuelle)

  /* ---------- HTML : un bloc par média, placé sous l'énoncé ---------- */
  function bloc(q, m, k) {
    const leg = m.legende ? `<figcaption class="muted">${esc(m.legende)}</figcaption>` : '';
    const id = `data-media="${esc(q.id)}:${k}"`;
    if (m.type === 'image') return `<figure class="dev-media dev-fig"><img src="${esc(m.src)}" alt="${esc(m.alt)}">${leg}</figure>`;
    if (m.type === 'tableau') {
      return `<figure class="dev-media"><div class="dev-tableau" tabindex="0" role="region" aria-label="${esc(m.legende || t('Tableau de données', 'Data table'))}"><table>
        <thead><tr>${m.colonnes.map(c => `<th scope="col">${esc(c)}</th>`).join('')}</tr></thead>
        <tbody>${m.lignes.map(l => `<tr>${l.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>${leg}</figure>`;
    }
    if (m.type === 'clics') {
      return `<figure class="dev-media" ${id}>${leg}<div class="btn-row"><button class="btn small accent" type="button" data-jouer>${t('Écouter', 'Listen')}</button>
        <button class="btn small ghost" type="button" data-stop hidden>${t('Arrêter', 'Stop')}</button></div>
        <progress max="100" value="0" aria-label="${t('Progression de l’extrait', 'Clip progress')}"></progress>
        <p class="muted" data-etat role="status">${t('Casque conseillé ; vous pouvez réécouter autant de fois que nécessaire.', 'Headphones recommended; you can listen again as many times as needed.')}</p></figure>`;
    }
    if (m.type === 'impacts') {
      return `<figure class="dev-media" ${id}>${leg}<canvas class="dev-canvas" height="190" role="img" aria-label="${t('Écran de détection : les impacts s’y accumulent', 'Detection screen: impacts build up on it')}"></canvas>
        <div class="btn-row"><button class="btn small accent" type="button" data-jouer>${t('Lancer l’animation', 'Start the animation')}</button>
        <button class="btn small ghost" type="button" data-tout>${t('Tout afficher', 'Show all')}</button></div>
        <p class="muted" data-etat role="status"></p></figure>`;
    }
    if (m.type === 'compteurs') {
      return `<figure class="dev-media" ${id}>${leg}<div class="dev-compteurs">${m.categories.map((c, i) => `<div class="dev-compteur"><span>${esc(c)}</span><span class="dev-barre"><i data-barre="${i}"></i></span><b data-n="${i}">0</b></div>`).join('')}</div>
        <div class="btn-row"><button class="btn small accent" type="button" data-jouer>${t('Lancer l’animation', 'Start the animation')}</button>
        <button class="btn small ghost" type="button" data-tout>${t('Tout afficher', 'Show all')}</button></div></figure>`;
    }
    return '';
  }
  const html = q => (q.media && q.media.length ? `<div class="dev-medias">${q.media.map((m, k) => bloc(q, m, k)).join('')}</div>` : '');

  /* ---------- extrait audio : un clic grave (0) ou aigu (1) par événement ---------- */
  function clics(el, m) {
    const jouer = el.querySelector('[data-jouer]'), stop = el.querySelector('[data-stop]'), barre = el.querySelector('progress'), etat = el.querySelector('[data-etat]');
    let ctx = null, raf = 0;
    const arreter = () => {
      cancelAnimationFrame(raf);
      if (ctx) { ctx.close().catch(() => {}); ctx = null; }
      jouer.disabled = false; stop.hidden = true; barre.value = 0;
    };
    jouer.addEventListener('click', () => {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { etat.textContent = t('Ce navigateur ne peut pas jouer le son.', 'This browser cannot play the sound.'); return; }
      arreter();
      ctx = new AC();
      const debut = ctx.currentTime + 0.2, pas = m.cadence / 1000, duree = m.sequence.length * pas + 0.3;
      m.sequence.forEach((v, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain(), a = debut + i * pas;
        o.frequency.value = v ? 880 : 330;
        g.gain.setValueAtTime(0.0001, a); g.gain.exponentialRampToValueAtTime(0.5, a + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, a + 0.07);
        o.connect(g); g.connect(ctx.destination); o.start(a); o.stop(a + 0.09);
      });
      jouer.disabled = true; stop.hidden = false; etat.textContent = t('Lecture en cours…', 'Playing…');
      const suivre = () => {
        if (!ctx) return;
        const p = Math.min(100, Math.max(0, ((ctx.currentTime - debut + 0.2) / duree) * 100));
        barre.value = p;
        if (p >= 100) { arreter(); etat.textContent = t('Terminé. Vous pouvez réécouter.', 'Done. You can listen again.'); } else raf = requestAnimationFrame(suivre);
      };
      raf = requestAnimationFrame(suivre);
    });
    stop.addEventListener('click', () => { arreter(); etat.textContent = t('Arrêté.', 'Stopped.'); });
  }

  /* ---------- animation : impacts un à un sur un écran ---------- */
  function impacts(el, m) {
    const cv = el.querySelector('canvas'), etat = el.querySelector('[data-etat]'), jouer = el.querySelector('[data-jouer]');
    let raf = 0, k = 0;
    const dessiner = n => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2), W = cv.clientWidth || 600, H = 190, ZONE = 132, BINS = 60;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = couleur('--paper-2', '#efe8da'); g.fillRect(0, 0, W, H);
      g.strokeStyle = couleur('--rule', '#d8ceba'); g.beginPath(); g.moveTo(0, ZONE + 3); g.lineTo(W, ZONE + 3); g.stroke();
      g.fillStyle = couleur('--ink', '#1d1b17'); g.globalAlpha = 0.65;
      const classes = new Array(BINS).fill(0);
      for (let i = 0; i < n; i++) {
        const x = ((m.positions[i] + 1) / 2) * W, y = 6 + ((i * PHI) % 1) * (ZONE - 12);
        g.fillRect(x - 0.8, y - 0.8, 1.7, 1.7);
        classes[Math.min(BINS - 1, Math.floor(((m.positions[i] + 1) / 2) * BINS))]++;
      }
      g.globalAlpha = 1; g.fillStyle = couleur('--accent', '#b0432a'); // histogramme : nombre d'impacts par bande de l'écran
      const haut = Math.max(1, ...classes), bw = W / BINS;
      classes.forEach((c, i) => { const h = (c / haut) * (H - ZONE - 12); g.fillRect(i * bw + 0.5, H - 4 - h, Math.max(1, bw - 1), h); });
      etat.textContent = n ? t(`${n} impact${n > 1 ? 's' : ''} détecté${n > 1 ? 's' : ''}`, `${n} impact${n > 1 ? 's' : ''} detected`) : t('Écran vide', 'Empty screen');
    };
    dessiner(0);
    const arreter = () => { cancelAnimationFrame(raf); jouer.disabled = false; };
    jouer.addEventListener('click', () => {
      arreter(); jouer.disabled = true; k = 0;
      const t0 = performance.now();
      const pas = now => {
        const n = Math.min(m.positions.length, Math.floor((now - t0) / m.cadence));
        if (n !== k) { k = n; dessiner(k); }
        if (k < m.positions.length) raf = requestAnimationFrame(pas); else arreter();
      };
      raf = requestAnimationFrame(pas);
    });
    el.querySelector('[data-tout]').addEventListener('click', () => { arreter(); k = m.positions.length; dessiner(k); });
  }

  /* ---------- animation : compteurs qui montent (cascade de Stern-Gerlach, comptage de détecteurs…) ---------- */
  function compteurs(el, m) {
    const jouer = el.querySelector('[data-jouer]');
    let raf = 0;
    const afficher = n => {
      const c = m.categories.map(() => 0);
      for (let i = 0; i < n; i++) c[m.evenements[i]]++;
      const max = Math.max(1, ...c);
      c.forEach((v, i) => { el.querySelector(`[data-n="${i}"]`).textContent = v; el.querySelector(`[data-barre="${i}"]`).style.width = `${(100 * v) / max}%`; });
    };
    const arreter = () => { cancelAnimationFrame(raf); jouer.disabled = false; };
    jouer.addEventListener('click', () => {
      arreter(); jouer.disabled = true; afficher(0);
      const t0 = performance.now();
      const pas = now => {
        const n = Math.min(m.evenements.length, Math.floor((now - t0) / m.cadence));
        afficher(n);
        if (n < m.evenements.length) raf = requestAnimationFrame(pas); else arreter();
      };
      raf = requestAnimationFrame(pas);
    });
    el.querySelector('[data-tout]').addEventListener('click', () => { arreter(); afficher(m.evenements.length); });
  }

  const MONTEURS = { clics, impacts, compteurs };
  /** Branche les médias interactifs d'un devoir déjà affiché dans `root`. */
  function monter(root, questions) {
    root.querySelectorAll('[data-media]').forEach(el => {
      const [qid, k] = el.dataset.media.split(':');
      const q = questions.find(x => x.id === qid), m = q && q.media && q.media[Number(k)];
      if (m && MONTEURS[m.type]) MONTEURS[m.type](el, m);
    });
  }

  window.phy321Media = { html, monter };
})();

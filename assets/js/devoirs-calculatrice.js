/* Calculatrice scientifique et pavé numérique des devoirs (FR + EN).
   - Calculatrice : panneau dans la page (aucun nouvel onglet, aucune navigation) : un devoir surveillé n'est donc jamais quitté pour calculer.
   - Pavé numérique : sur écran tactile, un champ de réponse numérique ouvre un pavé à l'écran (chiffres, virgule, point, signe moins, exposant)
     au lieu du clavier du téléphone. Le clavier décimal d'iPhone n'offre ni virgule ni point selon la région, et jamais le signe moins.
   Dépend de assets/js/calc-eval.js. Interface : window.phy321Calc.monter(form) / demonter(). */
(() => {
  'use strict';
  const E = globalThis.phy321CalcEval;
  if (!E) return;
  const EN = (document.documentElement.lang || 'fr').startsWith('en');
  const t = (fr, en) => (EN ? en : fr);
  const ETROIT = matchMedia('(max-width: 1023px)');   // barre du bas visible : les panneaux se posent au-dessus
  const tactile = matchMedia('(pointer: coarse)').matches;
  const DECIMAL = EN ? '.' : ',';

  let racine = null;
  let nettoyer = [];   // fonctions de nettoyage (écouteurs hors de la racine)

  const el = (balise, classe, html) => { const n = document.createElement(balise); if (classe) n.className = classe; if (html !== undefined) n.innerHTML = html; return n; };
  const touche = (texte, classe, attrs = {}) => {
    const b = el('button', classe, texte); b.type = 'button';
    for (const [k, v] of Object.entries(attrs)) b.setAttribute(k, v);
    b.addEventListener('pointerdown', e => e.preventDefault()); // le champ de réponse garde le focus (et sa position de saisie)
    return b;
  };

  /* ---------- saisie dans un champ ordinaire (pavé et bouton « Insérer ») ---------- */
  function inserer(champ, texte) {
    const a = champ.selectionStart ?? champ.value.length, b = champ.selectionEnd ?? a;
    champ.setRangeText(texte, a, b, 'end');
    champ.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function effacer(champ) {
    let a = champ.selectionStart ?? champ.value.length; const b = champ.selectionEnd ?? a;
    if (a === b) { if (a === 0) return; a -= 1; }
    champ.setRangeText('', a, b, 'end');
    champ.dispatchEvent(new Event('input', { bubbles: true }));
  }

  /* ---------- pavé numérique ---------- */
  function construirePave(form) {
    const pave = el('div', 'pave');
    pave.hidden = true; pave.setAttribute('role', 'group'); pave.setAttribute('aria-label', t('Pavé numérique', 'Number pad'));
    const tete = el('div', 'pave-tete');
    const sys = touche(t('Clavier du téléphone', 'Phone keyboard'), 'btn small ghost');
    const fermer = touche(t('Fermer', 'Close'), 'btn small ghost');
    tete.append(sys, fermer);
    const grille = el('div', 'pave-grille');
    const dispo = [['7', '8', '9', 'eff'], ['4', '5', '6', '-'], ['1', '2', '3', ','], ['0', '.', 'e', 'ok']];
    let actif = null;
    const ajouter = (b, f) => { b.addEventListener('click', f); grille.append(b); };
    for (const ligne of dispo) for (const k of ligne) {
      if (k === 'eff') ajouter(touche('⌫', 'pave-k', { 'aria-label': t('Effacer', 'Delete') }), () => actif && effacer(actif));
      else if (k === 'ok') ajouter(touche('OK', 'pave-k pave-ok', { 'aria-label': t('Fermer le pavé', 'Close the pad') }), () => fermerPave());
      else if (k === 'e') ajouter(touche('×10<sup>n</sup>', 'pave-k', { 'aria-label': t('Exposant : puissance de 10 (écrit e)', 'Exponent: power of ten (written e)') }), () => actif && inserer(actif, 'e'));
      else if (k === '-') ajouter(touche('−', 'pave-k', { 'aria-label': t('Moins', 'Minus') }), () => actif && inserer(actif, '-')); // ASCII : le serveur lit « - », pas « − »
      else ajouter(touche(k, 'pave-k'), () => actif && inserer(actif, k));
    }
    pave.append(tete, grille);

    function ouvrirPave(champ) {
      actif = champ; pave.hidden = false; racine.classList.add('pave-ouvert');
      document.body.style.paddingBottom = `${pave.offsetHeight}px`; // la page peut défiler jusqu'au bas, sous le pavé
      const r = champ.getBoundingClientRect(), haut = pave.getBoundingClientRect().top;
      if (r.bottom > haut - 16) window.scrollBy({ top: r.bottom - haut + 24 }); // le champ reste visible au-dessus du pavé
    }
    function fermerPave() { actif = null; pave.hidden = true; racine.classList.remove('pave-ouvert'); document.body.style.paddingBottom = ''; }
    fermer.addEventListener('click', fermerPave);
    sys.addEventListener('click', () => { // retour au clavier du téléphone pour ce champ, le temps d'une saisie
      const c = actif; if (!c) return;
      c.dataset.clavier = 'attente'; c.inputMode = 'text'; fermerPave(); c.blur(); setTimeout(() => c.focus(), 60); // « attente » : le blur provoqué ici ne remet pas le pavé
    });

    if (tactile) {
      form.querySelectorAll('input[data-num]').forEach(c => {
        c.inputMode = 'none';
        c.addEventListener('focus', () => { if (!c.dataset.clavier) ouvrirPave(c); });
        c.addEventListener('blur', () => {
          if (c.dataset.clavier === 'attente') { c.dataset.clavier = 'sys'; return; }
          if (c.dataset.clavier === 'sys') { delete c.dataset.clavier; c.inputMode = 'none'; return; } // fin de la saisie au clavier du téléphone : le pavé revient au prochain toucher
          setTimeout(() => { if (!(document.activeElement && document.activeElement.matches('input[data-num]'))) fermerPave(); }, 0);
        });
      });
    }
    return { pave, fermerPave };
  }

  /* ---------- calculatrice ---------- */
  function construireCalculatrice(form, fermerPave) {
    let expr = '', res = null, ans = 0, deg = true, fini = false, erreur = false;
    const bouton = touche(t('Calculatrice', 'Calculator'), 'btn small calc-bouton', { 'aria-expanded': 'false', 'aria-controls': 'calc-panneau' });
    const panneau = el('div', 'calc'); panneau.id = 'calc-panneau'; panneau.hidden = true; panneau.tabIndex = -1;
    panneau.setAttribute('role', 'dialog'); panneau.setAttribute('aria-label', t('Calculatrice scientifique', 'Scientific calculator'));
    const tete = el('div', 'calc-tete', `<b>${t('Calculatrice', 'Calculator')}</b>`);
    const fermer = touche(t('Fermer', 'Close'), 'btn small ghost'); tete.append(fermer);
    const ecran = el('div', 'calc-ecran');
    const ligneExpr = el('div', 'calc-expr');
    const ligneRes = el('output', 'calc-res'); ligneRes.setAttribute('aria-live', 'polite');
    ecran.append(ligneExpr, ligneRes);
    const touches = el('div', 'calc-touches');
    const msg = el('p', 'calc-msg muted'); msg.setAttribute('role', 'status');
    const insere = touche(t('Insérer le résultat dans la réponse', 'Insert the result in the answer'), 'btn small accent calc-inserer');
    panneau.append(tete, ecran, touches, insere, msg);

    const mode = touche('DEG', 'calc-k calc-fn');
    const aff = x => E.formater(x, !EN);
    function rafraichir() {
      ligneExpr.textContent = expr || '0';
      if (erreur) { ligneRes.textContent = t('Erreur', 'Error'); ligneRes.dataset.etat = 'erreur'; }
      else if (res !== null) { ligneRes.textContent = `${fini ? '= ' : ''}${aff(res)}`; ligneRes.dataset.etat = fini ? 'final' : 'apercu'; }
      else { ligneRes.textContent = ''; ligneRes.dataset.etat = ''; }
      insere.disabled = res === null || erreur;
      mode.textContent = deg ? 'DEG' : 'RAD';
      mode.setAttribute('aria-label', t(`Angles en ${deg ? 'degrés' : 'radians'} : basculer`, `Angles in ${deg ? 'degrees' : 'radians'}: switch`));
      ligneExpr.scrollLeft = ligneExpr.scrollWidth;
    }
    function calculer(final) { // aperçu pendant la saisie, valeur définitive avec « = »
      try { res = expr.trim() ? E.evaluer(expr, { deg, ans }) : null; erreur = false; }
      catch { res = null; erreur = final && expr.trim() !== ''; }
      if (final && res !== null) { ans = res; fini = true; }
    }
    const OPS = new Set(['+', '−', '×', '÷', '^']);
    function ajouter(s) {
      msg.textContent = '';
      if (fini) { expr = OPS.has(s) ? 'Ans' : ''; fini = false; } // après « = » : un opérateur continue le calcul, autre chose repart de zéro
      expr += s; erreur = false; calculer(false); rafraichir();
    }
    function retour() {
      if (fini || erreur) { expr = ''; fini = false; erreur = false; }
      else expr = expr.replace(/(?:asin|acos|atan|sin|cos|tan|sqrt|exp|abs|log|ln)\($|√\($|Ans$|[\s\S]$/u, '');
      res = null; msg.textContent = ''; calculer(false); rafraichir();
    }
    function toutEffacer() { expr = ''; res = null; fini = false; erreur = false; msg.textContent = ''; rafraichir(); }
    function egal() { if (!expr.trim()) return; calculer(true); rafraichir(); }

    mode.addEventListener('click', () => { deg = !deg; calculer(false); if (fini) calculer(true); rafraichir(); });
    const T = (txt, ins, aria, cl = '') => { const b = touche(txt, `calc-k ${cl}`.trim(), aria ? { 'aria-label': aria } : {}); b.addEventListener('click', () => ajouter(ins)); return b; };
    const A = (txt, aria, f) => { const b = touche(txt, 'calc-k calc-fn', { 'aria-label': aria }); b.addEventListener('click', f); return b; };
    touches.append(
      mode, T('sin', 'sin(', t('sinus', 'sine'), 'calc-fn'), T('cos', 'cos(', t('cosinus', 'cosine'), 'calc-fn'), T('tan', 'tan(', t('tangente', 'tangent'), 'calc-fn'), A('⌫', t('Effacer', 'Delete'), retour),
      T('π', 'π', 'pi', 'calc-fn'), T('sin⁻¹', 'asin(', t('arc sinus', 'inverse sine'), 'calc-fn'), T('cos⁻¹', 'acos(', t('arc cosinus', 'inverse cosine'), 'calc-fn'), T('tan⁻¹', 'atan(', t('arc tangente', 'inverse tangent'), 'calc-fn'), A('C', t('Tout effacer', 'Clear all'), toutEffacer),
      T('x²', '^2', t('au carré', 'squared'), 'calc-fn'), T('√', '√(', t('racine carrée', 'square root'), 'calc-fn'), T('xʸ', '^', t('puissance', 'power'), 'calc-fn'), T('ln', 'ln(', t('logarithme népérien', 'natural logarithm'), 'calc-fn'), T('log', 'log(', t('logarithme décimal', 'base-10 logarithm'), 'calc-fn'),
      T('(', '(', t('parenthèse ouvrante', 'open parenthesis'), 'calc-fn'), T(')', ')', t('parenthèse fermante', 'close parenthesis'), 'calc-fn'), T('1/x', '^(−1)', t('inverse', 'reciprocal'), 'calc-fn'), T('eˣ', 'exp(', t('exponentielle', 'exponential'), 'calc-fn'), T('10ˣ', '10^(', t('dix puissance', 'ten to the power'), 'calc-fn'),
      T('7', '7'), T('8', '8'), T('9', '9'), T('÷', '÷', t('divisé par', 'divided by'), 'calc-op'), T('Ans', 'Ans', t('dernier résultat', 'last result'), 'calc-fn'),
      T('4', '4'), T('5', '5'), T('6', '6'), T('×', '×', t('fois', 'times'), 'calc-op'), T('EE', 'E', t('exposant : fois dix puissance', 'exponent: times ten to the power'), 'calc-fn'),
      T('1', '1'), T('2', '2'), T('3', '3'), T('−', '−', t('moins', 'minus'), 'calc-op'), T('e', 'e', t('nombre e', 'Euler’s number'), 'calc-fn'),
      T('0', '0'), T(DECIMAL, DECIMAL, t('séparateur décimal', 'decimal separator')), T('+', '+', t('plus', 'plus'), 'calc-op'), A('=', t('égale', 'equals'), egal)
    );
    touches.lastChild.className = 'calc-k calc-egal';

    /* Insertion du résultat dans le dernier champ de réponse touché. */
    let dernier = null;
    form.addEventListener('focusin', e => { if (e.target.matches && e.target.matches('input[type="text"], textarea')) dernier = e.target; });
    insere.addEventListener('click', () => {
      if (res === null) return;
      if (!dernier || !form.contains(dernier) || dernier.disabled) { msg.textContent = t('Touchez d’abord le champ de la réponse, puis « Insérer ».', 'Tap the answer field first, then “Insert”.'); return; }
      const texte = E.formater(res, !EN);
      if (dernier.matches('[data-num]')) { dernier.value = texte; dernier.dispatchEvent(new Event('input', { bubbles: true })); }
      else inserer(dernier, texte);
      const n = [...form.querySelectorAll('fieldset.diag-q')].findIndex(f => f.contains(dernier)) + 1;
      msg.textContent = n ? t(`Résultat inséré dans la réponse à la question ${n}.`, `Result inserted in the answer to question ${n}.`) : t('Résultat inséré.', 'Result inserted.');
    });

    /* Clavier d'ordinateur, tant que le focus est dans le panneau. */
    panneau.addEventListener('keydown', e => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key;
      const carte = { '*': '×', '/': '÷', '-': '−', ',': DECIMAL, '.': DECIMAL };
      if (k === 'Escape') { basculer(false); bouton.focus(); }
      else if (k === 'Enter' || k === '=') egal();
      else if (k === 'Backspace') retour();
      else if (k === 'Delete') toutEffacer();
      else if (/^[0-9+^()E]$/.test(k)) ajouter(k);
      else if (carte[k]) ajouter(carte[k]);
      else return;
      e.preventDefault();
    });

    const placer = () => { document.body.style.paddingBottom = !panneau.hidden && ETROIT.matches ? `${panneau.offsetHeight}px` : ''; };
    function basculer(ouvert) {
      if (ouvert) fermerPave();
      panneau.hidden = !ouvert; bouton.setAttribute('aria-expanded', String(ouvert));
      racine.classList.toggle('calc-ouverte', ouvert);
      if (ouvert && !tactile) panneau.focus();
      placer();
    }
    bouton.addEventListener('click', () => basculer(panneau.hidden));
    fermer.addEventListener('click', () => basculer(false));
    ETROIT.addEventListener('change', placer); nettoyer.push(() => ETROIT.removeEventListener('change', placer));
    rafraichir();
    return [bouton, panneau];
  }

  function demonter() {
    nettoyer.forEach(f => f()); nettoyer = [];
    if (racine) racine.remove();
    racine = null; document.body.style.paddingBottom = '';
  }

  function monter(form) {
    demonter();
    if (!form) return;
    racine = el('div', 'calc-racine');
    const { pave, fermerPave } = construirePave(form);
    racine.append(...construireCalculatrice(form, fermerPave), pave);
    document.body.append(racine);
  }

  window.phy321Calc = { monter, demonter };
})();

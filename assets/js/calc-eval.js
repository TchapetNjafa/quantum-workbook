/* Évaluateur de la calculatrice des devoirs. Pas d'eval ni de Function : analyse descendante récursive sur une grammaire fermée.
   Accepte , ou . comme séparateur décimal, E comme exposant (1,5E-3), e (Euler), pi/π, Ans, + - − × ÷ * / ^ ( ),
   la multiplication implicite (2π, 3(4), 2sin(30)) et des parenthèses finales omises.
   Fonctions : sin cos tan asin acos atan (degrés ou radians), ln log (base 10) exp sqrt abs. Utilisé dans le navigateur et par tests/test-calculatrice.mjs. */
(() => {
  const MAX = 300;
  const NOMBRE = /^(?:\d+[.,]?\d*|[.,]\d+)(?:E[+-]?\d+)?/;
  const FONCTIONS = ['asin', 'acos', 'atan', 'sin', 'cos', 'tan', 'sqrt', 'exp', 'abs', 'log', 'ln']; // les plus longues d'abord
  const MOTS = [...FONCTIONS, 'ans', 'pi'];
  const CONSTANTES = { pi: Math.PI, e: Math.E };

  function jetons(src) {
    const J = [];
    let s = src.replace(/\s+/g, '').replace(/[−–]/g, '-').replace(/×/g, '*').replace(/÷/g, '/').replace(/√/g, 'sqrt').replace(/π/g, 'pi');
    while (s.length) {
      const m = NOMBRE.exec(s);
      if (m) { J.push({ t: 'n', v: Number(m[0].replace(',', '.')) }); s = s.slice(m[0].length); continue; }
      const mot = MOTS.find(w => s.slice(0, w.length).toLowerCase() === w) || (/^e/i.test(s) ? 'e' : null);
      if (mot) { J.push({ t: 'm', v: mot }); s = s.slice(mot.length); continue; }
      if ('+-*/^()'.includes(s[0])) { J.push({ t: 'o', v: s[0] }); s = s.slice(1); continue; }
      throw new Error('caractère inattendu');
    }
    return J;
  }

  const entier90 = x => Math.abs(x / 90 - Math.round(x / 90)) < 1e-12;
  function trigDeg(f, x) { // valeurs exactes aux multiples de 90° (sin 180° = 0, et non 1,2E-16)
    if (entier90(x)) {
      const k = ((Math.round(x / 90) % 4) + 4) % 4;
      if (f === 'sin') return [0, 1, 0, -1][k];
      if (f === 'cos') return [1, 0, -1, 0][k];
      return k % 2 ? NaN : 0; // tan 90° est indéfinie
    }
    return Math[f](x * Math.PI / 180);
  }
  const net = x => (Math.abs(x) < 1e-15 ? 0 : x); // sin π = 1,2E-16 en machine : 0 à l'affichage, comme sur une calculatrice

  function appliquer(nom, x, deg) {
    switch (nom) {
      case 'sin': case 'cos': case 'tan': return deg ? trigDeg(nom, x) : net(Math[nom](x));
      case 'asin': case 'acos': case 'atan': { const r = Math[nom](x); return deg ? r * 180 / Math.PI : r; }
      case 'ln': return Math.log(x);
      case 'log': return Math.log10(x);
      case 'exp': return Math.exp(x);
      case 'sqrt': return Math.sqrt(x);
      default: return Math.abs(x);
    }
  }

  /** Évalue `src`. Options : deg (true : angles en degrés), ans (dernier résultat). Lève une Error si l'expression est invalide ou si le résultat n'est pas un nombre fini. */
  function evaluer(src, { deg = true, ans = 0 } = {}) {
    if (typeof src !== 'string' || !src.trim() || src.length > MAX) throw new Error('expression vide ou trop longue');
    const J = jetons(src);
    let i = 0;
    const vu = () => J[i];
    const op = v => vu() && vu().t === 'o' && vu().v === v;
    const debutValeur = () => vu() && (vu().t === 'n' || vu().t === 'm' || op('('));

    function expr() {
      let x = terme();
      while (op('+') || op('-')) { const o = J[i++].v; const y = terme(); x = o === '+' ? x + y : x - y; }
      return x;
    }
    function terme() {
      let x = unaire();
      for (;;) {
        if (op('*') || op('/')) { const o = J[i++].v; const y = unaire(); x = o === '*' ? x * y : x / y; }
        else if (debutValeur()) x *= unaire(); // multiplication implicite
        else return x;
      }
    }
    function unaire() {
      if (op('-')) { i++; return -unaire(); }
      if (op('+')) { i++; return unaire(); }
      return puissance();
    }
    function puissance() {
      const x = primaire();
      if (op('^')) { i++; return Math.pow(x, unaire()); } // associative à droite ; 2^-3 permis
      return x;
    }
    function primaire() {
      const j = vu();
      if (!j) throw new Error('expression incomplète');
      if (j.t === 'n') { i++; return j.v; }
      if (op('(')) { i++; const x = expr(); if (op(')')) i++; return x; } // « ) » finale omise : tolérée
      if (j.t === 'm') {
        i++;
        if (j.v === 'ans') return ans;
        if (j.v in CONSTANTES) return CONSTANTES[j.v];
        let x; // fonction : argument entre parenthèses, ou directement un nombre ou une fonction (sin30, √9)
        if (op('(')) { i++; x = expr(); if (op(')')) i++; } else x = puissance();
        return appliquer(j.v, x, deg);
      }
      throw new Error('opérateur inattendu');
    }

    const r = expr();
    if (i < J.length) throw new Error('expression invalide');
    if (!Number.isFinite(r)) throw new Error('résultat non défini');
    return r;
  }

  /** Mise en forme d'un résultat : 10 chiffres significatifs, notation scientifique si très grand ou très petit. `virgule` : séparateur décimal français. */
  function formater(x, virgule = false) {
    const v = Number(x.toPrecision(10)) || 0; // || 0 : supprime -0
    const a = Math.abs(v);
    let s = a !== 0 && (a >= 1e10 || a < 1e-4) ? v.toExponential().replace('e+', 'e') : String(v);
    if (s.includes('e')) s = s.replace(/\.?0+e/, 'e');
    return virgule ? s.replace('.', ',') : s;
  }

  globalThis.phy321CalcEval = { evaluer, formater };
})();

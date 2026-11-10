// Évaluateur d'expressions arithmétiques pour les réponses calculées des devoirs (variables par étudiant).
// Pas d'eval ni de Function : analyse descendante récursive sur une grammaire fermée.
//   nombres, variables fournies, `pi`, + - * / ^ (associative à droite), parenthèses, moins unaire,
//   fonctions à un argument : sin cos tan (radians), sind cosd tand asind acosd atand (degrés), sqrt exp ln abs.
const RAD = Math.PI / 180;
const FONCTIONS = new Map([
  ['sin', Math.sin], ['cos', Math.cos], ['tan', Math.tan],
  ['sind', x => Math.sin(x * RAD)], ['cosd', x => Math.cos(x * RAD)], ['tand', x => Math.tan(x * RAD)],
  ['asind', x => Math.asin(x) / RAD], ['acosd', x => Math.acos(x) / RAD], ['atand', x => Math.atan(x) / RAD],
  ['sqrt', Math.sqrt], ['exp', Math.exp], ['ln', Math.log], ['abs', Math.abs]
]);
const MAX = 200;

function lexer(src) {
  const jetons = [];
  const re = /\s*(?:(\d*\.?\d+(?:[eE][+-]?\d+)?)|([A-Za-z_][A-Za-z0-9_]*)|([-+*/^()]))/y;
  let pos = 0;
  while (pos < src.length) {
    re.lastIndex = pos;
    const m = re.exec(src);
    if (!m) { if (/^\s*$/.test(src.slice(pos))) break; throw new Error(`expression invalide : caractère inattendu près de « ${src.slice(pos, pos + 8).trim()} »`); }
    pos = re.lastIndex;
    if (m[1] !== undefined) jetons.push({ t: 'num', v: Number(m[1]) });
    else if (m[2] !== undefined) jetons.push({ t: 'id', v: m[2] });
    else jetons.push({ t: 'op', v: m[3] });
  }
  return jetons;
}

/** Évalue `src` avec les variables `vars` (objet de nombres). Lève une Error si l'expression est invalide. Le résultat peut être non fini (à tester par l'appelant). */
export function evaluer(src, vars = {}) {
  if (typeof src !== 'string' || !src.trim() || src.length > MAX) throw new Error('expression invalide : vide ou trop longue');
  const J = lexer(src);
  let i = 0;
  const vu = () => J[i];
  const op = v => vu() && vu().t === 'op' && vu().v === v;
  const attendre = v => { if (!op(v)) throw new Error(`expression invalide : « ${v} » attendu`); i++; };

  function expr() {
    let x = terme();
    while (op('+') || op('-')) { const o = J[i++].v; const y = terme(); x = o === '+' ? x + y : x - y; }
    return x;
  }
  function terme() {
    let x = unaire();
    while (op('*') || op('/')) { const o = J[i++].v; const y = unaire(); x = o === '*' ? x * y : x / y; }
    return x;
  }
  function unaire() {
    if (op('-')) { i++; return -unaire(); }
    if (op('+')) { i++; return unaire(); }
    return puissance();
  }
  function puissance() {
    const b = atome();
    if (op('^')) { i++; return b ** unaire(); } // exposant : associativité à droite, moins unaire permis (2^-1)
    return b;
  }
  function atome() {
    const j = J[i++];
    if (!j) throw new Error('expression invalide : fin inattendue');
    if (j.t === 'num') return j.v;
    if (j.t === 'op' && j.v === '(') { const x = expr(); attendre(')'); return x; }
    if (j.t === 'id') {
      if (op('(')) {
        const f = FONCTIONS.get(j.v);
        if (!f) throw new Error(`expression invalide : fonction inconnue « ${j.v} »`);
        i++; const x = expr(); attendre(')');
        return f(x);
      }
      if (j.v === 'pi') return Math.PI;
      if (Object.hasOwn(vars, j.v) && typeof vars[j.v] === 'number' && Number.isFinite(vars[j.v])) return vars[j.v];
      throw new Error(`expression invalide : variable inconnue « ${j.v} »`);
    }
    throw new Error(`expression invalide : « ${j.v} » inattendu`);
  }

  const r = expr();
  if (i < J.length) throw new Error(`expression invalide : « ${J[i].v} » inattendu`);
  return r;
}

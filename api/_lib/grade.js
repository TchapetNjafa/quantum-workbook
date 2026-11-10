// Validation d'un devoir et correction automatique côté serveur (fonctions pures).
// Types corrigés : qcm, vrai_faux, numerical, multi (cases à cocher), appariement ; interpretation : correction manuelle.
// Variantes par étudiant : une question peut déclarer `variables` ({ a: [30, 60, 90] }) ; chaque étudiant reçoit, selon une graine
// (son adresse + le devoir), UNE valeur de chaque liste, substituée dans {a} / {a:fr} ; la réponse numérique attendue peut être une expression.
import { createHash } from 'node:crypto';
import { evaluer } from './expr.js';
import { validerMedias } from './media.js';

export const TYPES = ['qcm', 'vrai_faux', 'numerical', 'multi', 'appariement', 'interpretation'];
export const LABOS = ['young', 'mz', 'phasors', 'qubit', 'deco', 'sg', 'op', 'rb']; // simulateurs du Carnet affichables dans un devoir (labos des chapitres 1 et 2)
const SECRETS = ['correct_answer', 'tolerance', 'explanation', 'sample_answer', 'variables'];
const TAILLE_MAX = 900_000; // octets de JSON pour l'ensemble des questions (les médias sont des données)

/** Adresse e-mail reçue dans l'URL : décodée sans exception, en minuscules, ou null si elle est invalide. */
export function decoderEmail(brut) {
  try {
    const e = decodeURIComponent(String(brut)).trim().toLowerCase();
    return e.length > 0 && e.length <= 254 && /^[^\s@]+@[^\s@]+$/.test(e) ? e : null;
  } catch { return null; }
}

const texte = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const arrondi4 = x => Math.round(x * 1e4) / 1e4;

// ---------- variantes par étudiant ----------
// Un espace réservé {nom} ou {nom:fr} n'est reconnu que s'il n'est pas collé à une lettre, un chiffre, _, ^ ou \ (donc jamais dans \ket{x}, x_{a}, \mathbb{R}).
const ESPACE = /(?<![\\\w^_]){([A-Za-z_][A-Za-z0-9_]*)(:fr)?}/g;
const NOM_VARIABLE = /^[A-Za-z_][A-Za-z0-9_]{0,15}$/;
const RESERVES = new Set(['pi', 'sin', 'cos', 'tan', 'sind', 'cosd', 'tand', 'asind', 'acosd', 'atand', 'sqrt', 'exp', 'ln', 'abs']);

/** Remplace {a} par 0.28 et {a:fr} par 0{,}28 (virgule décimale sûre dans une formule LaTeX) ; un nom inconnu reste tel quel. */
export function substituer(s, valeurs) {
  if (typeof s !== 'string') return s;
  return s.replace(ESPACE, (m, nom, fr) => (Object.hasOwn(valeurs, nom) ? (fr ? String(valeurs[nom]).replace('.', '{,}') : String(valeurs[nom])) : m));
}

/** Valeurs de la variante d'un étudiant : un indice par variable, tiré d'un hachage de graine|question|variable (déterministe). */
export function valeursVariante(q, graine = '') {
  const v = q && q.variables;
  if (!v || typeof v !== 'object') return {};
  const out = {};
  for (const nom of Object.keys(v).sort()) {
    const liste = v[nom];
    const h = createHash('sha256').update(`${graine}|${q.id}|${nom}`).digest();
    out[nom] = liste[h.readUInt32BE(0) % liste.length];
  }
  return out;
}

const combinaisons = variables => {
  const noms = Object.keys(variables);
  let tous = [{}];
  for (const nom of noms) tous = tous.flatMap(base => variables[nom].map(x => ({ ...base, [nom]: x })));
  return tous;
};

const estNombreTexte = s => typeof s === 'string' && s.trim() !== '' && Number.isFinite(Number(s.replace(',', '.')));

/** Valide `variables` d'une question ; renvoie la copie normalisée ou undefined. */
function validerVariables(brut, n, erreurs) {
  if (brut === undefined) return undefined;
  const noms = brut && typeof brut === 'object' && !Array.isArray(brut) ? Object.keys(brut) : [];
  const bon = noms.length >= 1 && noms.length <= 4 && noms.every(nom => NOM_VARIABLE.test(nom) && !RESERVES.has(nom)
    && Array.isArray(brut[nom]) && brut[nom].length >= 2 && brut[nom].length <= 12 && brut[nom].every(x => typeof x === 'number' && Number.isFinite(x)) && new Set(brut[nom]).size === brut[nom].length);
  if (!bon) { erreurs.push(`${n} : variables invalides (1 à 4 noms ; chacun une liste de 2 à 12 nombres distincts ; noms réservés interdits)`); return undefined; }
  return Object.fromEntries(noms.map(nom => [nom, [...brut[nom]]]));
}

/** Vérifie la réponse (nombre ou expression) et la tolérance d'un numérique à variables, sur toutes les combinaisons. */
function validerExpressions(q, n, erreurs) {
  const combos = combinaisons(q.variables);
  for (const champ of ['correct_answer', 'tolerance']) {
    const brut = q[champ];
    if (brut === undefined && champ === 'tolerance') continue;
    if (typeof brut === 'number' || estNombreTexte(brut)) { if (!Number.isFinite(Number(String(brut).replace(',', '.'))) || (champ === 'tolerance' && Number(brut) < 0)) erreurs.push(`${n} : ${champ} invalide`); continue; }
    if (typeof brut !== 'string') { erreurs.push(`${n} : ${champ} doit être un nombre ou une expression`); continue; }
    for (const c of combos) {
      let v;
      try { v = evaluer(brut, c); } catch (e) { erreurs.push(`${n} : ${champ} : ${e.message}`); return; }
      if (!Number.isFinite(v) || (champ === 'tolerance' && v < 0)) { erreurs.push(`${n} : ${champ} non fini ou négatif pour ${JSON.stringify(c)}`); return; }
    }
  }
}

/** Vérifie que tout {nom} d'un texte de question désigne une variable déclarée. */
function verifierEspaces(q, n, erreurs) {
  const textes = [q.question, q.explanation, ...(q.options || []), ...(q.gauche || [])].filter(x => typeof x === 'string');
  const connus = new Set(Object.keys(q.variables || {}));
  for (const t of textes) for (const m of t.matchAll(ESPACE)) if (!connus.has(m[1])) return erreurs.push(`${n} : variable {${m[1]}} non déclarée dans « variables »`);
}

/** Vérifie et normalise un devoir envoyé par l'enseignant. Renvoie { ok, erreurs, devoir }. */
export function valider(d) {
  const erreurs = [];
  const ouvre = new Date(d?.ouvre), ferme = new Date(d?.ferme);
  if (!texte(d?.titre, 200)) erreurs.push('titre manquant ou trop long');
  if (isNaN(ouvre) || isNaN(ferme)) erreurs.push('dates ouvre/ferme invalides');
  else if (ferme <= ouvre) erreurs.push('ferme doit suivre ouvre');
  // Un devoir « copie seule » (sujet PDF, l'étudiant dépose sa copie) n'a pas de question ; sinon 1 à 60 questions.
  const sansQuestion = d?.copie === true && (d.questions === undefined || (Array.isArray(d.questions) && d.questions.length === 0));
  if (!sansQuestion && (!Array.isArray(d?.questions) || d.questions.length < 1 || d.questions.length > 60)) erreurs.push('1 à 60 questions attendues (ou aucune pour un devoir à copie déposée)');
  if (d?.bareme !== undefined && !(Number(d.bareme) > 0 && Number(d.bareme) <= 100)) erreurs.push('barème entre 0 et 100');
  const questions = [];
  (Array.isArray(d?.questions) ? d.questions : []).forEach((q, i) => {
    const n = `question ${i + 1}`;
    if (!TYPES.includes(q?.type)) return erreurs.push(`${n} : type inconnu`);
    if (!texte(q.question, 2000)) return erreurs.push(`${n} : énoncé manquant`);
    const points = q.points === undefined ? 1 : Number(q.points);
    if (!(points > 0 && points <= 20)) return erreurs.push(`${n} : points invalides`);
    const out = { id: `q${i + 1}`, type: q.type, question: q.question, points };
    if (q.labo !== undefined) { if (!LABOS.includes(q.labo)) return erreurs.push(`${n} : labo inconnu (${LABOS.join(', ')})`); out.labo = q.labo; }
    const variables = validerVariables(q.variables, n, erreurs);
    if (variables) out.variables = variables;
    const { medias } = validerMedias(q.media, n, erreurs);
    if (medias) out.media = medias;
    const options = () => Array.isArray(q.options) && q.options.length >= 2 && q.options.length <= 8 && q.options.every(o => texte(o, 500));
    if (q.type === 'qcm') {
      if (!options()) return erreurs.push(`${n} : 2 à 8 options attendues`);
      if (!Number.isInteger(q.correct_answer) || q.correct_answer < 0 || q.correct_answer >= q.options.length) return erreurs.push(`${n} : correct_answer hors des options`);
      Object.assign(out, { options: q.options, correct_answer: q.correct_answer });
    } else if (q.type === 'multi') {
      if (!options()) return erreurs.push(`${n} : 2 à 8 options attendues`);
      const c = q.correct_answer;
      if (!Array.isArray(c) || c.length < 1 || !c.every(x => Number.isInteger(x) && x >= 0 && x < q.options.length) || new Set(c).size !== c.length) return erreurs.push(`${n} : multi : correct_answer doit être une liste non vide d'indices d'options distincts`);
      Object.assign(out, { options: q.options, correct_answer: [...c].sort((a, b) => a - b) });
    } else if (q.type === 'appariement') {
      if (!Array.isArray(q.gauche) || q.gauche.length < 2 || q.gauche.length > 8 || !q.gauche.every(g => texte(g, 500))) return erreurs.push(`${n} : gauche : 2 à 8 éléments à associer attendus`);
      if (!options()) return erreurs.push(`${n} : 2 à 8 options attendues`);
      const c = q.correct_answer;
      if (!Array.isArray(c) || c.length !== q.gauche.length || !c.every(x => Number.isInteger(x) && x >= 0 && x < q.options.length)) return erreurs.push(`${n} : appariement : correct_answer doit donner, pour chaque élément de gauche, l'indice de son option (${q.gauche.length} valeurs)`);
      Object.assign(out, { gauche: q.gauche, options: q.options, correct_answer: [...c] });
    } else if (q.type === 'vrai_faux') {
      if (typeof q.correct_answer !== 'boolean') return erreurs.push(`${n} : correct_answer doit être true ou false`);
      out.correct_answer = q.correct_answer;
    } else if (q.type === 'numerical') {
      const tol = q.tolerance === undefined ? 0 : q.tolerance;
      if (variables) {
        validerExpressions({ variables, correct_answer: q.correct_answer, tolerance: q.tolerance }, n, erreurs);
        Object.assign(out, { correct_answer: typeof q.correct_answer === 'string' && !estNombreTexte(q.correct_answer) ? q.correct_answer : Number(String(q.correct_answer).replace(',', '.')), tolerance: typeof tol === 'string' && !estNombreTexte(tol) ? tol : Number(tol) });
      } else {
        const t = Number(tol);
        if (!Number.isFinite(Number(q.correct_answer)) || q.correct_answer === null || q.correct_answer === '') return erreurs.push(`${n} : correct_answer numérique attendu`);
        if (!(t >= 0)) return erreurs.push(`${n} : tolérance invalide`);
        Object.assign(out, { correct_answer: Number(q.correct_answer), tolerance: t });
      }
      if (typeof q.unit === 'string' && q.unit.length <= 20) out.unit = q.unit;
    }
    if (typeof q.explanation === 'string') out.explanation = q.explanation.slice(0, 2000);
    if (out.variables) verifierEspaces(out, n, erreurs); // sans variables, les accolades du texte restent libres
    questions.push(out);
  });
  if (JSON.stringify(questions).length > TAILLE_MAX) erreurs.push('devoir trop volumineux');
  if (erreurs.length) return { ok: false, erreurs }; // avant toute conversion : toISOString() lève une exception sur une date invalide
  return { ok: true, erreurs, devoir: { titre: d.titre, ouvre: ouvre.toISOString(), ferme: ferme.toISOString(), questions } };
}

/** Questions telles que l'étudiant les voit : sa variante substituée, jamais les réponses ni les explications ni la liste des variables. */
export function sansReponses(questions, graine = '') {
  return questions.map(q => {
    const base = Object.fromEntries(Object.entries(q).filter(([k]) => !SECRETS.includes(k)));
    if (!q.variables) return base;
    const v = valeursVariante(q, graine);
    return {
      ...base, question: substituer(q.question, v),
      ...(q.options ? { options: q.options.map(o => substituer(o, v)) } : {}),
      ...(q.gauche ? { gauche: q.gauche.map(g => substituer(g, v)) } : {})
    };
  });
}

const nombre = v => {
  const n = Number(String(v ?? '').replace(/\s/g, '').replace(',', '.'));
  return String(v ?? '').trim() === '' ? NaN : n;
};
/** Valeur d'un champ numérique (nombre ou expression) pour la variante donnée. */
const valeurAttendue = (brut, valeurs) => (typeof brut === 'number' ? brut : estNombreTexte(brut) ? Number(brut.replace(',', '.')) : evaluer(brut, valeurs));
const entiers = r => (Array.isArray(r) ? r.map(Number).filter(Number.isInteger) : null);

/** Corrige les réponses { q1: ..., q2: ... } pour l'étudiant désigné par `graine`. Les interprétations restent à corriger à la main.
 *  details[i] = { id, ok, points[, valeurs] } ; `ok` n'est vrai que pour une réponse entièrement juste, `points` peut être partiel (multi, appariement). */
export function corriger(questions, reponses = {}, graine = '') {
  let note = 0, total = 0, manuel = false, totalManuel = 0;
  const details = questions.map(q => {
    const r = reponses[q.id];
    if (q.type === 'interpretation') { manuel = true; totalManuel += q.points; return { id: q.id, ok: null, points: 0 }; }
    total += q.points;
    const valeurs = valeursVariante(q, graine);
    let part = 0; // fraction des points obtenue, de 0 à 1
    if (q.type === 'qcm') part = r !== '' && r !== null && r !== undefined && Number(r) === q.correct_answer ? 1 : 0;
    else if (q.type === 'vrai_faux') part = ((r === true || r === 'true') ? q.correct_answer === true : (r === false || r === 'false') ? q.correct_answer === false : false) ? 1 : 0;
    else if (q.type === 'numerical') {
      const v = nombre(r);
      try { part = Number.isFinite(v) && Math.abs(v - valeurAttendue(q.correct_answer, valeurs)) <= valeurAttendue(q.tolerance ?? 0, valeurs) + 1e-9 ? 1 : 0; } catch { part = 0; }
    } else if (q.type === 'multi') {
      const choix = entiers(r);
      if (choix) {
        const eux = new Set(choix), juste = new Set(q.correct_answer);
        const bonnes = [...eux].filter(x => juste.has(x)).length, fausses = [...eux].filter(x => !juste.has(x) && x >= 0 && x < q.options.length).length;
        part = Math.max(0, (bonnes - fausses) / juste.size);
      }
    } else if (q.type === 'appariement') {
      if (Array.isArray(r)) {
        const justes = q.correct_answer.filter((c, i) => r[i] !== '' && r[i] !== null && r[i] !== undefined && Number(r[i]) === c).length;
        part = justes / q.correct_answer.length;
      }
    }
    const points = arrondi4(q.points * part);
    note += points;
    return { id: q.id, ok: part === 1, points, ...(q.variables ? { valeurs } : {}) };
  });
  return { note: arrondi4(note), total, manuel, totalManuel, details };
}

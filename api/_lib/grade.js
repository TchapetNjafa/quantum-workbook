// Validation d'un devoir et correction automatique côté serveur (fonctions pures).
// Types : qcm, vrai_faux, numerical (corrigés), interpretation (correction manuelle).
export const TYPES = ['qcm', 'vrai_faux', 'numerical', 'interpretation'];
const SECRETS = ['correct_answer', 'tolerance', 'explanation', 'sample_answer'];

/** Adresse e-mail reçue dans l'URL : décodée sans exception, en minuscules, ou null si elle est invalide. */
export function decoderEmail(brut) {
  try {
    const e = decodeURIComponent(String(brut)).trim().toLowerCase();
    return e.length > 0 && e.length <= 254 && /^[^\s@]+@[^\s@]+$/.test(e) ? e : null;
  } catch { return null; }
}

const texte = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;

/** Vérifie et normalise un devoir envoyé par l'enseignant. Renvoie { ok, erreurs, devoir }. */
export function valider(d) {
  const erreurs = [];
  const ouvre = new Date(d?.ouvre), ferme = new Date(d?.ferme);
  if (!texte(d?.titre, 200)) erreurs.push('titre manquant ou trop long');
  if (isNaN(ouvre) || isNaN(ferme)) erreurs.push('dates ouvre/ferme invalides');
  else if (ferme <= ouvre) erreurs.push('ferme doit suivre ouvre');
  if (!Array.isArray(d?.questions) || d.questions.length < 1 || d.questions.length > 60) erreurs.push('1 à 60 questions attendues');
  const questions = [];
  (Array.isArray(d?.questions) ? d.questions : []).forEach((q, i) => {
    const n = `question ${i + 1}`;
    if (!TYPES.includes(q?.type)) return erreurs.push(`${n} : type inconnu`);
    if (!texte(q.question, 2000)) return erreurs.push(`${n} : énoncé manquant`);
    const points = q.points === undefined ? 1 : Number(q.points);
    if (!(points > 0 && points <= 20)) return erreurs.push(`${n} : points invalides`);
    const out = { id: `q${i + 1}`, type: q.type, question: q.question, points };
    if (q.type === 'qcm') {
      const ok = Array.isArray(q.options) && q.options.length >= 2 && q.options.length <= 8 && q.options.every(o => texte(o, 500));
      if (!ok) return erreurs.push(`${n} : 2 à 8 options attendues`);
      if (!Number.isInteger(q.correct_answer) || q.correct_answer < 0 || q.correct_answer >= q.options.length) return erreurs.push(`${n} : correct_answer hors des options`);
      Object.assign(out, { options: q.options, correct_answer: q.correct_answer });
    } else if (q.type === 'vrai_faux') {
      if (typeof q.correct_answer !== 'boolean') return erreurs.push(`${n} : correct_answer doit être true ou false`);
      out.correct_answer = q.correct_answer;
    } else if (q.type === 'numerical') {
      const tol = q.tolerance === undefined ? 0 : Number(q.tolerance);
      if (!Number.isFinite(Number(q.correct_answer)) || q.correct_answer === null || q.correct_answer === '') return erreurs.push(`${n} : correct_answer numérique attendu`);
      if (!(tol >= 0)) return erreurs.push(`${n} : tolérance invalide`);
      Object.assign(out, { correct_answer: Number(q.correct_answer), tolerance: tol });
      if (typeof q.unit === 'string' && q.unit.length <= 20) out.unit = q.unit;
    }
    if (typeof q.explanation === 'string') out.explanation = q.explanation.slice(0, 2000);
    questions.push(out);
  });
  if (JSON.stringify(questions).length > 200_000) erreurs.push('devoir trop volumineux');
  if (erreurs.length) return { ok: false, erreurs }; // avant toute conversion : toISOString() lève une exception sur une date invalide
  return { ok: true, erreurs, devoir: { titre: d.titre, ouvre: ouvre.toISOString(), ferme: ferme.toISOString(), questions } };
}

/** Questions telles que l'étudiant les voit : jamais les réponses ni les explications. */
export function sansReponses(questions) {
  return questions.map(q => Object.fromEntries(Object.entries(q).filter(([k]) => !SECRETS.includes(k))));
}

const nombre = v => {
  const n = Number(String(v ?? '').replace(/\s/g, '').replace(',', '.'));
  return String(v ?? '').trim() === '' ? NaN : n;
};

/** Corrige les réponses { q1: ..., q2: ... }. Les interprétations restent à corriger à la main. */
export function corriger(questions, reponses = {}) {
  let note = 0, total = 0, manuel = false, totalManuel = 0;
  const details = questions.map(q => {
    const r = reponses[q.id];
    if (q.type === 'interpretation') { manuel = true; totalManuel += q.points; return { id: q.id, ok: null, points: 0 }; }
    total += q.points;
    let ok = false;
    if (q.type === 'qcm') ok = r !== '' && r !== null && r !== undefined && Number(r) === q.correct_answer;
    else if (q.type === 'vrai_faux') ok = (r === true || r === 'true') ? q.correct_answer === true : (r === false || r === 'false') ? q.correct_answer === false : false;
    else if (q.type === 'numerical') { const v = nombre(r); ok = Number.isFinite(v) && Math.abs(v - q.correct_answer) <= q.tolerance + 1e-9; }
    if (ok) note += q.points;
    return { id: q.id, ok, points: ok ? q.points : 0 };
  });
  return { note, total, manuel, totalManuel, details };
}

// Scores des séries du quiz et classement d'entraînement. Le quiz est corrigé dans le navigateur et sa banque est publique :
// ce classement sert à s'entraîner, il ne note jamais (les devoirs notés sont corrigés par le serveur).
import { q, maintenant } from './db.js';
import { profilDe, toucher } from './profil.js';

const MIN_QUESTIONS = 5, MIN_SERIES = 3, TOP = 20;
const MATRICULE_REQUIS = [400, { error: 'enregistrez d’abord votre matricule (page Profil)', matricule_requis: true }];

export async function enregistrerScore({ session, body }) {
  if (!(await profilDe(session.email))) return session.role === 'prof' ? [200, { ok: true, ignore: 'enseignant' }] : MATRICULE_REQUIS; // l'enseignant n'a pas de profil : son score n'est pas enregistré
  const n = Number(body?.n), ok = Number(body?.ok), duree = Math.round(Number(body?.duree ?? 0));
  const chapitre = body?.chapitre === null || body?.chapitre === undefined ? null : Number(body.chapitre);
  if (!(Number.isInteger(n) && n >= 1 && n <= 60 && Number.isInteger(ok) && ok >= 0 && ok <= n && duree >= 0 && duree <= 4 * 3600)) return [400, { error: 'score invalide' }];
  if (chapitre !== null && !(Number.isInteger(chapitre) && chapitre >= 1 && chapitre <= 6)) return [400, { error: 'chapitre invalide' }];
  const now = maintenant();
  const [{ c }] = await q('SELECT count(*)::int AS c FROM scores WHERE email = $1 AND quand > $2', [session.email, new Date(now.getTime() - 3600e3).toISOString()]);
  if (c >= 30) return [429, { error: 'trop de séries envoyées en une heure' }];
  try {
    await q('INSERT INTO scores (email, chapitre, exam, n, ok, duree, quand) VALUES ($1,$2,$3,$4,$5,$6,$7)', [session.email, chapitre, body?.exam === true, n, ok, duree, now.toISOString()]);
  } catch (e) { if (/23503|foreign key/i.test(`${e.code} ${e.message}`)) return MATRICULE_REQUIS; throw e; } // profil effacé entre la vérification et l'écriture
  await toucher(session.email);
  return [200, { ok: true }];
}

export async function classement({ session, req }) {
  const moi = await profilDe(session.email);
  if (!moi && session.role !== 'prof') return MATRICULE_REQUIS; // l'enseignant consulte le classement sans matricule
  const ch = new URL(req.url, 'http://x').searchParams.get('chapitre');
  const chapitre = ch && /^[1-6]$/.test(ch) ? Number(ch) : null;
  const lignes = await q(
    `SELECT s.email, p.matricule, p.visible, count(*)::int AS series, avg(s.ok::float / s.n) AS moyenne, max(s.ok::float / s.n) AS meilleur
       FROM scores s JOIN profils p ON p.email = s.email
      WHERE s.n >= $1 AND ($2::int IS NULL OR s.chapitre = $2)
      GROUP BY s.email, p.matricule, p.visible HAVING count(*) >= $3
      ORDER BY moyenne DESC, series DESC, p.matricule`, [MIN_QUESTIONS, chapitre, MIN_SERIES]);
  const visibles = lignes.filter(l => l.visible);
  const ligne = (l, rang) => ({ rang, matricule: l.matricule, series: l.series, moyenne: Math.round(Number(l.moyenne) * 100), meilleur: Math.round(Number(l.meilleur) * 100), moi: l.email === session.email });
  const top = visibles.slice(0, TOP).map((l, i) => ligne(l, i + 1));
  const mienne = lignes.find(l => l.email === session.email);
  const monRang = mienne ? (mienne.visible ? visibles.indexOf(mienne) + 1 : null) : undefined;
  return [200, {
    chapitre, minimum: { questions: MIN_QUESTIONS, series: MIN_SERIES }, top,
    moi: mienne ? { ...ligne(mienne, monRang), masque: !mienne.visible } : null,
    total_visibles: visibles.length
  }];
}

/** Historique et progression de l'étudiant connecté. */
export async function historique({ session }) {
  const dernieres = await q('SELECT chapitre, exam, n, ok, duree, quand FROM scores WHERE email = $1 ORDER BY quand DESC LIMIT 30', [session.email]);
  const parChapitre = await q(
    `SELECT chapitre, count(*)::int AS series, sum(ok)::int AS ok, sum(n)::int AS n FROM scores WHERE email = $1 GROUP BY chapitre ORDER BY chapitre NULLS LAST`, [session.email]);
  return [200, { dernieres: dernieres.map(s => ({ ...s, quand: new Date(s.quand).toISOString() })), par_chapitre: parChapitre }];
}

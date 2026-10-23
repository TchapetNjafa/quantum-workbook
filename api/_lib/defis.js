// Défis différés : un étudiant fixe une série de questions de la banque publique et obtient un code ; ses camarades jouent la même série
// quand ils veulent (pas de temps réel) et comparent leurs scores. Un seul essai par étudiant et par défi (le premier compte).
import { randomInt } from 'node:crypto';
import { q, maintenant } from './db.js';
import { profilDe, toucher } from './profil.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans I, O, 0, 1 : pas de confusion à la saisie
const VALIDITE_JOURS = 30;
const MATRICULE_REQUIS = [400, { error: 'enregistrez d’abord votre matricule (page Profil)', matricule_requis: true }];
const RESERVE_ETUDIANTS = [403, { error: 'réservé aux étudiants : l’enseignant consulte les défis (liste dans l’espace enseignant)' }];
const code = () => Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
const iso = d => new Date(d).toISOString();

export async function creer({ session, body }) {
  if (!(await profilDe(session.email))) return session.role === 'prof' ? RESERVE_ETUDIANTS : MATRICULE_REQUIS;
  const ids = body?.ids;
  const chapitre = body?.chapitre === null || body?.chapitre === undefined ? null : Number(body.chapitre);
  if (!Array.isArray(ids) || ids.length < 3 || ids.length > 20 || new Set(ids).size !== ids.length || !ids.every(i => /^ch[1-6]-q\d{3}$/.test(i))) return [400, { error: 'un défi comporte de 3 à 20 questions de la banque' }];
  if (chapitre !== null && !(Number.isInteger(chapitre) && chapitre >= 1 && chapitre <= 6)) return [400, { error: 'chapitre invalide' }];
  const now = maintenant();
  const [{ c }] = await q('SELECT count(*)::int AS c FROM defis WHERE createur = $1 AND cree > $2', [session.email, new Date(now.getTime() - 24 * 3600e3).toISOString()]);
  if (c >= 10) return [429, { error: 'trop de défis créés aujourd’hui' }];
  for (let essai = 0; essai < 8; essai++) {
    const k = code();
    let ecrit;
    try { ecrit = await q('INSERT INTO defis (code, createur, chapitre, ids, cree) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (code) DO NOTHING RETURNING code', [k, session.email, chapitre, JSON.stringify(ids), now.toISOString()]); }
    catch (e) { if (/23503|foreign key/i.test(`${e.code} ${e.message}`)) return MATRICULE_REQUIS; throw e; }
    if (ecrit.length) { await toucher(session.email); return [201, { code: k }]; }
  }
  return [503, { error: 'code indisponible, réessayez' }];
}

async function charger(codeBrut) {
  const k = String(codeBrut).toUpperCase();
  if (!/^[A-Z2-9]{6}$/.test(k)) return null;
  const d = (await q('SELECT code, createur, chapitre, ids, cree FROM defis WHERE code = $1', [k]))[0];
  if (!d) return null;
  return maintenant().getTime() - new Date(d.cree).getTime() > VALIDITE_JOURS * 24 * 3600e3 ? null : d;
}

export async function lire({ session, params }) {
  const prof = session.role === 'prof'; // l'enseignant lit tous les résultats (matricules masqués compris), sans matricule
  if (!prof && !(await profilDe(session.email))) return MATRICULE_REQUIS;
  const d = await charger(params.code);
  if (!d) return [404, { error: 'défi introuvable ou expiré' }];
  const lignes = await q(
    `SELECT s.email, p.matricule, p.visible, s.ok, s.duree, s.quand FROM defis_scores s JOIN profils p ON p.email = s.email
      WHERE s.code = $1 ORDER BY s.ok DESC, s.duree ASC, s.quand ASC`, [d.code]);
  const createur = await profilDe(d.createur);
  return [200, {
    code: d.code, chapitre: d.chapitre, ids: d.ids, n: d.ids.length, cree: iso(d.cree), mien: d.createur === session.email,
    createur: createur && (prof || createur.visible || d.createur === session.email) ? createur.matricule : null,
    resultats: lignes.map((l, i) => ({ rang: i + 1, matricule: prof || l.visible || l.email === session.email ? l.matricule : null, ok: l.ok, duree: l.duree, moi: l.email === session.email })),
    deja_joue: lignes.some(l => l.email === session.email)
  }];
}

export async function envoyerScore({ session, params, body }) {
  if (!(await profilDe(session.email))) return session.role === 'prof' ? RESERVE_ETUDIANTS : MATRICULE_REQUIS;
  const d = await charger(params.code);
  if (!d) return [404, { error: 'défi introuvable ou expiré' }];
  const ok = Number(body?.ok), duree = Math.round(Number(body?.duree ?? 0));
  if (!(Number.isInteger(ok) && ok >= 0 && ok <= d.ids.length && duree >= 0 && duree <= 4 * 3600)) return [400, { error: 'score invalide' }];
  let ecrit;
  try { ecrit = await q('INSERT INTO defis_scores (code, email, ok, duree, quand) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (code, email) DO NOTHING RETURNING code', [d.code, session.email, ok, duree, maintenant().toISOString()]); }
  catch (e) { if (/23503|foreign key/i.test(`${e.code} ${e.message}`)) return MATRICULE_REQUIS; throw e; }
  if (!ecrit.length) return [409, { error: 'vous avez déjà joué ce défi : seul le premier essai compte' }];
  await toucher(session.email);
  return [200, { ok: true }];
}

export async function mesDefis({ session }) {
  const l = await q(
    `SELECT d.code, d.chapitre, d.cree, jsonb_array_length(d.ids) AS n, (d.createur = $1) AS mien, s.ok
       FROM defis d LEFT JOIN defis_scores s ON s.code = d.code AND s.email = $1
      WHERE (d.createur = $1 OR s.email = $1) AND d.cree > $2 ORDER BY d.cree DESC LIMIT 30`, [session.email, new Date(maintenant().getTime() - VALIDITE_JOURS * 24 * 3600e3).toISOString()]);
  return [200, { defis: l.map(x => ({ ...x, cree: iso(x.cree) })) }];
}

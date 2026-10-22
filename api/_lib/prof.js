// Fonctions réservées à l'enseignant : verrou (compte Google + mot de passe), création et gestion des devoirs.
import { createHash, timingSafeEqual } from 'node:crypto';
import { q, maintenant } from './db.js';
import { valider } from './grade.js';
import { creer, depuisRequete } from './session.js';

export const COOKIE_PROF = 'phy321_prof';
export const DUREE_PROF = 3600; // secondes : il faut ressaisir le mot de passe après une heure
const ESSAIS_MAX = 5, FENETRE_MS = 15 * 60 * 1000;

const empreinte = s => createHash('sha256').update(String(s)).digest();
const iso = d => (d ? new Date(d).toISOString() : null);

/** Vrai si la session est celle de l'enseignant ET le mot de passe a été saisi récemment. */
export function profOk(req, session) {
  if (!session || session.role !== 'prof') return false;
  const p = depuisRequete(req, COOKIE_PROF);
  // `typ` distingue ce jeton d'un cookie de session Google (même clé de signature) recopié dans le cookie du verrou.
  return !!p && p.typ === 'verrou-prof' && p.email === session.email;
}

export async function login({ session, body }) {
  if (!session || session.role !== 'prof') return [403, { error: 'réservé à l’enseignant' }];
  const attendu = process.env.TEACHER_PASSWORD;
  if (!attendu) return [503, { error: 'mot de passe enseignant non configuré' }];
  // L'essai est réservé (compté comme échec) AVANT de comparer le mot de passe, en une seule instruction :
  // des requêtes parallèles ne peuvent pas toutes passer sous la limite. Un succès retransforme la ligne en réussite.
  const now = maintenant();
  const depuis = new Date(now.getTime() - FENETRE_MS).toISOString();
  const reserve = await q(
    `INSERT INTO prof_essais (at, ok) SELECT $1, FALSE
      WHERE (SELECT count(*) FROM prof_essais WHERE NOT ok AND at > $2) < $3 RETURNING id`,
    [now.toISOString(), depuis, ESSAIS_MAX]);
  if (!reserve.length) return [429, { error: 'trop d’essais, réessayez dans quelques minutes' }];
  const bon = timingSafeEqual(empreinte(body?.password ?? ''), empreinte(attendu));
  if (!bon) return [401, { error: 'mot de passe incorrect' }];
  await q('UPDATE prof_essais SET ok = TRUE WHERE id = $1', [reserve[0].id]);
  return [200, { ok: true }, { cookieProf: creer({ typ: 'verrou-prof', email: session.email }, undefined, DUREE_PROF) }];
}

export async function listeDevoirs() {
  const l = await q(
    `SELECT d.id, d.titre, d.ouvre, d.ferme, d.publie, d.resultat_visible, d.copie, d.sujet, jsonb_array_length(d.questions) AS nb_questions,
            (SELECT count(*)::int FROM remises r WHERE r.devoir_id = d.id) AS nb_remises
       FROM devoirs d ORDER BY d.ferme DESC`);
  return [200, { devoirs: l.map(d => ({ ...d, ouvre: iso(d.ouvre), ferme: iso(d.ferme) })) }];
}

export async function creerDevoir({ body }) {
  const v = valider(body);
  if (!v.ok) return [400, { error: 'devoir invalide', erreurs: v.erreurs }];
  const [d] = await q(
    'INSERT INTO devoirs (titre, ouvre, ferme, publie, resultat_visible, questions, copie) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
    [v.devoir.titre, v.devoir.ouvre, v.devoir.ferme, body.publie === true, body.resultat_visible === true, JSON.stringify(v.devoir.questions), body.copie === true]);
  return [201, { id: d.id }];
}

export async function lireDevoir({ params }) {
  if (!/^\d+$/.test(params.id)) return [404, { error: 'introuvable' }];
  const [d] = await q('SELECT * FROM devoirs WHERE id = $1', [Number(params.id)]);
  return d ? [200, { ...d, ouvre: iso(d.ouvre), ferme: iso(d.ferme), cree: iso(d.cree) }] : [404, { error: 'introuvable' }];
}

/** Publier, dépublier, rendre les résultats visibles, changer les dates ou le titre. */
export async function modifierDevoir({ params, body }) {
  if (!/^\d+$/.test(params.id)) return [404, { error: 'introuvable' }];
  const [d] = await q('SELECT * FROM devoirs WHERE id = $1', [Number(params.id)]);
  if (!d) return [404, { error: 'introuvable' }];
  const ouvre = body.ouvre !== undefined ? new Date(body.ouvre) : new Date(d.ouvre);
  const ferme = body.ferme !== undefined ? new Date(body.ferme) : new Date(d.ferme);
  if (isNaN(ouvre) || isNaN(ferme) || ferme <= ouvre) return [400, { error: 'dates invalides' }];
  const titre = typeof body.titre === 'string' && body.titre.trim() && body.titre.length <= 200 ? body.titre : d.titre;
  const publie = typeof body.publie === 'boolean' ? body.publie : d.publie;
  const visible = typeof body.resultat_visible === 'boolean' ? body.resultat_visible : d.resultat_visible;
  const copie = typeof body.copie === 'boolean' ? body.copie : d.copie;
  await q('UPDATE devoirs SET titre=$2, ouvre=$3, ferme=$4, publie=$5, resultat_visible=$6, copie=$7 WHERE id=$1',
    [d.id, titre, ouvre.toISOString(), ferme.toISOString(), publie, visible, copie]);
  return [200, { ok: true }];
}

export async function remisesDevoir({ params }) {
  if (!/^\d+$/.test(params.id)) return [404, { error: 'introuvable' }];
  const l = await q(
    // un étudiant apparaît s'il a remis les réponses OU déposé une copie (l'un des deux peut manquer)
    `SELECT u.email, r.nom, r.note, r.total, r.manuel, r.declare, r.recu, r.retard, r.hors_ligne, b.debut,
            f.taille AS copie_taille, f.recu AS copie_recu, f.retard AS copie_retard
       FROM (SELECT email FROM remises WHERE devoir_id = $1 UNION SELECT email FROM fichiers WHERE devoir_id = $1) u
       LEFT JOIN remises r ON r.devoir_id = $1 AND r.email = u.email
       LEFT JOIN debuts b ON b.devoir_id = $1 AND b.email = u.email
       LEFT JOIN fichiers f ON f.devoir_id = $1 AND f.email = u.email
      ORDER BY u.email`, [Number(params.id)]);
  const num = v => (v === null || v === undefined ? null : Number(v));
  return [200, { remises: l.map(r => ({ ...r, nom: r.nom || '', note: num(r.note), total: num(r.total), declare: iso(r.declare), recu: iso(r.recu), debut: iso(r.debut), copie_recu: iso(r.copie_recu) })) }];
}

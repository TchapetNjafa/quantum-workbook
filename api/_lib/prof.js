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
  return !!p && p.email === session.email;
}

export async function login({ session, body }) {
  if (!session || session.role !== 'prof') return [403, { error: 'réservé à l’enseignant' }];
  const attendu = process.env.TEACHER_PASSWORD;
  if (!attendu) return [503, { error: 'mot de passe enseignant non configuré' }];
  const depuis = new Date(maintenant().getTime() - FENETRE_MS).toISOString();
  const [{ n }] = await q('SELECT count(*)::int AS n FROM prof_essais WHERE NOT ok AND at > $1', [depuis]);
  if (n >= ESSAIS_MAX) return [429, { error: 'trop d’essais, réessayez dans quelques minutes' }];
  const bon = timingSafeEqual(empreinte(body?.password ?? ''), empreinte(attendu));
  await q('INSERT INTO prof_essais (at, ok) VALUES ($1, $2)', [maintenant().toISOString(), bon]);
  if (!bon) return [401, { error: 'mot de passe incorrect' }];
  return [200, { ok: true }, { cookieProf: creer({ email: session.email }, undefined, DUREE_PROF) }];
}

export async function listeDevoirs() {
  const l = await q(
    `SELECT d.id, d.titre, d.ouvre, d.ferme, d.publie, d.resultat_visible, jsonb_array_length(d.questions) AS nb_questions,
            (SELECT count(*)::int FROM remises r WHERE r.devoir_id = d.id) AS nb_remises
       FROM devoirs d ORDER BY d.ferme DESC`);
  return [200, { devoirs: l.map(d => ({ ...d, ouvre: iso(d.ouvre), ferme: iso(d.ferme) })) }];
}

export async function creerDevoir({ body }) {
  const v = valider(body);
  if (!v.ok) return [400, { error: 'devoir invalide', erreurs: v.erreurs }];
  const [d] = await q(
    'INSERT INTO devoirs (titre, ouvre, ferme, publie, resultat_visible, questions) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
    [v.devoir.titre, v.devoir.ouvre, v.devoir.ferme, body.publie === true, body.resultat_visible === true, JSON.stringify(v.devoir.questions)]);
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
  await q('UPDATE devoirs SET titre=$2, ouvre=$3, ferme=$4, publie=$5, resultat_visible=$6 WHERE id=$1',
    [d.id, titre, ouvre.toISOString(), ferme.toISOString(), publie, visible]);
  return [200, { ok: true }];
}

export async function remisesDevoir({ params }) {
  if (!/^\d+$/.test(params.id)) return [404, { error: 'introuvable' }];
  const l = await q(
    `SELECT r.email, r.nom, r.note, r.total, r.manuel, r.declare, r.recu, r.retard, b.debut
       FROM remises r LEFT JOIN debuts b ON b.devoir_id = r.devoir_id AND b.email = r.email
      WHERE r.devoir_id = $1 ORDER BY r.email`, [Number(params.id)]);
  return [200, { remises: l.map(r => ({ ...r, note: Number(r.note), total: Number(r.total), declare: iso(r.declare), recu: iso(r.recu), debut: iso(r.debut) })) }];
}

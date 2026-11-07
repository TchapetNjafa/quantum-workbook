// Devoirs côté étudiant : liste, ouverture, remise. L'heure qui compte est celle du serveur.
//
// Devoir « surveillé » (`devoirs.surveille`, vrai par défaut pour un nouveau devoir) :
//  - il ne s'ouvre qu'entre `ouvre` et `ferme` ;
//  - il ne s'ouvre qu'UNE fois par étudiant, depuis n'importe quel appareil : la ligne `debuts` est créée atomiquement à l'ouverture ;
//  - quitter la page (fermeture, rechargement, retour) = remise automatique des dernières réponses ; la page ne peut plus être rouverte ;
//  - à la fermeture, les réponses envoyées automatiquement pendant le devoir deviennent la remise de ceux qui n'ont rien remis ;
//  - seule la remise finale peut se faire hors connexion (file locale), jusqu'à `ferme` + 24 h.
import { q, maintenant } from './db.js';
import { corriger, sansReponses } from './grade.js';
import { profilDe, toucher } from './profil.js';

export const DELAI_GRACE_MS = 24 * 3600 * 1000; // une remise reçue jusqu'à 24 h après la fermeture est acceptée, marquée en retard
export const TOLERANCE_MS = 60 * 1000;          // devoir surveillé : la remise de fin de temps arrive quelques secondes après la fermeture sans être « en retard »

const iso = d => (d ? new Date(d).toISOString() : null);
const limite = d => new Date(new Date(d.ferme).getTime() + DELAI_GRACE_MS);
const fin = d => new Date(new Date(d.ferme).getTime() + TOLERANCE_MS);

function etat(d, now) {
  const ouvre = new Date(d.ouvre), ferme = new Date(d.ferme);
  return now < ouvre ? 'a_venir' : now <= ferme ? 'ouvert' : now <= limite(d) ? 'retard' : 'clos';
}

/** Annonce PUBLIQUE (visiteur non connecté compris) : y a-t-il un devoir ouvert, ou un prochain devoir ? Titre et dates seulement, jamais de question ni de réponse. */
export async function annonce() {
  const now = maintenant();
  const l = (await q('SELECT titre, ouvre, ferme FROM devoirs WHERE publie ORDER BY ouvre')).map(d => ({ ...d, e: etat(d, now) }));
  const ouverts = l.filter(d => d.e === 'ouvert'), prochain = l.find(d => d.e === 'a_venir');
  return {
    ouverts: ouverts.length,
    ouvert: ouverts[0] ? { titre: ouverts[0].titre, ferme: iso(ouverts[0].ferme) } : null,
    prochain: prochain ? { titre: prochain.titre, ouvre: iso(prochain.ouvre) } : null
  };
}

export { etat as etatDevoir, limite as limiteDevoir }; // utilisés aussi par fichiers.js (mêmes règles de temps)

/** Enregistre une remise AUTOMATIQUE (sortie de la page, fin du temps) à partir des réponses données. Ne remplace jamais une remise existante. */
async function remiseAuto(d, email, nom, reponses, recu, raison) {
  const c = corriger(d.questions, reponses);
  await q(
    `INSERT INTO remises (devoir_id, email, nom, reponses, note, total, manuel, details, recu, retard, hors_ligne, total_manuel, auto)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,FALSE,FALSE,$10,$11) ON CONFLICT (devoir_id, email) DO NOTHING`,
    [d.id, email, nom || '', JSON.stringify(reponses), c.note, c.total, c.manuel, JSON.stringify(c.details), new Date(recu).toISOString(), c.totalManuel, raison]);
}

/** Devoir surveillé : transforme en remise les sessions terminées qui n'en ont pas (page quittée sans que la requête arrive, ou temps écoulé).
 *  Appelée avant toute lecture de remises ; `email` restreint à un étudiant. Sans effet sur un devoir non surveillé. */
export async function finaliser(d, email = null) {
  if (!d.surveille || !d.questions.length) return;
  const apresFin = maintenant() > fin(d);
  const l = await q(
    `SELECT b.email, b.brouillon, b.quitte, p.nom FROM debuts b LEFT JOIN profils p ON p.email = b.email
      WHERE b.devoir_id = $1 AND ($2::text IS NULL OR b.email = $2) AND (b.quitte IS NOT NULL OR $3::boolean)
        AND NOT EXISTS (SELECT 1 FROM remises r WHERE r.devoir_id = b.devoir_id AND r.email = b.email)`, [d.id, email, apresFin]);
  for (const x of l) await remiseAuto(d, x.email, x.nom, x.brouillon || {}, x.quitte || d.ferme, x.quitte ? 'sortie' : 'temps');
}

/** Finalise tous les devoirs surveillés publiés d'un étudiant qui n'ont pas de remise (appelée par la liste). */
async function finaliserPour(email) {
  const l = await q(
    `SELECT d.* FROM devoirs d JOIN debuts b ON b.devoir_id = d.id AND b.email = $1
      WHERE d.surveille AND d.publie AND NOT EXISTS (SELECT 1 FROM remises r WHERE r.devoir_id = d.id AND r.email = $1)`, [email]);
  for (const d of l) await finaliser(d, email);
}

export async function liste({ session }) {
  const now = maintenant();
  if (session.role !== 'prof') await finaliserPour(session.email);
  const lignes = await q(
    `SELECT d.id, d.titre, d.ouvre, d.ferme, d.resultat_visible, d.copie, d.sujet, d.surveille, b.debut, r.recu, r.retard, r.note, r.total, r.manuel, r.note_manuelle, r.total_manuel, r.notes_questions, d.questions
       FROM devoirs d LEFT JOIN remises r ON r.devoir_id = d.id AND r.email = $1
       LEFT JOIN debuts b ON b.devoir_id = d.id AND b.email = $1
      WHERE d.publie ORDER BY d.ferme DESC`, [session.email]);
  const devoirs = lignes.map(d => ({
    id: d.id, titre: d.titre, ouvre: iso(d.ouvre), ferme: iso(d.ferme), limite: iso(limite(d)),
    lecture_seule: session.role === 'prof',
    surveille: !!d.surveille, ouvert_le: d.surveille ? iso(d.debut) : null, // un devoir surveillé déjà ouvert ne se rouvre pas
    copie: !!d.copie, sujet: !!d.sujet, etat: etat(d, now), rendu: !!d.recu, recu: iso(d.recu), retard: !!d.retard,
    // La note n'est montrée qu'après la fin du délai de remise : sinon, des remises répétées permettraient de deviner les réponses.
    ...(d.resultat_visible && d.recu && now > limite(d) ? {
      note: Number(d.note), total: Number(d.total), manuel: d.manuel,
      ...(d.manuel ? { note_manuelle: d.note_manuelle === null ? null : Number(d.note_manuelle), total_manuel: Number(d.total_manuel) } : {}),
      // détail par question (seulement quand la correction est terminée)
      ...(d.manuel && d.note_manuelle !== null && d.notes_questions ? { notes_questions: d.questions.filter(x => x.type === 'interpretation' && d.notes_questions[x.id] !== undefined)
        .map(x => ({ n: Number(x.id.slice(1)), note: Number(d.notes_questions[x.id]), points: x.points })) } : {})
    } : {})
  }));
  return [200, { maintenant: now.toISOString(), devoirs, a_faire: devoirs.filter(d => d.etat === 'ouvert' && !d.rendu && !d.ouvert_le).length }];
}

async function charger(id) {
  if (!/^\d+$/.test(id)) return null;
  return (await q('SELECT * FROM devoirs WHERE id = $1 AND publie', [Number(id)]))[0] || null;
}

export async function ouvrir({ session, params }) {
  const d = await charger(params.id);
  if (!d) return [404, { error: 'devoir introuvable' }];
  const now = maintenant(), e = etat(d, now);
  if (e === 'a_venir' || e === 'clos') return [403, { error: e === 'a_venir' ? 'devoir pas encore ouvert' : 'devoir clos' }];
  // l'enseignant peut lire le devoir comme un étudiant, sans l'ouvrir (pas d'horodatage) ni le remettre
  if (session.role === 'prof') return [200, { id: d.id, titre: d.titre, ferme: iso(d.ferme), limite: iso(limite(d)), etat: e, maintenant: now.toISOString(), copie: !!d.copie, sujet: !!d.sujet,
    surveille: !!d.surveille, questions: sansReponses(d.questions), rendu: false, reponses: {}, recu: null, lecture_seule: true }];
  if (d.surveille) {
    if (e !== 'ouvert') return [403, { error: 'ce devoir ne s’ouvre que pendant sa fenêtre (entre l’ouverture et la fermeture) : il est fermé', ferme: iso(d.ferme) }];
    // Une seule ouverture par étudiant : l'insertion est atomique, la seconde tentative (autre appareil, rechargement) ne renvoie aucune ligne.
    const neuf = await q('INSERT INTO debuts (devoir_id, email, debut, battement) VALUES ($1, $2, $3, $3) ON CONFLICT DO NOTHING RETURNING devoir_id', [d.id, session.email, now.toISOString()]);
    if (!neuf.length) {
      await finaliser(d, session.email);
      return [403, { error: 'ce devoir a déjà été ouvert avec votre compte : il est considéré comme remis et ne peut plus être rouvert', deja_ouvert: true }];
    }
    return [200, { id: d.id, titre: d.titre, ferme: iso(d.ferme), limite: iso(limite(d)), etat: e, maintenant: now.toISOString(), copie: !!d.copie, sujet: !!d.sujet,
      surveille: true, questions: sansReponses(d.questions), rendu: false, reponses: {}, recu: null }];
  }
  // l'ouverture est horodatée par le serveur (première fois seulement)
  await q('INSERT INTO debuts (devoir_id, email, debut) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [d.id, session.email, now.toISOString()]);
  const [r] = await q('SELECT reponses, recu, retard FROM remises WHERE devoir_id = $1 AND email = $2', [d.id, session.email]);
  return [200, {
    id: d.id, titre: d.titre, ferme: iso(d.ferme), limite: iso(limite(d)), etat: e, maintenant: now.toISOString(), copie: !!d.copie, sujet: !!d.sujet,
    surveille: false, questions: sansReponses(d.questions), rendu: !!r, reponses: r ? r.reponses : {}, recu: r ? iso(r.recu) : null
  }];
}

/** Durées d'absence (page cachée) déclarées par l'appareil, en millisecondes : entiers de 0 à 24 h, sinon 0. Indicatives, comme l'heure déclarée d'une remise. */
const ms = v => (Number.isInteger(v) && v >= 0 && v <= 86_400_000 ? v : 0);
const absences = body => ({ total: ms(body?.absence_ms), max: ms(body?.absence_max_ms) });

/** Devoir surveillé : la page envoie ses réponses à intervalle régulier (et signale les changements d'onglet). Sert de brouillon et de signe de vie. */
export async function brouillon({ session, params, body }) {
  if (session.role === 'prof') return [200, { ok: true }];
  const d = await charger(params.id);
  if (!d || !d.surveille) return [404, { error: 'devoir introuvable' }];
  const reponses = body && typeof body.reponses === 'object' && body.reponses !== null && !Array.isArray(body.reponses) ? body.reponses : null;
  const sorties = Number.isInteger(body?.sorties) && body.sorties >= 0 && body.sorties <= 1000 ? body.sorties : 0;
  const { total, max } = absences(body);
  const ecrit = await q(
    `UPDATE debuts SET brouillon = COALESCE($3::jsonb, brouillon), battement = $4, sorties = GREATEST(sorties, $5),
            absence_ms = GREATEST(absence_ms, $6), absence_max_ms = GREATEST(absence_max_ms, $7)
      WHERE devoir_id = $1 AND email = $2 AND quitte IS NULL RETURNING devoir_id`,
    [d.id, session.email, reponses && JSON.stringify(reponses), maintenant().toISOString(), sorties, total, max]);
  return ecrit.length ? [200, { ok: true }] : [409, { error: 'la session de ce devoir est terminée', termine: true }];
}

/** Devoir surveillé : la page se ferme (fermeture, rechargement, navigation) ou, sur ordinateur, l'étudiant change d'onglet. Les dernières réponses deviennent la remise, la session est terminée. */
export async function quitter({ session, params, body }) {
  if (session.role === 'prof') return [200, { ok: true }];
  const d = await charger(params.id);
  if (!d || !d.surveille) return [404, { error: 'devoir introuvable' }];
  const now = maintenant();
  const sorties = Number.isInteger(body?.sorties) && body.sorties >= 0 && body.sorties <= 1000 ? body.sorties : 0;
  const { total, max } = absences(body);
  const ferme = await q(`UPDATE debuts SET quitte = $3, sorties = GREATEST(sorties, $4), absence_ms = GREATEST(absence_ms, $5), absence_max_ms = GREATEST(absence_max_ms, $6)
                          WHERE devoir_id = $1 AND email = $2 AND quitte IS NULL RETURNING brouillon`, [d.id, session.email, now.toISOString(), sorties, total, max]);
  if (!ferme.length) return [200, { ok: true, deja: true }]; // déjà remis ou déjà quitté (ou jamais ouvert)
  const envoyees = body && typeof body.reponses === 'object' && body.reponses !== null && !Array.isArray(body.reponses) ? body.reponses : null;
  const p = await profilDe(session.email);
  await remiseAuto(d, session.email, p ? p.nom : session.name, envoyees || ferme[0].brouillon || {}, now, body?.raison === 'onglet' ? 'onglet' : 'sortie'); // 'onglet' : changement d'onglet ou de fenêtre sur ordinateur
  return [200, { ok: true }];
}

export async function remettre({ session, params, body }) {
  if (session.role === 'prof') return [403, { error: 'lecture seule : l’enseignant ne remet pas de devoir' }];
  const d = await charger(params.id);
  if (!d) return [404, { error: 'devoir introuvable' }];
  const now = maintenant(), e = etat(d, now);
  if (e === 'a_venir') return [403, { error: 'devoir pas encore ouvert' }];
  if (e === 'clos') return [403, { error: 'remise refusée : délai dépassé', limite: iso(limite(d)) }];
  if (!(await profilDe(session.email))) return [400, { error: 'enregistrez d’abord votre matricule (page Profil)', matricule_requis: true }];
  if (!d.questions.length) return [400, { error: 'ce devoir n’a pas de questions : il se rend en déposant une copie' }];
  if (d.surveille) { // pas de remise sans ouverture ; une seule remise
    const [b] = await q('SELECT 1 AS ok FROM debuts WHERE devoir_id = $1 AND email = $2', [d.id, session.email]);
    if (!b) return [403, { error: 'ce devoir surveillé doit d’abord être ouvert pendant sa fenêtre' }];
    const [deja] = await q('SELECT auto FROM remises WHERE devoir_id = $1 AND email = $2', [d.id, session.email]);
    if (deja && deja.auto === null) return [409, { error: 'ce devoir a déjà été remis : une seule remise est possible' }];
    // Une remise AUTOMATIQUE (page quittée, temps écoulé) ne cède la place qu'à une remise préparée hors connexion AVANT la fermeture et arrivée ensuite
    // (file locale de l'appareil) ; sinon, quitter la page puis renvoyer d'autres réponses contournerait la règle.
    if (deja) {
      const avant = body?.declared_at ? new Date(body.declared_at) : null;
      if (!(body?.offline === true && avant && !isNaN(avant) && avant <= fin(d))) return [409, { error: 'la page du devoir a été quittée ou le temps est écoulé : la remise automatique est définitive' }];
    }
  }
  // Garde-fou : un devoir qui demande une copie ne peut pas être remis sans elle (le bouton est aussi désactivé côté interface).
  if (d.copie) {
    const [f] = await q('SELECT 1 AS ok FROM fichiers WHERE devoir_id = $1 AND email = $2', [d.id, session.email]);
    if (!f) return [400, { error: 'déposez d’abord votre copie (PDF ou photo), puis remettez vos réponses', copie_requise: true }];
  }
  const reponses = body && typeof body.reponses === 'object' && body.reponses !== null && !Array.isArray(body.reponses) ? body.reponses : null;
  if (!reponses) return [400, { error: 'réponses manquantes' }];

  // L'heure déclarée par l'appareil est conservée à titre indicatif (non vérifiable) et ne peut pas être dans le futur.
  let declare = body.declared_at ? new Date(body.declared_at) : null;
  if (declare && isNaN(declare)) declare = null;
  if (declare && declare > now) declare = now;

  const c = corriger(d.questions, reponses);
  const retard = d.surveille ? now > fin(d) : e === 'retard';
  // Une requête plus ancienne, arrivée en retard, ne doit pas écraser une remise plus récente (WHERE sur recu).
  // `offline` : la remise a été préparée sans réseau puis envoyée plus tard. Seule l'heure de réception (serveur) décide du retard ;
  // l'heure déclarée par l'appareil reste indicative et est présentée comme telle à l'enseignant.
  const horsLigne = body.offline === true;
  const ecrit = await q(
    `INSERT INTO remises (devoir_id, email, nom, reponses, note, total, manuel, details, declare, recu, retard, hors_ligne, total_manuel)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     ON CONFLICT (devoir_id, email) DO UPDATE SET nom=$3, reponses=$4, note=$5, total=$6, manuel=$7, details=$8, declare=$9, recu=$10, retard=$11, hors_ligne=$12,
       total_manuel=$13, note_manuelle=NULL, notes_questions=NULL, auto=NULL  -- de nouvelles réponses annulent une correction manuelle déjà saisie
       WHERE remises.recu <= $10 RETURNING devoir_id`,
    [d.id, session.email, session.name || '', JSON.stringify(reponses), c.note, c.total, c.manuel, JSON.stringify(c.details),
      declare && declare.toISOString(), now.toISOString(), retard, horsLigne, c.totalManuel]);
  if (!ecrit.length) return [409, { error: 'une remise plus récente existe déjà' }];
  if (d.surveille) await q('UPDATE debuts SET quitte = COALESCE(quitte, $3) WHERE devoir_id = $1 AND email = $2', [d.id, session.email, now.toISOString()]); // la session est terminée
  await toucher(session.email).catch(() => {});
  // Pas de note ici : elle n'est révélée qu'après la fin du délai (voir liste()).
  return [200, { recu: now.toISOString(), retard, limite: iso(limite(d)) }];
}

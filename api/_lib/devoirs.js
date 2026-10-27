// Devoirs côté étudiant : liste, ouverture, remise. L'heure qui compte est celle du serveur.
import { q, maintenant } from './db.js';
import { corriger, sansReponses } from './grade.js';
import { profilDe, toucher } from './profil.js';

export const DELAI_GRACE_MS = 24 * 3600 * 1000; // une remise reçue jusqu'à 24 h après la fermeture est acceptée, marquée en retard

const iso = d => (d ? new Date(d).toISOString() : null);
const limite = d => new Date(new Date(d.ferme).getTime() + DELAI_GRACE_MS);

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

export async function liste({ session }) {
  const now = maintenant();
  const lignes = await q(
    `SELECT d.id, d.titre, d.ouvre, d.ferme, d.resultat_visible, d.copie, d.sujet, r.recu, r.retard, r.note, r.total, r.manuel, r.note_manuelle, r.total_manuel, r.notes_questions, d.questions
       FROM devoirs d LEFT JOIN remises r ON r.devoir_id = d.id AND r.email = $1
      WHERE d.publie ORDER BY d.ferme DESC`, [session.email]);
  const devoirs = lignes.map(d => ({
    id: d.id, titre: d.titre, ouvre: iso(d.ouvre), ferme: iso(d.ferme), limite: iso(limite(d)),
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
  return [200, { maintenant: now.toISOString(), devoirs, a_faire: devoirs.filter(d => d.etat === 'ouvert' && !d.rendu).length }];
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
  // l'ouverture est horodatée par le serveur (première fois seulement)
  await q('INSERT INTO debuts (devoir_id, email, debut) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [d.id, session.email, now.toISOString()]);
  const [r] = await q('SELECT reponses, recu, retard FROM remises WHERE devoir_id = $1 AND email = $2', [d.id, session.email]);
  return [200, {
    id: d.id, titre: d.titre, ferme: iso(d.ferme), limite: iso(limite(d)), etat: e, maintenant: now.toISOString(), copie: !!d.copie, sujet: !!d.sujet,
    questions: sansReponses(d.questions), rendu: !!r, reponses: r ? r.reponses : {}, recu: r ? iso(r.recu) : null
  }];
}

export async function remettre({ session, params, body }) {
  const d = await charger(params.id);
  if (!d) return [404, { error: 'devoir introuvable' }];
  const now = maintenant(), e = etat(d, now);
  if (e === 'a_venir') return [403, { error: 'devoir pas encore ouvert' }];
  if (e === 'clos') return [403, { error: 'remise refusée : délai dépassé', limite: iso(limite(d)) }];
  if (!(await profilDe(session.email))) return [400, { error: 'enregistrez d’abord votre matricule (page Profil)', matricule_requis: true }];
  if (!d.questions.length) return [400, { error: 'ce devoir n’a pas de questions : il se rend en déposant une copie' }];
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
  const retard = e === 'retard';
  // Une requête plus ancienne, arrivée en retard, ne doit pas écraser une remise plus récente (WHERE sur recu).
  // `offline` : la remise a été préparée sans réseau puis envoyée plus tard. Seule l'heure de réception (serveur) décide du retard ;
  // l'heure déclarée par l'appareil reste indicative et est présentée comme telle à l'enseignant.
  const horsLigne = body.offline === true;
  const ecrit = await q(
    `INSERT INTO remises (devoir_id, email, nom, reponses, note, total, manuel, details, declare, recu, retard, hors_ligne, total_manuel)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     ON CONFLICT (devoir_id, email) DO UPDATE SET nom=$3, reponses=$4, note=$5, total=$6, manuel=$7, details=$8, declare=$9, recu=$10, retard=$11, hors_ligne=$12,
       total_manuel=$13, note_manuelle=NULL, notes_questions=NULL  -- de nouvelles réponses annulent une correction manuelle déjà saisie
       WHERE remises.recu <= $10 RETURNING devoir_id`,
    [d.id, session.email, session.name || '', JSON.stringify(reponses), c.note, c.total, c.manuel, JSON.stringify(c.details),
      declare && declare.toISOString(), now.toISOString(), retard, horsLigne, c.totalManuel]);
  if (!ecrit.length) return [409, { error: 'une remise plus récente existe déjà' }];
  await toucher(session.email).catch(() => {});
  // Pas de note ici : elle n'est révélée qu'après la fin du délai (voir liste()).
  return [200, { recu: now.toISOString(), retard, limite: iso(limite(d)) }];
}

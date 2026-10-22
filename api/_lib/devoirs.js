// Devoirs côté étudiant : liste, ouverture, remise. L'heure qui compte est celle du serveur.
import { q, maintenant } from './db.js';
import { corriger, sansReponses } from './grade.js';

export const DELAI_GRACE_MS = 24 * 3600 * 1000; // une remise reçue jusqu'à 24 h après la fermeture est acceptée, marquée en retard

const iso = d => (d ? new Date(d).toISOString() : null);
const limite = d => new Date(new Date(d.ferme).getTime() + DELAI_GRACE_MS);

function etat(d, now) {
  const ouvre = new Date(d.ouvre), ferme = new Date(d.ferme);
  return now < ouvre ? 'a_venir' : now <= ferme ? 'ouvert' : now <= limite(d) ? 'retard' : 'clos';
}

export async function liste({ session }) {
  const now = maintenant();
  const lignes = await q(
    `SELECT d.id, d.titre, d.ouvre, d.ferme, d.resultat_visible, r.recu, r.retard, r.note, r.total, r.manuel
       FROM devoirs d LEFT JOIN remises r ON r.devoir_id = d.id AND r.email = $1
      WHERE d.publie ORDER BY d.ferme DESC`, [session.email]);
  const devoirs = lignes.map(d => ({
    id: d.id, titre: d.titre, ouvre: iso(d.ouvre), ferme: iso(d.ferme), limite: iso(limite(d)),
    etat: etat(d, now), rendu: !!d.recu, recu: iso(d.recu), retard: !!d.retard,
    ...(d.resultat_visible && d.recu ? { note: Number(d.note), total: Number(d.total), manuel: d.manuel } : {})
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
    id: d.id, titre: d.titre, ferme: iso(d.ferme), limite: iso(limite(d)), etat: e, maintenant: now.toISOString(),
    questions: sansReponses(d.questions), rendu: !!r, reponses: r ? r.reponses : {}, recu: r ? iso(r.recu) : null
  }];
}

export async function remettre({ session, params, body }) {
  const d = await charger(params.id);
  if (!d) return [404, { error: 'devoir introuvable' }];
  const now = maintenant(), e = etat(d, now);
  if (e === 'a_venir') return [403, { error: 'devoir pas encore ouvert' }];
  if (e === 'clos') return [403, { error: 'remise refusée : délai dépassé', limite: iso(limite(d)) }];
  const reponses = body && typeof body.reponses === 'object' && body.reponses !== null && !Array.isArray(body.reponses) ? body.reponses : null;
  if (!reponses) return [400, { error: 'réponses manquantes' }];

  // L'heure déclarée par l'appareil est conservée à titre indicatif (non vérifiable) et ne peut pas être dans le futur.
  let declare = body.declared_at ? new Date(body.declared_at) : null;
  if (declare && isNaN(declare)) declare = null;
  if (declare && declare > now) declare = now;

  const c = corriger(d.questions, reponses);
  const retard = e === 'retard';
  await q(
    `INSERT INTO remises (devoir_id, email, nom, reponses, note, total, manuel, details, declare, recu, retard)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (devoir_id, email) DO UPDATE SET nom=$3, reponses=$4, note=$5, total=$6, manuel=$7, details=$8, declare=$9, recu=$10, retard=$11`,
    [d.id, session.email, session.name || '', JSON.stringify(reponses), c.note, c.total, c.manuel, JSON.stringify(c.details),
      declare && declare.toISOString(), now.toISOString(), retard]);
  return [200, { recu: now.toISOString(), retard, limite: iso(limite(d)), ...(d.resultat_visible ? { note: c.note, total: c.total, manuel: c.manuel } : {}) }];
}

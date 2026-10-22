// Copies déposées par les étudiants (PDF, JPEG, PNG, 2 Mo max) et sujets PDF publiés par l'enseignant.
// Mêmes règles de temps que les remises : heure du serveur, délai de grâce de 24 h, remise plus récente prioritaire.
import { createHash, randomBytes } from 'node:crypto';
import { q, maintenant } from './db.js';
import { deposer, lire, supprimer, typeReel, TAILLE_MAX } from './stockage.js';
import { etatDevoir, limiteDevoir } from './devoirs.js';
import { decoderEmail } from './grade.js';

const iso = d => (d ? new Date(d).toISOString() : null);
// Le chemin ne contient pas l'adresse e-mail de l'étudiant.
const empreinte = email => createHash('sha256').update(email).digest('hex').slice(0, 20);
const nomSur = s => String(s).toLowerCase().replace(/[^a-z0-9._-]/g, '_');

async function devoirPublie(id) {
  if (!/^\d+$/.test(id)) return null;
  return (await q('SELECT id, ouvre, ferme, copie, sujet, bareme, jsonb_array_length(questions) AS nq FROM devoirs WHERE id = $1 AND publie', [Number(id)]))[0] || null;
}

export async function deposerCopie({ session, params, body }) {
  const d = await devoirPublie(params.id);
  if (!d) return [404, { error: 'devoir introuvable' }];
  if (!d.copie) return [403, { error: 'ce devoir n’accepte pas de copie déposée' }];
  const now = maintenant(), e = etatDevoir(d, now);
  if (e === 'a_venir') return [403, { error: 'devoir pas encore ouvert' }];
  if (e === 'clos') return [403, { error: 'dépôt refusé : délai dépassé', limite: iso(limiteDevoir(d)) }];
  if (!Buffer.isBuffer(body) || !body.length) return [400, { error: 'fichier manquant' }];
  if (body.length > TAILLE_MAX) return [413, { error: 'fichier trop volumineux (2 Mo maximum)' }];
  const type = typeReel(body);
  if (!type) return [415, { error: 'format non accepté : PDF, JPEG ou PNG' }];

  // Chemin unique par dépôt : deux dépôts simultanés ne s'écrasent jamais dans le stockage, et la base désigne le gagnant.
  const chemin = `copies/${d.id}/${empreinte(session.email)}-${randomBytes(6).toString('hex')}.${type.ext}`;
  await deposer(chemin, body, type.mime);
  let ligne;
  try {
    // Un dépôt plus ancien que celui déjà enregistré ne gagne jamais (WHERE sur recu). `ancien` = chemin remplacé, lu dans la même instruction.
    ligne = await q(
      `WITH ancien AS (SELECT chemin FROM fichiers WHERE devoir_id = $1 AND email = $2)
       INSERT INTO fichiers (devoir_id, email, chemin, type, taille, recu, retard) VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (devoir_id, email) DO UPDATE SET chemin=$3, type=$4, taille=$5, recu=$6, retard=$7 WHERE fichiers.recu <= $6
       RETURNING (SELECT chemin FROM ancien) AS ancien`,
      [d.id, session.email, chemin, type.mime, body.length, now.toISOString(), e === 'retard']);
  } catch (err) {
    await supprimer(chemin).catch(() => {}); // échec de la base : on ne laisse pas de fichier non référencé
    throw err;
  }
  if (!ligne.length) { // un dépôt plus récent existe déjà : le fichier qu'on vient d'écrire n'est référencé nulle part
    await supprimer(chemin).catch(err => console.error('suppression fichier obsolète', err.message));
    return [409, { error: 'un dépôt plus récent existe déjà' }];
  }
  if (ligne[0].ancien) await supprimer(ligne[0].ancien).catch(err => console.error('suppression ancien fichier', err.message));
  // Devoir sans question : le dépôt de la copie EST la remise. On crée la ligne de remise (à noter à la main sur le barème du devoir),
  // ce qui fait aussi disparaître le devoir de la liste « à rendre » de l'étudiant. Un nouveau dépôt annule la note déjà saisie.
  if (Number(d.nq) === 0) {
    await q(
      `INSERT INTO remises (devoir_id, email, nom, reponses, note, total, manuel, details, declare, recu, retard, hors_ligne, total_manuel)
            VALUES ($1,$2,$3,'{}',0,0,TRUE,'[]',NULL,$4,$5,FALSE,$6)
       ON CONFLICT (devoir_id, email) DO UPDATE SET nom=$3, recu=$4, retard=$5, total_manuel=$6, note_manuelle=NULL WHERE remises.recu <= $4`,
      [d.id, session.email, session.name || '', now.toISOString(), e === 'retard', Number(d.bareme ?? 20)]);
  }
  return [200, { recu: now.toISOString(), retard: e === 'retard', taille: body.length, type: type.mime, limite: iso(limiteDevoir(d)) }];
}

export async function maCopie({ session, params }) {
  const d = await devoirPublie(params.id);
  if (!d) return [404, { error: 'devoir introuvable' }];
  const [f] = await q('SELECT type, taille, recu, retard FROM fichiers WHERE devoir_id = $1 AND email = $2', [d.id, session.email]);
  return [200, { fichier: f ? { type: f.type, taille: f.taille, recu: iso(f.recu), retard: f.retard } : null }];
}

/** Sujet PDF à remplir, téléchargeable par les étudiants dès l'ouverture du devoir. */
export async function sujetLire({ params }) {
  const d = await devoirPublie(params.id);
  if (!d || !d.sujet) return [404, { error: 'pas de sujet pour ce devoir' }];
  if (etatDevoir(d, maintenant()) === 'a_venir') return [403, { error: 'devoir pas encore ouvert' }];
  const r = await lire(`sujets/${d.id}.pdf`);
  if (!r || !r.stream) return [404, { error: 'sujet introuvable' }];
  return [200, { flux: r.stream, mime: 'application/pdf', nom: `sujet-devoir-${d.id}.pdf` }];
}

export async function sujetDeposer({ params, body }) {
  if (!/^\d+$/.test(params.id)) return [404, { error: 'introuvable' }];
  const [d] = await q('SELECT id FROM devoirs WHERE id = $1', [Number(params.id)]);
  if (!d) return [404, { error: 'introuvable' }];
  if (!Buffer.isBuffer(body) || !body.length) return [400, { error: 'fichier manquant' }];
  if (body.length > TAILLE_MAX) return [413, { error: 'fichier trop volumineux (2 Mo maximum)' }];
  if (!typeReel(body) || typeReel(body).mime !== 'application/pdf') return [415, { error: 'le sujet doit être un PDF' }];
  await deposer(`sujets/${d.id}.pdf`, body, 'application/pdf');
  await q('UPDATE devoirs SET sujet = TRUE WHERE id = $1', [d.id]);
  return [200, { ok: true, taille: body.length }];
}

/** Téléchargement d'une copie par l'enseignant. */
export async function copieLire({ params }) {
  if (!/^\d+$/.test(params.id)) return [404, { error: 'introuvable' }];
  const email = decoderEmail(params.email);
  if (!email) return [400, { error: 'adresse invalide' }];
  const [f] = await q('SELECT chemin, type FROM fichiers WHERE devoir_id = $1 AND email = $2', [Number(params.id), email]);
  if (!f) return [404, { error: 'pas de copie déposée' }];
  const r = await lire(f.chemin);
  if (!r || !r.stream) return [404, { error: 'fichier introuvable' }];
  const ext = f.type === 'application/pdf' ? 'pdf' : f.type === 'image/png' ? 'png' : 'jpg';
  return [200, { flux: r.stream, mime: f.type, nom: `copie-devoir${params.id}-${nomSur(email)}.${ext}` }];
}

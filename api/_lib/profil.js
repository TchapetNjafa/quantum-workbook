// Profil de l'étudiant : le MATRICULE est obligatoire pour déposer un devoir, figurer au classement et jouer un défi.
// Conservation : 5 mois (150 jours) après la dernière activité ; l'étudiant peut aussi tout supprimer à tout moment.
import { q, maintenant } from './db.js';

export const RETENTION_JOURS = 150; // 5 mois
const JOUR = 24 * 3600 * 1000;
export const FORMAT_MATRICULE = /^[A-Z0-9]{4,15}$/;
export const normaliser = m => String(m ?? '').trim().replace(/\s+/g, '').toUpperCase();

export async function profilDe(email) {
  return (await q('SELECT email, matricule, nom, visible, cree, activite FROM profils WHERE email = $1', [email]))[0] || null;
}
/** Marque l'étudiant comme actif (repousse la date de suppression automatique). */
export const toucher = email => q('UPDATE profils SET activite = $2 WHERE email = $1', [email, maintenant().toISOString()]);

export async function lire({ session }) {
  const p = await profilDe(session.email);
  return [200, p ? { matricule: p.matricule, visible: p.visible, nom: p.nom, conservation_jours: RETENTION_JOURS } : { matricule: null, conservation_jours: RETENTION_JOURS }];
}

export async function enregistrer({ session, body }) {
  const existant = await profilDe(session.email);
  const visible = typeof body?.visible === 'boolean' ? body.visible : (existant ? existant.visible : true);
  if (existant) { // le matricule ne se change pas seul : en cas d'erreur, l'enseignant réinitialise le profil
    if (body?.matricule !== undefined && normaliser(body.matricule) !== existant.matricule)
      return [409, { error: 'matricule déjà enregistré : contactez l’enseignant pour le corriger' }];
    await q('UPDATE profils SET visible = $2, activite = $3 WHERE email = $1', [session.email, visible, maintenant().toISOString()]);
    return [200, { matricule: existant.matricule, visible }];
  }
  const m = normaliser(body?.matricule);
  if (!FORMAT_MATRICULE.test(m)) return [400, { error: 'matricule invalide : 4 à 15 lettres ou chiffres, sans espace ni signe' }];
  const maintenantISO = maintenant().toISOString();
  try {
    await q('INSERT INTO profils (email, matricule, nom, visible, cree, activite) VALUES ($1,$2,$3,$4,$5,$5)', [session.email, m, session.name || '', visible, maintenantISO]);
  } catch (e) {
    if (/unique|duplicate|23505/i.test(`${e.code} ${e.message}`)) return [409, { error: 'ce matricule est déjà associé à un autre compte : contactez l’enseignant' }];
    throw e;
  }
  return [200, { matricule: m, visible }];
}

/** Droit à l'effacement : supprime le profil, les scores et les défis de l'étudiant. Les devoirs remis et leurs notes restent chez l'enseignant. */
export async function supprimerMesDonnees({ session, body }) {
  if (body?.confirmation !== 'SUPPRIMER') return [400, { error: 'confirmation requise : tapez SUPPRIMER' }];
  await q('DELETE FROM profils WHERE email = $1', [session.email]); // scores, défis créés et essais de défis partent avec lui (ON DELETE CASCADE)
  return [200, { ok: true }];
}

/** Suppression automatique des données de plus de 5 mois (appelée au plus toutes les 6 h, au passage d'une requête). */
let derniere = 0;
export async function purgerAnciennes(force = false) {
  const now = maintenant().getTime();
  if (!force && now - derniere < 6 * 3600 * 1000) return null;
  derniere = now;
  const limite = new Date(now - RETENTION_JOURS * JOUR).toISOString();
  const s = await q('DELETE FROM scores WHERE quand < $1 RETURNING id', [limite]);
  const d = await q('DELETE FROM defis WHERE cree < $1 RETURNING code', [limite]);
  const p = await q('DELETE FROM profils WHERE activite < $1 RETURNING email', [limite]);
  return { scores: s.length, defis: d.length, profils: p.length };
}
export const reinitialiserPurge = () => { derniere = 0; };

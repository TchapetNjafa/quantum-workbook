// Profil de l'étudiant : le MATRICULE est obligatoire pour déposer un devoir, figurer au classement et jouer un défi.
// Conservation : 5 mois (150 jours) après la dernière activité ; l'étudiant peut aussi tout supprimer à tout moment.
import { q, maintenant } from './db.js';
import { supprimer } from './stockage.js';

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
  if (p) return [200, { matricule: p.matricule, visible: p.visible, nom: p.nom, conservation_jours: RETENTION_JOURS }];
  if (session.role === 'prof') return [200, { matricule: null, enseignant: true, conservation_jours: RETENTION_JOURS }]; // l'enseignant ne remet pas de devoir : pas de matricule à demander
  const [l] = await q('SELECT matricule FROM liste_classe WHERE email = $1', [session.email]);
  return [200, { matricule: null, matricule_propose: l ? l.matricule : null, conservation_jours: RETENTION_JOURS }];
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
  // Liste de classe importée par l'enseignant : si elle existe, le matricule doit y figurer et correspondre à cette adresse.
  const [{ n }] = await q('SELECT count(*)::int AS n FROM liste_classe');
  if (n) {
    const [parAdresse] = await q('SELECT matricule FROM liste_classe WHERE email = $1', [session.email]);
    if (parAdresse) {
      if (m && m !== parAdresse.matricule) return [400, { error: `votre matricule dans la liste de classe est ${parAdresse.matricule}`, matricule_propose: parAdresse.matricule }];
      return creerProfil(session, parAdresse.matricule, visible);
    }
    const [ligne] = FORMAT_MATRICULE.test(m) ? await q('SELECT email FROM liste_classe WHERE matricule = $1', [m]) : [];
    if (!ligne) return [403, { error: 'ce matricule ne figure pas dans la liste de classe : vérifiez-le ou contactez l’enseignant' }];
    if (ligne.email) return [403, { error: 'ce matricule est réservé à une autre adresse : contactez l’enseignant' }];
  }
  if (!FORMAT_MATRICULE.test(m)) return [400, { error: 'matricule invalide : 4 à 15 lettres ou chiffres, sans espace ni signe' }];
  return creerProfil(session, m, visible);
}

async function creerProfil(session, m, visible) {
  const maintenantISO = maintenant().toISOString();
  try {
    await q('INSERT INTO profils (email, matricule, nom, visible, cree, activite) VALUES ($1,$2,$3,$4,$5,$5)', [session.email, m, session.name || '', visible, maintenantISO]);
  } catch (e) {
    if (/unique|duplicate|23505/i.test(`${e.code} ${e.message}`)) return [409, { error: 'ce matricule est déjà associé à un autre compte : contactez l’enseignant' }];
    throw e;
  }
  return [200, { matricule: m, visible }];
}

/** Droit à l'effacement : supprime le profil, les scores et les défis de l'étudiant. Les devoirs remis et leurs notes restent chez l'enseignant (5 mois après la fermeture du devoir). */
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
  return { scores: s.length, defis: d.length, profils: p.length, ...(await purgerDevoirs(limite)) };
}

/** Remises, ouvertures et copies des devoirs fermés depuis plus de 5 mois. Le devoir (énoncé, questions, sujet) reste.
 *  Une copie dont le fichier ne peut pas être supprimé garde sa ligne : elle sera reprise au passage suivant. */
async function purgerDevoirs(limite) {
  const maintenantISO = maintenant().toISOString();
  let devoirs = 0, copies = 0, echecs = 0;
  for (const d of await q('SELECT id FROM devoirs WHERE ferme < $1 AND purge IS NULL', [limite])) {
    for (const f of await q('SELECT chemin FROM fichiers WHERE devoir_id = $1', [d.id])) {
      try { await supprimer(f.chemin); await q('DELETE FROM fichiers WHERE devoir_id = $1 AND chemin = $2', [d.id, f.chemin]); copies++; }
      catch (e) { echecs++; console.error('purge copie', e.message); }
    }
    await q('DELETE FROM remises WHERE devoir_id = $1', [d.id]);
    await q('DELETE FROM debuts WHERE devoir_id = $1', [d.id]);
    const [{ reste }] = await q('SELECT count(*)::int AS reste FROM fichiers WHERE devoir_id = $1', [d.id]);
    if (!reste) { await q('UPDATE devoirs SET purge = $2 WHERE id = $1', [d.id, maintenantISO]); devoirs++; }
  }
  return { devoirs, copies, echecs_copies: echecs };
}
export const reinitialiserPurge = () => { derniere = 0; };

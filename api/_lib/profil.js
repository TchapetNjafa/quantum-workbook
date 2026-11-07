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

// ---------- correspondance matricule ↔ nom ----------
const jetons = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/[^a-z]+/).filter(Boolean);
const distance1 = (a, b) => { // vrai si a et b diffèrent d'au plus une lettre (faute de frappe) ; les mots courts doivent être identiques
  if (a === b) return true;
  if (Math.min(a.length, b.length) < 5 || Math.abs(a.length - b.length) > 1) return false;
  let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return a.slice(i + 1) === b.slice(i + 1) || a.slice(i) === b.slice(i + 1) || a.slice(i + 1) === b.slice(i);
};
/** Le nom saisi par l'étudiant correspond-il au nom de la liste de classe ? Accents, casse, ordre des mots et petite faute de frappe ignorés.
 *  Il faut au moins deux mots du nom de la liste (un seul si le nom n'en a qu'un) et AUCUN mot saisi qui n'appartienne pas à ce nom. */
export function nomCorrespond(saisi, liste) {
  const s = [...new Set(jetons(saisi))], l = jetons(liste);
  if (!s.length || !l.length) return false;
  const utilises = new Set();
  for (const mot of s) {
    const i = l.findIndex((x, k) => !utilises.has(k) && distance1(mot, x));
    if (i < 0) return false;
    utilises.add(i);
  }
  return utilises.size >= Math.min(2, l.length);
}

/** L'adresse e-mail (prénom.nom@…) ressemble-t-elle au nom ? Sert à signaler en rouge un profil dont l'adresse n'a aucun rapport avec le nom de la liste
 *  (usurpation probable de l'identité d'un camarade). Vrai quand on ne peut pas juger (nom inconnu, adresse faite de chiffres ou d'initiales). */
export function emailCorrespond(email, nom) {
  const n = jetons(nom);
  const e = jetons(String(email ?? '').split('@')[0]).filter(x => x.length >= 2);
  if (!n.length || !e.length) return true;
  return e.some(x => n.some(y => distance1(x, y) || (y.length >= 4 && x.includes(y)) || (x.length >= 3 && y.startsWith(x))));
}

export async function lire({ session }) {
  const p = await profilDe(session.email);
  if (p) return [200, { matricule: p.matricule, visible: p.visible, nom: p.nom, conservation_jours: RETENTION_JOURS }];
  if (session.role === 'prof') return [200, { matricule: null, enseignant: true, conservation_jours: RETENTION_JOURS }]; // l'enseignant ne remet pas de devoir : pas de matricule à demander
  const [l] = await q('SELECT matricule, nom FROM liste_classe WHERE email = $1', [session.email]);
  return [200, { matricule: null, matricule_propose: l ? l.matricule : null, nom_propose: l ? l.nom : null, conservation_jours: RETENTION_JOURS }];
}

export async function enregistrer({ session, body }) {
  const existant = await profilDe(session.email);
  const visible = typeof body?.visible === 'boolean' ? body.visible : (existant ? existant.visible : true);
  if (existant) { // le matricule ne se change pas seul : en cas d'erreur, l'enseignant le corrige (page Enseignant > Profils)
    if (body?.matricule !== undefined && normaliser(body.matricule) !== existant.matricule)
      return [409, { error: 'matricule déjà enregistré : contactez l’enseignant pour le corriger' }];
    await q('UPDATE profils SET visible = $2, activite = $3 WHERE email = $1', [session.email, visible, maintenant().toISOString()]);
    return [200, { matricule: existant.matricule, visible }];
  }
  let m = normaliser(body?.matricule);
  // Le matricule doit figurer dans la liste de classe de l'enseignant ET correspondre au nom saisi (et à l'adresse, si la liste en donne une).
  const [{ n }] = await q('SELECT count(*)::int AS n FROM liste_classe');
  if (!n) return [503, { error: 'la liste de classe n’a pas encore été importée par l’enseignant : le profil ne peut pas être créé pour le moment' }];
  const [parAdresse] = await q('SELECT matricule FROM liste_classe WHERE email = $1', [session.email]);
  if (!m && parAdresse) m = parAdresse.matricule; // matricule non saisi : celui de la liste pour cette adresse
  if (!FORMAT_MATRICULE.test(m)) return [400, { error: 'matricule invalide : 4 à 15 lettres ou chiffres, sans espace ni signe' }];
  if (!jetons(body?.nom).length) return [400, { error: 'saisissez votre nom et vos prénoms, tels qu’ils figurent sur la liste de classe' }];
  if (parAdresse && m !== parAdresse.matricule) return [400, { error: `votre matricule dans la liste de classe est ${parAdresse.matricule}`, matricule_propose: parAdresse.matricule }];
  const [ligne] = await q('SELECT nom, email FROM liste_classe WHERE matricule = $1', [m]);
  if (!ligne) return [403, { error: 'ce matricule ne figure pas dans la liste de classe : vérifiez-le ou contactez l’enseignant' }];
  if (ligne.email && ligne.email !== session.email) return [403, { error: 'ce matricule est réservé à une autre adresse : contactez l’enseignant' }];
  if (!nomCorrespond(body.nom, ligne.nom)) return [403, { error: 'le nom saisi ne correspond pas à ce matricule : écrivez votre nom et vos prénoms comme sur la liste de classe, ou contactez l’enseignant' }];
  return creerProfil(session, m, visible, ligne.nom);
}

async function creerProfil(session, m, visible, nomListe) {
  const maintenantISO = maintenant().toISOString();
  try {
    await q('INSERT INTO profils (email, matricule, nom, visible, cree, activite) VALUES ($1,$2,$3,$4,$5,$5)', [session.email, m, nomListe || session.name || '', visible, maintenantISO]);
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

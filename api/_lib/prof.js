// Fonctions réservées à l'enseignant : verrou (compte Google + mot de passe), création et gestion des devoirs.
import { createHash, timingSafeEqual } from 'node:crypto';
import { q, maintenant } from './db.js';
import { valider, decoderEmail } from './grade.js';
import { creer, depuisRequete } from './session.js';
import { supprimer, essai, modeAuth } from './stockage.js';

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
    'INSERT INTO devoirs (titre, ouvre, ferme, publie, resultat_visible, questions, copie, bareme) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',
    [v.devoir.titre, v.devoir.ouvre, v.devoir.ferme, body.publie === true, body.resultat_visible === true, JSON.stringify(v.devoir.questions), body.copie === true,
      v.devoir.questions.length === 0 ? Number(body.bareme ?? 20) : null]); // sans question : note saisie à la main sur ce barème (20 par défaut)
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

/** Vérifie la configuration réelle du serveur. Ne renvoie jamais de valeur secrète : seulement présent/absent et le message d'erreur du service. */
export async function diagnostic() {
  const present = nom => !!process.env[nom];
  const variables = {
    GOOGLE_CLIENT_ID: present('GOOGLE_CLIENT_ID'), SESSION_SECRET: (process.env.SESSION_SECRET || '').length >= 32, TEACHER_EMAIL: present('TEACHER_EMAIL'),
    TEACHER_PASSWORD: present('TEACHER_PASSWORD'), BASE_DE_DONNEES: present('DATABASE_URL') || present('POSTGRES_URL'), BLOB_AUTHENTIFICATION: modeAuth()
  };
  const essayer = async f => { try { await f(); return { ok: true }; } catch (e) { return { ok: false, erreur: String(e.message || e).slice(0, 300) }; } };
  const base = await essayer(async () => { await q('SELECT 1 AS ok'); });
  const stockage = await essayer(essai);
  return [200, { variables, base, stockage }];
}

// ---------- export, correction manuelle, purge, suppression ----------
const cellule = v => { // CSV : séparateur « ; » (Excel français) ; une cellule qui commence par = + - @ est neutralisée (injection de formule)
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r\n]/.test(s)) s = "'" + s;
  return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

export async function exportCsv({ params }) {
  if (!/^\d+$/.test(params.id)) return [404, { error: 'introuvable' }];
  const [d] = await q('SELECT titre FROM devoirs WHERE id = $1', [Number(params.id)]);
  if (!d) return [404, { error: 'introuvable' }];
  const [, { remises }] = await remisesDevoir({ params });
  const entete = ['email', 'nom', 'note_auto', 'total_auto', 'note_manuelle', 'total_manuel', 'note_totale', 'recu_serveur', 'en_retard', 'hors_connexion',
    'declare_appareil_non_verifiable', 'ouverture_serveur', 'copie', 'copie_octets', 'copie_recu_serveur', 'copie_en_retard'];
  const lignes = remises.map(r => {
    const complet = r.note !== null && (!r.manuel || r.note_manuelle !== null);
    return [r.email, r.nom, r.note, r.total, r.note_manuelle, r.manuel ? r.total_manuel : '', complet ? r.note + (r.note_manuelle || 0) : '',
      r.recu, r.recu ? (r.retard ? 'oui' : 'non') : '', r.recu ? (r.hors_ligne ? 'oui' : 'non') : '', r.declare, r.debut,
      r.copie_taille ? 'oui' : 'non', r.copie_taille, r.copie_recu, r.copie_taille ? (r.copie_retard ? 'oui' : 'non') : ''];
  });
  const texte = '\ufeff' + [entete, ...lignes].map(l => l.map(cellule).join(';')).join('\r\n') + '\r\n';
  return [200, { texte, mime: 'text/csv; charset=utf-8', nom: `devoir-${params.id}-notes.csv` }];
}

/** Les questions à correction manuelle d'une remise, avec la réponse de l'étudiant. */
export async function lireRemise({ params }) {
  if (!/^\d+$/.test(params.id)) return [404, { error: 'introuvable' }];
  const [r] = await q(
    `SELECT r.reponses, r.note_manuelle, r.total_manuel, r.recu, d.questions FROM remises r JOIN devoirs d ON d.id = r.devoir_id
      WHERE r.devoir_id = $1 AND r.email = $2`, [Number(params.id), decoderEmail(params.email)]);
  if (!r) return [404, { error: 'remise introuvable' }];
  const questions = r.questions.filter(x => x.type === 'interpretation').map(x => ({ id: x.id, question: x.question, points: x.points, reponse: r.reponses[x.id] ?? '' }));
  // `recu` identifie la version lue : la note ne s'applique que si l'étudiant n'a pas remis autre chose entre-temps
  return [200, { questions, recu: iso(r.recu), note_manuelle: r.note_manuelle === null ? null : Number(r.note_manuelle), total_manuel: Number(r.total_manuel) }];
}

export async function noterManuel({ params, body }) {
  if (!/^\d+$/.test(params.id)) return [404, { error: 'introuvable' }];
  const email = decoderEmail(params.email);
  if (!email) return [400, { error: 'adresse invalide' }];
  const [r] = await q('SELECT total_manuel FROM remises WHERE devoir_id = $1 AND email = $2', [Number(params.id), email]);
  if (!r) return [404, { error: 'remise introuvable' }];
  const total = Number(r.total_manuel);
  if (!(total > 0)) return [400, { error: 'aucune question à correction manuelle' }];
  const points = body.points === null ? null : Number(body.points);
  if (points !== null && !(Number.isFinite(points) && points >= 0 && points <= total)) return [400, { error: `points entre 0 et ${total}` }];
  if (typeof body.recu !== 'string' || isNaN(new Date(body.recu))) return [400, { error: 'version de la remise manquante (recu)' }];
  const ecrit = await q('UPDATE remises SET note_manuelle = $3 WHERE devoir_id = $1 AND email = $2 AND recu = $4 RETURNING devoir_id',
    [Number(params.id), email, points, new Date(body.recu).toISOString()]);
  if (!ecrit.length) return [409, { error: 'l’étudiant a remis de nouvelles réponses : relisez avant de noter' }];
  return [200, { ok: true, note_manuelle: points, total_manuel: total }];
}

async function supprimerFichiers(lignes) {
  let supprimes = 0, echecs = 0;
  for (const l of lignes) {
    try { await supprimer(l.chemin); supprimes++; } catch (e) { echecs++; console.error('suppression', e.message); }
  }
  return { supprimes, echecs };
}

/** Supprime toutes les copies déposées d'un devoir (après téléchargement par l'enseignant). Les notes restent. */
export async function purgerCopies({ params, body }) {
  if (!/^\d+$/.test(params.id)) return [404, { error: 'introuvable' }];
  if (body?.confirmation !== 'SUPPRIMER') return [400, { error: 'confirmation requise : tapez SUPPRIMER' }];
  // Seules les copies du manifeste (étudiant + heure de réception) sont supprimées : celles déposées ou remplacées depuis
  // le téléchargement du ZIP ne sont pas dans l'archive et restent sur le serveur.
  if (!Array.isArray(body.manifeste)) return [400, { error: 'manifeste des copies téléchargées manquant' }];
  const dansZip = new Set(body.manifeste.map(m => `${String(m?.email).toLowerCase()}|${new Date(m?.recu).getTime()}`));
  const lignes = await q('SELECT email, chemin, recu FROM fichiers WHERE devoir_id = $1', [Number(params.id)]);
  let supprimes = 0, echecs = 0, conservees = 0;
  for (const l of lignes) {
    if (!dansZip.has(`${l.email}|${new Date(l.recu).getTime()}`)) { conservees++; continue; }
    try { await supprimer(l.chemin); await q('DELETE FROM fichiers WHERE devoir_id = $1 AND chemin = $2', [Number(params.id), l.chemin]); supprimes++; }
    catch (e) { echecs++; console.error('purge', e.message); }
  }
  return [200, { supprimes, echecs, conservees }];
}

/** Supprime un devoir, ses remises, ses copies et son sujet. La confirmation est le titre exact du devoir. */
export async function supprimerDevoir({ params, body }) {
  if (!/^\d+$/.test(params.id)) return [404, { error: 'introuvable' }];
  const [d] = await q('SELECT id, titre, sujet FROM devoirs WHERE id = $1', [Number(params.id)]);
  if (!d) return [404, { error: 'introuvable' }];
  if (body?.confirmation !== d.titre) return [400, { error: 'confirmation requise : tapez le titre exact du devoir' }];
  const lignes = await q('SELECT chemin FROM fichiers WHERE devoir_id = $1', [d.id]);
  if (d.sujet) lignes.push({ chemin: `sujets/${d.id}.pdf` });
  const { supprimes, echecs } = await supprimerFichiers(lignes);
  if (echecs) return [502, { error: 'des fichiers n’ont pas pu être supprimés ; le devoir est conservé, réessayez', echecs }];
  await q('DELETE FROM devoirs WHERE id = $1', [d.id]);
  return [200, { ok: true, fichiers_supprimes: supprimes }];
}

export async function remisesDevoir({ params }) {
  if (!/^\d+$/.test(params.id)) return [404, { error: 'introuvable' }];
  const l = await q(
    // un étudiant apparaît s'il a remis les réponses OU déposé une copie (l'un des deux peut manquer)
    `SELECT u.email, r.nom, r.note, r.total, r.manuel, r.note_manuelle, r.total_manuel, r.declare, r.recu, r.retard, r.hors_ligne, b.debut,
            f.taille AS copie_taille, f.recu AS copie_recu, f.retard AS copie_retard
       FROM (SELECT email FROM remises WHERE devoir_id = $1 UNION SELECT email FROM fichiers WHERE devoir_id = $1) u
       LEFT JOIN remises r ON r.devoir_id = $1 AND r.email = u.email
       LEFT JOIN debuts b ON b.devoir_id = $1 AND b.email = u.email
       LEFT JOIN fichiers f ON f.devoir_id = $1 AND f.email = u.email
      ORDER BY u.email`, [Number(params.id)]);
  const num = v => (v === null || v === undefined ? null : Number(v));
  return [200, { remises: l.map(r => ({ ...r, nom: r.nom || '', note: num(r.note), total: num(r.total), note_manuelle: num(r.note_manuelle), total_manuel: num(r.total_manuel), declare: iso(r.declare), recu: iso(r.recu), debut: iso(r.debut), copie_recu: iso(r.copie_recu) })) }];
}

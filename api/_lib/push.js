// Notifications Web Push (écran verrouillé, barre de notification) quand un devoir est publié.
// Sans bibliothèque : « push sans contenu » signé VAPID (node:crypto). Le service worker, à la réception, lit /api/statut (public)
// pour composer le texte ; le serveur d'envoi du navigateur ne voit donc jamais le titre du devoir.
// Variables Vercel : VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (outils/generer_cles_push.mjs), VAPID_SUBJECT (mailto:… facultatif).
import { createPrivateKey, sign } from 'node:crypto';
import { q, maintenant } from './db.js';
import { profilDe } from './profil.js';

const b64u = b => Buffer.from(b).toString('base64url');
const MATRICULE_REQUIS = [400, { error: 'enregistrez d’abord votre matricule (page Profil)', matricule_requis: true }];
let envoi = (url, opt) => fetch(url, opt); // remplaçable par les tests
export const setEnvoi = f => { envoi = f; };

const cles = () => {
  const pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  return pub && priv && Buffer.from(pub, 'base64url').length === 65 ? { pub, priv } : null;
};

/** En-tête VAPID (RFC 8292) pour un serveur d'envoi donné. */
export function vapid(endpoint, { pub, priv }) {
  const p = Buffer.from(pub, 'base64url');
  const h = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const c = b64u(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(maintenant().getTime() / 1000) + 12 * 3600, sub: process.env.VAPID_SUBJECT || 'mailto:' + String(process.env.TEACHER_EMAIL || 'admin@example.org').split(/[\s,;]+/)[0] }));
  const key = createPrivateKey({ key: { kty: 'EC', crv: 'P-256', d: priv, x: b64u(p.subarray(1, 33)), y: b64u(p.subarray(33, 65)) }, format: 'jwk' });
  const sig = sign('sha256', Buffer.from(`${h}.${c}`), { key, dsaEncoding: 'ieee-p1363' });
  return `vapid t=${h}.${c}.${b64u(sig)}, k=${pub}`;
}

export async function cle() {
  const k = cles();
  return [200, { cle: k ? k.pub : null }];
}

const endpointValide = e => typeof e === 'string' && e.length <= 1000 && /^https:\/\//.test(e);

export async function abonner({ session, body }) {
  if (!cles()) return [503, { error: 'notifications non configurées sur ce serveur' }];
  if (!endpointValide(body?.endpoint)) return [400, { error: 'abonnement invalide' }];
  if (session.role === 'prof') return [403, { error: 'réservé aux étudiants' }];
  if (!(await profilDe(session.email))) return MATRICULE_REQUIS;
  // un navigateur change de compte : l'abonnement passe au dernier compte connecté
  await q(`INSERT INTO push_abos (endpoint, email, cree) VALUES ($1,$2,$3)
           ON CONFLICT (endpoint) DO UPDATE SET email = $2, cree = $3`, [body.endpoint, session.email, maintenant().toISOString()]);
  return [200, { ok: true }];
}

export async function desabonner({ session, body }) {
  if (!endpointValide(body?.endpoint)) return [400, { error: 'abonnement invalide' }];
  await q('DELETE FROM push_abos WHERE endpoint = $1 AND email = $2', [body.endpoint, session.email]);
  return [200, { ok: true }];
}

/** Envoie le signal aux abonnements donnés ; les abonnements expirés (404/410) sont retirés. Renvoie { envoyes, expires, echecs, abonnes }. */
async function diffuser(k, abos) {
  const bilan = { configure: true, abonnes: abos.length, envoyes: 0, expires: 0, echecs: 0 };
  for (let i = 0; i < abos.length; i += 40) { // lots de 40 envois simultanés
    await Promise.all(abos.slice(i, i + 40).map(async ({ endpoint }) => {
      try {
        const r = await envoi(endpoint, { method: 'POST', headers: { Authorization: vapid(endpoint, k), TTL: '86400', Urgency: 'high', 'Content-Length': '0' }, signal: AbortSignal.timeout(8000) });
        if (r.status === 404 || r.status === 410) { bilan.expires++; await q('DELETE FROM push_abos WHERE endpoint = $1', [endpoint]); }
        else if (r.ok) bilan.envoyes++; else bilan.echecs++;
      } catch { bilan.echecs++; }
    }));
  }
  return bilan;
}

const NON_CONFIGURE = { configure: false, abonnes: 0, envoyes: 0, expires: 0, echecs: 0 };

export async function notifierTous() {
  const k = cles();
  return k ? diffuser(k, await q('SELECT endpoint FROM push_abos')) : NON_CONFIGURE;
}

/** Rappel (tâche planifiée) : seuls les abonnés qui n'ont encore rien remis pour un devoir qui ferme dans les `heures` prochaines. */
export async function rappelerFermeture(heures = 24) {
  const k = cles();
  if (!k) return NON_CONFIGURE;
  const now = maintenant();
  const abos = await q(`SELECT p.endpoint FROM push_abos p WHERE EXISTS (
      SELECT 1 FROM devoirs d WHERE d.publie AND d.ouvre <= $1 AND d.ferme > $1 AND d.ferme <= $2
        AND NOT EXISTS (SELECT 1 FROM remises r WHERE r.devoir_id = d.id AND r.email = p.email)
        AND NOT EXISTS (SELECT 1 FROM fichiers f WHERE f.devoir_id = d.id AND f.email = p.email))`,
    [now.toISOString(), new Date(now.getTime() + heures * 3600e3).toISOString()]);
  return diffuser(k, abos);
}

/** Enseignant : renvoyer la notification (ex. devoir publié à l'avance qui vient de s'ouvrir). */
export async function notifierManuel() {
  return [200, await notifierTous()];
}

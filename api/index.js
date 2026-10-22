// Point d'entrée unique de l'API (le plan gratuit limite le nombre de fonctions).
// vercel.json réécrit /api/* vers cette fonction en passant le chemin dans le paramètre `path` (ex. /api/prof/login -> path=prof/login).
// Les tests locaux appellent le gestionnaire avec l'adresse complète : les deux formes sont acceptées.
import { verifyIdToken } from './_lib/google.js';
import { creer, cookie, depuisRequete } from './_lib/session.js';
import * as devoirs from './_lib/devoirs.js';
import * as prof from './_lib/prof.js';
import * as fichiers from './_lib/fichiers.js';
import { Readable, pipeline } from 'node:stream';

const DOMAIN = () => process.env.ALLOWED_DOMAIN || 'facsciences-uy1.cm';

function json(res, status, body, headers = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}

async function corps(req, max) {
  let n = 0; const morceaux = [];
  for await (const c of req) { n += c.length; if (n > max) throw Object.assign(new Error('corps trop grand'), { code: 'taille' }); morceaux.push(c); }
  try { return JSON.parse(Buffer.concat(morceaux).toString() || '{}'); }
  catch { throw Object.assign(new Error('JSON invalide'), { code: 'json' }); }
}

// Corps binaire (fichier déposé) : refusé dès que la taille annoncée ou reçue dépasse la limite.
async function octets(req, max) {
  const annonce = Number(req.headers['content-length']);
  if (annonce > max) throw Object.assign(new Error('corps trop grand'), { code: 'taille' });
  let n = 0; const morceaux = [];
  for await (const c of req) { n += c.length; if (n > max) throw Object.assign(new Error('corps trop grand'), { code: 'taille' }); morceaux.push(c); }
  return Buffer.concat(morceaux);
}
// Types de contenu admis pour un dépôt de fichier : tous hors liste « simple » des navigateurs, donc impossibles à envoyer depuis un autre site sans autorisation préalable.
const TYPES_FICHIER = /^(application\/(pdf|octet-stream)|image\/(jpeg|png))(;|$)/;

// Les POST doivent venir de notre propre site (protection contre les requêtes intersites).
function memeOrigine(req) {
  const o = req.headers.origin;
  return !o || new URL(o).host === req.headers.host;
}

const estLocal = req => /^(localhost|127\.)/.test(req.headers.host || '');
const estProf = email => !!process.env.TEACHER_EMAIL && email.toLowerCase() === process.env.TEACHER_EMAIL.toLowerCase();

// Routes directes (elles écrivent elles-mêmes la réponse).
const directes = {
  'GET /api/config': (req, res) => json(res, 200, { clientId: process.env.GOOGLE_CLIENT_ID || null, domain: DOMAIN() }),

  'GET /api/me': (req, res) => {
    const s = depuisRequete(req);
    return s ? json(res, 200, { email: s.email, name: s.name, teacher: s.role === 'prof', verrou: s.role === 'prof' ? !prof.profOk(req, s) : false })
      : json(res, 401, { error: 'non connecté' });
  },

  // Toujours 200 (pas d'erreur rouge dans la console pour les visiteurs non connectés) : sert à la barre du haut de chaque page.
  'GET /api/statut': async (req, res) => {
    const s = depuisRequete(req);
    if (!s) return json(res, 200, { connecte: false });
    let a_faire = 0;
    try { a_faire = (await devoirs.liste({ session: s }))[1].a_faire; } catch (e) { console.error('statut', e.code || '', e.message); }
    return json(res, 200, { connecte: true, teacher: s.role === 'prof', a_faire });
  },

  'POST /api/session': async (req, res) => {
    if (!memeOrigine(req) || !/application\/json/.test(req.headers['content-type'] || '')) return json(res, 403, { error: 'origine refusée' });
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) return json(res, 503, { error: 'GOOGLE_CLIENT_ID non configuré' });
    const { credential } = await corps(req, 10_000);
    try {
      const c = await verifyIdToken(credential, { clientId, domain: DOMAIN(), rule: process.env.DOMAIN_RULE || 'both' });
      const role = estProf(c.email) ? 'prof' : 'etudiant';
      const jeton = creer({ sub: c.sub, email: c.email.toLowerCase(), name: c.name || '', role });
      return json(res, 200, { email: c.email.toLowerCase(), name: c.name || '', teacher: role === 'prof' },
        { 'Set-Cookie': cookie(jeton, { secure: !estLocal(req) }) });
    } catch (e) {
      if (e.code === 'config') throw e;
      // Test d'alias : avec ALIAS_DEBUG=1, la page montre ce que Google renvoie pour le compte qui se connecte.
      const claims = process.env.ALIAS_DEBUG === '1' && e.claims
        ? { email: e.claims.email, hd: e.claims.hd ?? null, email_verified: e.claims.email_verified } : undefined;
      return json(res, 401, { error: e.message, code: e.code, claims });
    }
  },

  'POST /api/logout': (req, res) => {
    if (!memeOrigine(req)) return json(res, 403, { error: 'origine refusée' });
    const secure = !estLocal(req);
    return json(res, 200, { ok: true }, { 'Set-Cookie': [cookie('', { secure, maxAge: 0 }), cookie('', { secure, maxAge: 0, nom: prof.COOKIE_PROF })] });
  }
};

// Routes à adresses paramétrées : [méthode, motif, accès, taille max du corps, fonction -> [statut, corps, extras]].
// accès : 'session' (compte du domaine) ou 'prof' (compte enseignant + mot de passe saisi récemment).
const TABLE = [
  ['GET', '/api/devoirs', 'session', 0, devoirs.liste],
  ['GET', '/api/devoirs/:id', 'session', 0, devoirs.ouvrir],
  ['POST', '/api/devoirs/:id/remise', 'session', 100_000, devoirs.remettre],
  ['POST', '/api/prof/login', 'session', 1_000, prof.login],
  ['GET', '/api/prof/devoirs', 'prof', 0, prof.listeDevoirs],
  ['POST', '/api/prof/devoirs', 'prof', 250_000, prof.creerDevoir],
  ['GET', '/api/prof/devoirs/:id', 'prof', 0, prof.lireDevoir],
  ['POST', '/api/prof/devoirs/:id', 'prof', 10_000, prof.modifierDevoir],
  ['GET', '/api/prof/devoirs/:id/remises', 'prof', 0, prof.remisesDevoir],
  // fichiers : 6e valeur true = corps binaire
  ['POST', '/api/devoirs/:id/copie', 'session', 2 * 1024 * 1024, fichiers.deposerCopie, true],
  ['GET', '/api/devoirs/:id/copie', 'session', 0, fichiers.maCopie],
  ['GET', '/api/devoirs/:id/sujet', 'session', 0, fichiers.sujetLire],
  ['POST', '/api/prof/devoirs/:id/sujet', 'prof', 2 * 1024 * 1024, fichiers.sujetDeposer, true],
  ['GET', '/api/prof/devoirs/:id/copie/:email', 'prof', 0, fichiers.copieLire]
].map(([methode, motif, acces, max, fn, binaire = false]) => ({ methode, acces, max, fn, binaire, re: new RegExp('^' + motif.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$') }));

async function parametree(req, res, chemin) {
  for (const r of TABLE) {
    const m = r.re.exec(chemin);
    if (!m) continue;
    if (r.methode !== req.method) continue;
    const session = depuisRequete(req);
    if (!session) return json(res, 401, { error: 'non connecté' });
    if (r.acces === 'prof') {
      if (session.role !== 'prof') return json(res, 403, { error: 'réservé à l’enseignant' });
      if (!prof.profOk(req, session)) return json(res, 401, { error: 'mot de passe enseignant requis', verrou: true });
    }
    const typeOk = r.binaire ? TYPES_FICHIER.test(req.headers['content-type'] || '') : /application\/json/.test(req.headers['content-type'] || '');
    if (r.methode === 'POST' && (!memeOrigine(req) || !typeOk)) return json(res, 403, { error: 'origine refusée' });
    const body = r.methode === 'POST' ? (r.binaire ? await octets(req, r.max) : await corps(req, r.max)) : undefined;
    const [statut, reponse, extras = {}] = await r.fn({ req, session, body, params: m.groups || {} });
    if (reponse && reponse.flux) { // fichier privé renvoyé en flux, jamais mis en cache ni interprété par le navigateur
      res.statusCode = statut;
      res.setHeader('Content-Type', reponse.mime);
      res.setHeader('Content-Disposition', `attachment; filename="${reponse.nom}"`);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'private, no-store');
      // pipeline détruit la réponse si le stockage échoue en cours de route (sinon l'erreur échapperait au try/catch)
      return pipeline(Readable.fromWeb(reponse.flux), res, err => { if (err) console.error('flux fichier', err.code || '', err.message); });
    }
    const entetes = extras.cookieProf ? { 'Set-Cookie': cookie(extras.cookieProf, { secure: !estLocal(req), maxAge: prof.DUREE_PROF, nom: prof.COOKIE_PROF }) } : {};
    return json(res, statut, reponse, entetes);
  }
  return false;
}

export default async function handler(req, res) {
  const u = new URL(req.url, 'http://x');
  // Réécrit par Vercel : l'adresse reçue est /api/index et le vrai chemin est dans `path` ; sinon on lit l'adresse telle quelle.
  const reecrit = /^\/api\/index\/?$/.test(u.pathname) ? u.searchParams.get('path') : null;
  const chemin = (reecrit !== null ? '/api/' + reecrit : u.pathname).replace(/\/+$/, '');
  try {
    const directe = directes[`${req.method} ${chemin}`];
    if (directe) return await directe(req, res);
    if ((await parametree(req, res, chemin)) !== false) return;
    json(res, 404, { error: 'inconnu' });
  } catch (e) {
    console.error('api', chemin, e.code || '', e.message);
    const statut = e.code === 'taille' ? 413 : e.code === 'json' ? 400 : 500;
    json(res, statut, { error: e.code === 'config' ? 'serveur mal configuré' : e.code === 'json' ? 'JSON invalide' : e.code === 'taille' ? 'corps trop grand' : 'erreur serveur' });
  }
}

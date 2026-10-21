// Point d'entrée unique de l'API (le plan gratuit limite le nombre de fonctions).
// Le nom de fichier [...route] fait recevoir toutes les adresses /api/* ; req.url garde l'adresse d'origine.
import { verifyIdToken } from './_lib/google.js';
import { creer, cookie, depuisRequete } from './_lib/session.js';

const DOMAIN = () => process.env.ALLOWED_DOMAIN || 'facsciences-uy1.cm';

function json(res, status, body, headers = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}

async function corps(req, max = 10_000) {
  let n = 0; const morceaux = [];
  for await (const c of req) { n += c.length; if (n > max) throw Object.assign(new Error('corps trop grand'), { code: 'taille' }); morceaux.push(c); }
  return JSON.parse(Buffer.concat(morceaux).toString() || '{}');
}

// Les POST doivent venir de notre propre site (protection contre les requêtes intersites).
function memeOrigine(req) {
  const o = req.headers.origin;
  return !o || new URL(o).host === req.headers.host;
}

const estLocal = req => /^(localhost|127\.)/.test(req.headers.host || '');
const estProf = email => !!process.env.TEACHER_EMAIL && email.toLowerCase() === process.env.TEACHER_EMAIL.toLowerCase();

const routes = {
  'GET /api/config': (req, res) => json(res, 200, { clientId: process.env.GOOGLE_CLIENT_ID || null, domain: DOMAIN() }),

  'GET /api/me': (req, res) => {
    const s = depuisRequete(req);
    return s ? json(res, 200, { email: s.email, name: s.name, teacher: s.role === 'prof' }) : json(res, 401, { error: 'non connecté' });
  },

  'POST /api/session': async (req, res) => {
    if (!memeOrigine(req) || !/application\/json/.test(req.headers['content-type'] || '')) return json(res, 403, { error: 'origine refusée' });
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) return json(res, 503, { error: 'GOOGLE_CLIENT_ID non configuré' });
    const { credential } = await corps(req);
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
    return json(res, 200, { ok: true }, { 'Set-Cookie': cookie('', { secure: !estLocal(req), maxAge: 0 }) });
  }
};

export default async function handler(req, res) {
  const chemin = new URL(req.url, 'http://x').pathname.replace(/\/+$/, '');
  const route = routes[`${req.method} ${chemin}`];
  if (!route) return json(res, 404, { error: 'inconnu' });
  try { await route(req, res); }
  catch (e) {
    console.error('api', chemin, e.code || '', e.message);
    json(res, e.code === 'taille' ? 413 : 500, { error: e.code === 'config' ? 'serveur mal configuré' : 'erreur serveur' });
  }
}

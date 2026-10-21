// Vérification d'un jeton d'identité Google (JWT RS256) avec node:crypto seulement.
import { createPublicKey, verify } from 'node:crypto';

const certsUrl = () => process.env.GOOGLE_CERTS_URL || 'https://www.googleapis.com/oauth2/v3/certs';
let cache = { at: 0, keys: [] };

async function keys(force) {
  if (!force && cache.keys.length && Date.now() - cache.at < 3600e3) return cache.keys;
  const r = await fetch(certsUrl());
  if (!r.ok) throw rejet('certificats Google indisponibles', 'certs');
  cache = { at: Date.now(), keys: (await r.json()).keys || [] };
  return cache.keys;
}

export function rejet(message, code, claims) {
  return Object.assign(new Error(message), { code, claims });
}

const decode = s => Buffer.from(s, 'base64url');

/** Domaine accepté : 'both' (adresse ET revendication hd), 'email' ou 'hd'. */
export function domaineOk(claims, domain, rule = 'both') {
  const parEmail = typeof claims.email === 'string' && claims.email.toLowerCase().endsWith('@' + domain);
  const parHd = claims.hd === domain;
  return rule === 'email' ? parEmail : rule === 'hd' ? parHd : parEmail && parHd;
}

export async function verifyIdToken(token, { clientId, domain, rule = 'both', now = Date.now() / 1000 }) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw rejet('jeton mal formé', 'format');
  let header, claims;
  try { header = JSON.parse(decode(parts[0])); claims = JSON.parse(decode(parts[1])); }
  catch { throw rejet('jeton illisible', 'format'); }
  if (header.alg !== 'RS256') throw rejet('algorithme refusé', 'alg');

  const jwk = (await keys()).find(k => k.kid === header.kid) || (await keys(true)).find(k => k.kid === header.kid);
  if (!jwk) throw rejet('clé inconnue', 'kid');
  const ok = verify('RSA-SHA256', Buffer.from(parts[0] + '.' + parts[1]), createPublicKey({ key: jwk, format: 'jwk' }), decode(parts[2]));
  if (!ok) throw rejet('signature invalide', 'signature');

  if (!['accounts.google.com', 'https://accounts.google.com'].includes(claims.iss)) throw rejet('émetteur refusé', 'iss', claims);
  if (claims.aud !== clientId) throw rejet('destinataire refusé', 'aud', claims);
  if (!(claims.exp > now)) throw rejet('jeton expiré', 'exp', claims);
  if (claims.email_verified !== true) throw rejet('adresse non vérifiée', 'email_verified', claims);
  if (!domaineOk(claims, domain, rule)) throw rejet('domaine refusé', 'domaine', claims);
  return claims;
}

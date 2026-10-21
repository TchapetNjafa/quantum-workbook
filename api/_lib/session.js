// Session par cookie signé (HMAC-SHA256), sans base de données.
import { createHmac, timingSafeEqual } from 'node:crypto';

export const COOKIE = 'phy321_session';
export const DUREE = 12 * 3600; // secondes

function secret() {
  const s = process.env.SESSION_SECRET || '';
  if (s.length < 32) throw Object.assign(new Error('SESSION_SECRET absent ou trop court'), { code: 'config' });
  return s;
}
const mac = data => createHmac('sha256', secret()).update(data).digest('base64url');

export function creer(payload, now = Date.now() / 1000) {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(now) + DUREE })).toString('base64url');
  return body + '.' + mac(body);
}

export function lire(valeur, now = Date.now() / 1000) {
  const [body, sig] = String(valeur || '').split('.');
  if (!body || !sig) return null;
  const attendu = Buffer.from(mac(body)), recu = Buffer.from(sig);
  if (attendu.length !== recu.length || !timingSafeEqual(attendu, recu)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url'));
    return p.exp > now ? p : null;
  } catch { return null; }
}

export function depuisRequete(req) {
  const m = new RegExp('(?:^|; )' + COOKIE + '=([^;]+)').exec(req.headers.cookie || '');
  return m ? lire(m[1]) : null;
}

export function cookie(valeur, { secure = true, maxAge = DUREE } = {}) {
  return `${COOKIE}=${valeur}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}

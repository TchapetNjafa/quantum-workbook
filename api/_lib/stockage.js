// Stockage des fichiers (copies des étudiants, sujets PDF) dans Vercel Blob, en accès PRIVÉ : aucun lien public.
// Les tests injectent un stockage en mémoire avec setStockage().
import { put, get, del } from '@vercel/blob';

let impl = { put, get, del };
export const setStockage = s => { impl = s; };

export const TAILLE_MAX = 2 * 1024 * 1024; // 2 Mo, imposé par le serveur (le navigateur contrôle aussi)

/** Type réel du fichier d'après ses premiers octets (le type annoncé par le navigateur n'est pas fiable). */
export function typeReel(buf) {
  if (buf.length >= 5 && buf.subarray(0, 5).toString('latin1') === '%PDF-') return { mime: 'application/pdf', ext: 'pdf' };
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: 'image/png', ext: 'png' };
  return null;
}

export const deposer = (chemin, buffer, mime) => impl.put(chemin, buffer, { access: 'private', allowOverwrite: true, addRandomSuffix: false, contentType: mime });
export const lire = chemin => impl.get(chemin, { access: 'private' });   // { stream, blob } ou null
export const supprimer = chemin => impl.del(chemin);

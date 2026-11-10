// Médias d'une question de devoir : validation et normalisation (fonction pure).
// Tout est DONNÉE (aucun fichier externe, aucun script) : le navigateur fabrique le son et l'animation à partir de ces valeurs.
//   image      { src: data:image/(png|jpeg|svg+xml);base64,…  alt, legende? }          figure fixe
//   clics      { sequence: [0|1…], cadence?, legende? }       extrait audio : un clic grave (0) ou aigu (1) par événement
//   impacts    { positions: [-1…1], cadence?, legende? }      animation : impacts un à un sur un écran (fentes d'Young…)
//   compteurs  { categories: [2 à 4 noms], evenements: [indices], cadence?, legende? }   animation : compteurs qui montent
//   tableau    { colonnes: […], lignes: [[…]…], legende? }    données brutes
// Les séquences sont tirées à l'avance (graine fixe) par l'auteur du devoir : le paramètre caché n'est jamais envoyé à l'étudiant.
export const MEDIA_TYPES = ['image', 'clics', 'impacts', 'compteurs', 'tableau'];
const MAX_MEDIAS = 6, MAX_IMAGE = 120_000;

const court = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const entier = (v, a, b) => Number.isInteger(v) && v >= a && v <= b;
const arrondi = (x, d) => Math.round(x * 10 ** d) / 10 ** d;

function image(m, etiquette, erreurs) {
  const src = m.src;
  if (typeof src !== 'string' || src.length > MAX_IMAGE || !/^data:image\/(png|jpeg|svg\+xml);base64,[A-Za-z0-9+/]+={0,2}$/.test(src)) {
    erreurs.push(`${etiquette} (image) : src doit être une image intégrée data:image/png|jpeg|svg+xml;base64 de ${MAX_IMAGE / 1000} Ko au plus`);
    return null;
  }
  if (src.startsWith('data:image/svg+xml')) {
    const svg = Buffer.from(src.split(',')[1], 'base64').toString('utf8');
    if (/<script|javascript:|\son[a-z]+\s*=|<foreignObject|<iframe/i.test(svg)) { erreurs.push(`${etiquette} (image) : le SVG contient un élément interdit (script, gestionnaire d’événement…)`); return null; }
  }
  if (!court(m.alt, 300)) { erreurs.push(`${etiquette} (image) : texte alternatif (alt) manquant ou trop long`); return null; }
  return { type: 'image', src, alt: m.alt, ...(court(m.legende, 300) ? { legende: m.legende } : {}) };
}

function clics(m, etiquette, erreurs) {
  const s = m.sequence;
  if (!Array.isArray(s) || s.length < 1 || s.length > 600 || !s.every(x => x === 0 || x === 1)) { erreurs.push(`${etiquette} (clics) : sequence de 1 à 600 valeurs 0 ou 1 attendue`); return null; }
  const cadence = m.cadence === undefined ? 350 : m.cadence;
  if (!entier(cadence, 60, 2000)) { erreurs.push(`${etiquette} (clics) : cadence en ms entre 60 et 2000`); return null; }
  return { type: 'clics', sequence: [...s], cadence, ...(court(m.legende, 300) ? { legende: m.legende } : {}) };
}

function impacts(m, etiquette, erreurs) {
  const p = m.positions;
  if (!Array.isArray(p) || p.length < 1 || p.length > 2000 || !p.every(x => typeof x === 'number' && Number.isFinite(x) && x >= -1 && x <= 1)) { erreurs.push(`${etiquette} (impacts) : positions de 1 à 2000 nombres entre -1 et 1 attendues`); return null; }
  const cadence = m.cadence === undefined ? 40 : m.cadence;
  if (!entier(cadence, 5, 1000)) { erreurs.push(`${etiquette} (impacts) : cadence en ms entre 5 et 1000`); return null; }
  return { type: 'impacts', positions: p.map(x => arrondi(x, 4)), cadence, ...(court(m.legende, 300) ? { legende: m.legende } : {}) };
}

function compteurs(m, etiquette, erreurs) {
  const c = m.categories, e = m.evenements;
  if (!Array.isArray(c) || c.length < 2 || c.length > 4 || !c.every(x => court(x, 30))) { erreurs.push(`${etiquette} (compteurs) : 2 à 4 categories (textes courts) attendues`); return null; }
  if (!Array.isArray(e) || e.length < 1 || e.length > 600 || !e.every(x => entier(x, 0, c.length - 1))) { erreurs.push(`${etiquette} (compteurs) : evenements de 1 à 600 indices de categories attendus`); return null; }
  const cadence = m.cadence === undefined ? 200 : m.cadence;
  if (!entier(cadence, 20, 2000)) { erreurs.push(`${etiquette} (compteurs) : cadence en ms entre 20 et 2000`); return null; }
  return { type: 'compteurs', categories: [...c], evenements: [...e], cadence, ...(court(m.legende, 300) ? { legende: m.legende } : {}) };
}

function tableau(m, etiquette, erreurs) {
  const c = m.colonnes, l = m.lignes;
  const cellule = x => (typeof x === 'string' && x.length <= 40) || (typeof x === 'number' && Number.isFinite(x));
  if (!Array.isArray(c) || c.length < 1 || c.length > 8 || !c.every(x => court(x, 40))) { erreurs.push(`${etiquette} (tableau) : 1 à 8 colonnes (textes courts) attendues`); return null; }
  if (!Array.isArray(l) || l.length < 1 || l.length > 300 || !l.every(r => Array.isArray(r) && r.length === c.length && r.every(cellule))) { erreurs.push(`${etiquette} (tableau) : 1 à 300 lignes, chacune de ${c.length} cellules (texte ou nombre) attendues`); return null; }
  return { type: 'tableau', colonnes: [...c], lignes: l.map(r => [...r]), ...(court(m.legende, 300) ? { legende: m.legende } : {}) };
}

const VALIDEURS = { image, clics, impacts, compteurs, tableau };

/** Valide la liste `media` d'une question. Renvoie { medias } (copies normalisées) ; les problèmes sont ajoutés à `erreurs`. */
export function validerMedias(brut, nom, erreurs) {
  if (brut === undefined) return { medias: undefined };
  if (!Array.isArray(brut) || brut.length < 1 || brut.length > MAX_MEDIAS) { erreurs.push(`${nom} : 1 à ${MAX_MEDIAS} médias attendus`); return { medias: undefined }; }
  const medias = [];
  brut.forEach((m, i) => {
    const etiquette = `${nom} média ${i + 1}`;
    const f = m && typeof m === 'object' ? VALIDEURS[m.type] : null;
    if (!f) return erreurs.push(`${etiquette} : type inconnu (${MEDIA_TYPES.join(', ')})`);
    const ok = f(m, etiquette, erreurs);
    if (ok) medias.push(ok);
  });
  return { medias };
}

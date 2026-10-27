// Accès Postgres (Neon). Une seule fonction publique : q(texte, paramètres) -> lignes.
// Les tests injectent une base en mémoire avec setDb() ; l'horloge est injectable pour tester les délais.
import { neon } from '@neondatabase/serverless';

let db = null, pret = null, horloge = () => new Date();
export const setDb = d => { db = d; pret = null; };
export const setHorloge = f => { horloge = f; };
export const maintenant = () => horloge();

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS devoirs (
     id SERIAL PRIMARY KEY, titre TEXT NOT NULL, ouvre TIMESTAMPTZ NOT NULL, ferme TIMESTAMPTZ NOT NULL,
     publie BOOLEAN NOT NULL DEFAULT FALSE, resultat_visible BOOLEAN NOT NULL DEFAULT FALSE,
     questions JSONB NOT NULL, cree TIMESTAMPTZ NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS debuts (
     devoir_id INT NOT NULL REFERENCES devoirs(id) ON DELETE CASCADE, email TEXT NOT NULL,
     debut TIMESTAMPTZ NOT NULL, PRIMARY KEY (devoir_id, email))`,
  `CREATE TABLE IF NOT EXISTS remises (
     devoir_id INT NOT NULL REFERENCES devoirs(id) ON DELETE CASCADE, email TEXT NOT NULL, nom TEXT NOT NULL DEFAULT '',
     reponses JSONB NOT NULL, note NUMERIC NOT NULL, total NUMERIC NOT NULL, manuel BOOLEAN NOT NULL DEFAULT FALSE,
     details JSONB NOT NULL, declare TIMESTAMPTZ, recu TIMESTAMPTZ NOT NULL, retard BOOLEAN NOT NULL DEFAULT FALSE,
     PRIMARY KEY (devoir_id, email))`,
  `ALTER TABLE remises ADD COLUMN IF NOT EXISTS hors_ligne BOOLEAN NOT NULL DEFAULT FALSE`,
  `ALTER TABLE remises ADD COLUMN IF NOT EXISTS note_manuelle NUMERIC`,
  `ALTER TABLE remises ADD COLUMN IF NOT EXISTS notes_questions JSONB`, // points par question à correction manuelle : { q4: 2.5, … }
  `ALTER TABLE remises ADD COLUMN IF NOT EXISTS total_manuel NUMERIC NOT NULL DEFAULT 0`,
  // remises enregistrées avant l'existence de total_manuel : on le recalcule depuis les questions « interpretation » du devoir
  `UPDATE remises r SET total_manuel = COALESCE((SELECT SUM((q->>'points')::numeric) FROM devoirs d, jsonb_array_elements(d.questions) q
      WHERE d.id = r.devoir_id AND q->>'type' = 'interpretation'), 0) WHERE r.manuel AND r.total_manuel = 0`,
  `ALTER TABLE devoirs ADD COLUMN IF NOT EXISTS copie BOOLEAN NOT NULL DEFAULT FALSE`,
  `ALTER TABLE devoirs ADD COLUMN IF NOT EXISTS bareme NUMERIC`,  // devoir sans question : total des points de la note saisie à la main
  `ALTER TABLE devoirs ADD COLUMN IF NOT EXISTS sujet BOOLEAN NOT NULL DEFAULT FALSE`,
  `CREATE TABLE IF NOT EXISTS fichiers (
     devoir_id INT NOT NULL REFERENCES devoirs(id) ON DELETE CASCADE, email TEXT NOT NULL, chemin TEXT NOT NULL,
     type TEXT NOT NULL, taille INT NOT NULL, recu TIMESTAMPTZ NOT NULL, retard BOOLEAN NOT NULL DEFAULT FALSE,
     PRIMARY KEY (devoir_id, email))`,
  `CREATE TABLE IF NOT EXISTS prof_essais (id SERIAL PRIMARY KEY, at TIMESTAMPTZ NOT NULL, ok BOOLEAN NOT NULL)`,
  // ----- phase 5 : profil (matricule obligatoire), scores du quiz, classement, défis différés ; conservation de 5 mois (voir profil.js) -----
  `CREATE TABLE IF NOT EXISTS profils (
     email TEXT PRIMARY KEY, matricule TEXT NOT NULL UNIQUE, nom TEXT NOT NULL DEFAULT '',
     visible BOOLEAN NOT NULL DEFAULT TRUE, cree TIMESTAMPTZ NOT NULL, activite TIMESTAMPTZ NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS scores (
     id SERIAL PRIMARY KEY, email TEXT NOT NULL REFERENCES profils(email) ON DELETE CASCADE, chapitre INT, exam BOOLEAN NOT NULL DEFAULT FALSE,
     n INT NOT NULL, ok INT NOT NULL, duree INT NOT NULL, quand TIMESTAMPTZ NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS scores_email ON scores (email)`,
  `CREATE INDEX IF NOT EXISTS scores_quand ON scores (quand)`,
  `CREATE TABLE IF NOT EXISTS defis (
     code TEXT PRIMARY KEY, createur TEXT NOT NULL REFERENCES profils(email) ON DELETE CASCADE, chapitre INT, ids JSONB NOT NULL, cree TIMESTAMPTZ NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS defis_scores (
     code TEXT NOT NULL REFERENCES defis(code) ON DELETE CASCADE, email TEXT NOT NULL REFERENCES profils(email) ON DELETE CASCADE,
     ok INT NOT NULL, duree INT NOT NULL, quand TIMESTAMPTZ NOT NULL, PRIMARY KEY (code, email))`,
  // ----- phase 7 : liste de classe importée par l'enseignant (matricule ↔ nom ↔ adresse) ; purge des remises 5 mois après la fermeture du devoir -----
  `CREATE TABLE IF NOT EXISTS liste_classe (matricule TEXT PRIMARY KEY, nom TEXT NOT NULL DEFAULT '', email TEXT UNIQUE)`,
  `ALTER TABLE devoirs ADD COLUMN IF NOT EXISTS purge TIMESTAMPTZ` // date à laquelle remises, ouvertures et copies ont été supprimées
];

function connexion() {
  if (db) return db;
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw Object.assign(new Error('DATABASE_URL absent'), { code: 'config' });
  const sql = neon(url);
  db = { query: (texte, params) => sql.query(texte, params) };
  return db;
}

export async function q(texte, params = []) {
  const d = connexion();
  if (!pret) pret = (async () => { for (const s of SCHEMA) await d.query(s, []); })().catch(e => { pret = null; throw e; });
  await pret;
  return d.query(texte, params);
}

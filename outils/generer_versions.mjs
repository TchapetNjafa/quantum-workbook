// Génère, pour le site Vercel assemblé (dist/), les manifestes de versions utilisés par les service workers :
//   dist/versions.json        empreinte de chaque fichier du Carnet (hors dist/quiz/)
//   dist/quiz/versions.json   empreinte de chaque fichier du Quiz
// et remplace la ligne « const VERSION = '…' » de dist/sw.js et dist/quiz/service-worker.js par « <préfixe>-<empreinte du manifeste> » :
// tout changement de contenu change la version, et la nouvelle version ne télécharge que les fichiers modifiés.
// Usage : node outils/generer_versions.mjs dist     (appelé par outils/assembler_vercel.sh ; ne touche jamais aux sources du dépôt)
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const racine = path.resolve(process.argv[2] || 'dist');
const empreinte = buf => createHash('sha256').update(buf).digest('hex');

function fichiers(dossier, exclureDossiers = []) {
  const sortie = [];
  for (const nom of fs.readdirSync(dossier, { withFileTypes: true })) {
    const chemin = path.join(dossier, nom.name);
    if (nom.isDirectory()) { if (!exclureDossiers.includes(chemin)) sortie.push(...fichiers(chemin, exclureDossiers)); }
    else sortie.push(chemin);
  }
  return sortie;
}

function zone({ dossier, exclureDossiers = [], sw, prefixe }) {
  const exclus = new Set(['versions.json', sw].map(n => path.join(dossier, n)));
  const manifeste = {};
  for (const f of fichiers(dossier, exclureDossiers).sort()) {
    if (exclus.has(f)) continue;
    manifeste[path.relative(dossier, f).split(path.sep).join('/')] = empreinte(fs.readFileSync(f)).slice(0, 16);
  }
  const json = JSON.stringify(manifeste, null, 1);
  fs.writeFileSync(path.join(dossier, 'versions.json'), json + '\n');
  const version = `${prefixe}-${empreinte(json).slice(0, 10)}`;
  const chemin = path.join(dossier, sw);
  const source = fs.readFileSync(chemin, 'utf8');
  if (!/const VERSION = '[^']*'/.test(source)) throw new Error(`${sw} : ligne VERSION introuvable`);
  fs.writeFileSync(chemin, source.replace(/const VERSION = '[^']*'/, `const VERSION = '${version}'`));
  console.log(`${path.relative(process.cwd(), dossier) || '.'} : ${Object.keys(manifeste).length} fichiers, version ${version}`);
}

const quiz = path.join(racine, 'quiz');
zone({ dossier: racine, exclureDossiers: [quiz], sw: 'sw.js', prefixe: 'carnet' });
if (fs.existsSync(quiz)) zone({ dossier: quiz, sw: 'service-worker.js', prefixe: 'quiz' });

#!/bin/sh
# Assemble le site Vercel dans dist/ : le Carnet à la racine, le Quiz sous /quiz/.
# Les dépôts GitHub restent indépendants (GitHub Pages ne lance pas ce script).
#   QUIZ_DIR=../quantum-quiz sh outils/assembler_vercel.sh   # source locale (essais)
#   QUIZ_REF=main                                            # branche ou étiquette du quiz (défaut : main)
set -eu
cd "$(dirname "$0")/.."

OUT=dist
QUIZ_REPO=TchapetNjafa/quantum-quiz
rm -rf "$OUT"
mkdir -p "$OUT/quiz"

# Carnet : tout sauf les dossiers de travail.
tar --exclude=./.git --exclude=./.github --exclude=./dist --exclude=./outils --exclude=./docs --exclude=./api --exclude=./package.json --exclude=./package-lock.json --exclude=./node_modules -cf - . | tar -xf - -C "$OUT"

# Quiz : source locale ou archive GitHub.
if [ -n "${QUIZ_DIR:-}" ]; then
  tar --exclude=.git --exclude=.github --exclude=scripts --exclude=outils -C "$QUIZ_DIR" -cf - . | tar -xf - -C "$OUT/quiz"
else
  # Téléchargement vérifié, avec nouvelles tentatives : une coupure réseau passagère (archive tronquée) ne doit pas faire échouer le déploiement.
  ARCHIVE="$(mktemp)"; trap 'rm -f "$ARCHIVE"' EXIT; ok=""
  for essai in 1 2 3 4 5; do
    if curl -fsSL --connect-timeout 15 --max-time 120 -o "$ARCHIVE" "https://codeload.github.com/$QUIZ_REPO/tar.gz/refs/heads/${QUIZ_REF:-main}" && tar -tzf "$ARCHIVE" >/dev/null 2>&1; then ok=1; break; fi
    echo "Téléchargement du quiz : essai $essai échoué, nouvelle tentative…" >&2; sleep $((essai * 3))
  done
  [ -n "$ok" ] || { echo "Quiz : téléchargement impossible après 5 essais" >&2; exit 1; }
  tar -xzf "$ARCHIVE" -C "$OUT/quiz" --strip-components=1 --exclude='*/.git*' --exclude='*/scripts' --exclude='*/outils'
fi
[ -f "$OUT/quiz/data/questions.json" ] || { echo "Quiz absent ou incomplet" >&2; exit 1; }

# Liens absolus GitHub Pages -> liens du même site (le quiz et le Carnet se voient sur le même domaine).
find "$OUT" -type f \( -name '*.html' -o -name '*.js' -o -name '*.json' \) ! -name 'questions*.json' -print0 |
  xargs -0 sed -i \
    -e 's#https://tchapetnjafa\.github\.io/quantum-quiz/#/quiz/#g' \
    -e 's#https://tchapetnjafa\.github\.io/quantum-workbook/#/#g'

# Pages 404 : chemins propres à GitHub Pages (/quantum-workbook/, /quantum-quiz/) -> chemins du site Vercel.
sed -i 's#/quantum-workbook/#/#g' "$OUT/404.html"
sed -i 's#/quantum-quiz/#/quiz/#g' "$OUT/quiz/404.html"

# Mise à jour hors connexion par différence : empreinte de chaque fichier (versions.json) et version des service workers dérivée du contenu.
node outils/generer_versions.mjs "$OUT"

echo "dist/ prêt : $(find "$OUT" -type f | wc -l) fichiers"

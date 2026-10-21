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
tar --exclude=./.git --exclude=./.github --exclude=./dist --exclude=./outils --exclude=./docs -cf - . | tar -xf - -C "$OUT"

# Quiz : source locale ou archive GitHub.
if [ -n "${QUIZ_DIR:-}" ]; then
  tar --exclude=.git --exclude=.github --exclude=scripts --exclude=outils -C "$QUIZ_DIR" -cf - . | tar -xf - -C "$OUT/quiz"
else
  curl -fsSL "https://codeload.github.com/$QUIZ_REPO/tar.gz/refs/heads/${QUIZ_REF:-main}" \
    | tar -xz -C "$OUT/quiz" --strip-components=1 --exclude='*/.git*' --exclude='*/scripts' --exclude='*/outils'
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

echo "dist/ prêt : $(find "$OUT" -type f | wc -l) fichiers"

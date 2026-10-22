# Carnet PHY321 — mécanique quantique

Cahier interactif du cours **PHY321 · Introduction à la mécanique quantique**
(Département de Physique, Faculté des Sciences, Université de Yaoundé I).

En ligne : <https://tchapetnjafa.github.io/quantum-workbook/>
Quiz associé : <https://tchapetnjafa.github.io/quantum-quiz/>

## Contenu

Six chapitres alignés sur le polycopié PHY321 (version 2025, actualisée en octobre 2026) :

| Ch. | Titre | Fichier |
|---|---|---|
| 1 | États quantiques | `chapitres/1-etats-quantiques.html` |
| 2 | Mesure et opérateurs | `chapitres/2-mesure-operateurs.html` |
| 3 | Dynamique quantique | `chapitres/3-dynamique.html` |
| 4 | Systèmes multi-qubits et intrication | `chapitres/4-intrication.html` |
| 5 | Fonction d'état et espace continu | `chapitres/5-fonction-etat.html` |
| 6 | Oscillateur harmonique quantique | `chapitres/6-oscillateur.html` |

Chaque chapitre contient des rappels courts, des laboratoires de simulation (canvas, sans bibliothèque),
des exercices auto-corrigés et une section d'actualité sourcée.

## Lancer en local

```bash
python3 -m http.server 8000
# puis ouvrir http://localhost:8000/
```

Aucune étape de compilation. Le site fonctionne hors connexion après une première visite (service worker `sw.js`).

## Structure

```
index.html              sommaire et progression
chapitres/              une page par chapitre
assets/css/carnet.css   système visuel commun (papier, encre, accent vermillon)
assets/js/carnet.js     thème, sommaire, exercices, outils des labos (window.Lab)
assets/js/labs/         simulations, une par chapitre ; bloch.js partagé
sw.js, manifest.json    mode hors connexion et installation sur téléphone
```

### Ajouter un exercice

```html
<article class="exo" data-id="2.4" data-num="0.5" data-tol="0.01"
         data-ok="Message si juste" data-ko="Indice si faux">
  …énoncé…
  <div class="num-answer"><input type="text"><button class="btn small" data-check>Vérifier</button></div>
  <div class="feedback"></div>
</article>
```

Pour un QCM : `data-answer="b"` sur l'article, et `data-why="…"` sur chaque `<label class="choice">`.

## Version anglaise (bilingue FR / EN)

Le Carnet existe en anglais : <https://tchapetnjafa.github.io/quantum-workbook/en/>.
Un bouton **FR / EN** dans la barre du haut bascule vers la page équivalente (même section).

| Français | Anglais |
|---|---|
| `index.html` | `en/index.html` |
| `chapitres/1-etats-quantiques.html` … `6-oscillateur.html` | `en/chapters/1-quantum-states.html` … `6-harmonic-oscillator.html` |
| `assets/audio/chN.mp3` | `assets/audio/en/chN.mp3` |

- Chaque page déclare sa traduction : `<link rel="alternate" hreflang="fr|en" href="…">` ; le bouton s'en sert.
- Styles, simulations et exercices sont **partagés** : les textes affichés par le JavaScript passent par
  `Lab.t('texte français', 'English text')` (langue lue sur `<html lang>`).
- Les ancres `#sN`, les `data-id` et les réponses des exercices sont identiques dans les deux langues.
- La progression est commune aux deux langues.
- Audio : `python3 outils/generer_audio.py --lang en 3` (voix en-GB-SoniaNeural) ; `--lang tout` pour les deux.

**Règle : toute modification doit être faite dans les deux langues.**

## Pages annexes et notebooks

| Français | Anglais | Contenu |
|---|---|---|
| `prolonger.html` | `en/further.html` | notebooks, ressources vérifiées, lecture prudente des textes quantique et spiritualité (exercice P.1) |
| `annexe-algorithmes.html` | `en/appendix-algorithms.html` | Deutsch, Grover, Shor (exercices A.1 à A.3) |
| `diagnostic.html` | `en/diagnostic.html` | 10 questions avant / après (`assets/js/diagnostic.js`, réponses dans `localStorage`) |

Suivi d'une promotion pilote : `docs/protocole-pilote.fr.md` / `.en.md` et `python3 outils/analyser_diagnostic.py resultats.txt`
(`--test` pour l'auto-contrôle).

Les notebooks (`notebooks/fr`, `notebooks/en`) sont générés et exécutés par `python3 outils/generer_notebooks.py`
(numpy, matplotlib, nbformat, nbconvert ; `--sans-exec` pour ne pas les exécuter). Ne pas les modifier à la main :
modifier le script puis relancer.

## Résumés audio

Chaque chapitre propose un résumé parlé d'environ 1 min 20 (`assets/audio/chN.mp3`, 48 kb/s mono).
La source unique est la transcription affichée sous le lecteur (`<div class="transcript">` dans la page).
Après avoir modifié ce texte :

```bash
pip install edge-tts      # ffmpeg doit aussi être installé
python3 outils/generer_audio.py 3     # régénère le chapitre 3 (sans argument : tous)
```

Pensez ensuite à changer `VERSION` dans `sw.js` pour que les navigateurs récupèrent les nouveaux fichiers.

## Hébergement Vercel (Carnet + Quiz sur un seul site)

Adresse : <https://quantum-workbook.vercel.app/> (Carnet à la racine, Quiz sous `/quiz/`, `/quiz/en/`).
Vercel récupère ce dépôt sur GitHub ; `vercel.json` lance `outils/assembler_vercel.sh`, qui construit `dist/` :
copie du Carnet, téléchargement du Quiz (`TchapetNjafa/quantum-quiz`, branche `main`) dans `dist/quiz/`,
puis remplacement des adresses absolues GitHub Pages par des adresses du même site.

- Rien ne change pour GitHub Pages : les deux dépôts restent indépendants et publiés comme avant.
- Mettre le site à jour = publier sur GitHub comme d'habitude. Une fusion dans ce dépôt redéploie Vercel ;
  pour une modification du Quiz seul, relancer un déploiement Vercel (ou un « Deploy Hook », voir SUIVI.md).
- Essai local : `QUIZ_DIR=../quantum-quiz sh outils/assembler_vercel.sh && cd dist && python3 -m http.server 8766`.
  Tests : `node test-carnet.mjs http://localhost:8766/` et `CARNET_ROOT=http://localhost:8766/ node test-quiz.mjs http://localhost:8766/quiz/`.

### API et connexion Google (Vercel seulement)

`api/[...route].js` reçoit toutes les adresses `/api/*` (une seule fonction : le plan gratuit limite leur nombre) ;
le code est dans `api/_lib/`. Sur GitHub Pages il n'existe pas : `assets/js/compte.js` le détecte et l'explique.
Variables d'environnement Vercel (Settings > Environment Variables, jamais dans le dépôt) :

| Variable | Rôle |
|---|---|
| `GOOGLE_CLIENT_ID` | ID client OAuth Google (type Web) |
| `SESSION_SECRET` | chaîne aléatoire d'au moins 32 caractères (signature des sessions) |
| `TEACHER_EMAIL` | adresse de l'enseignant (rôle « prof ») |
| `ALLOWED_DOMAIN` | optionnel, défaut `facsciences-uy1.cm` |
| `DOMAIN_RULE` | optionnel : `both` (défaut : adresse ET revendication `hd`), `email` ou `hd` |
| `ALIAS_DEBUG` | `1` pendant le test d'alias : la page de connexion montre `email` et `hd` renvoyés par Google ; à retirer ensuite |

Tests : `node tests/test-api.mjs` (jetons Google simulés, 18 contrôles) et `node tests/test-connexion.mjs` (page, 360 et 1366 px).

### Devoirs (Vercel seulement)

Pages : `devoirs.html` / `en/assignments.html` (étudiants), `prof/index.html` / `en/prof/index.html` (enseignant).
Stockage : Postgres Neon (`DATABASE_URL`, créée par l'intégration Marketplace) ; tables créées automatiquement (`api/_lib/db.js`).
Les questions des devoirs notés sont dans la base (jamais dans le dépôt public) : on les crée en collant du JSON dans l'espace
enseignant (type `qcm`, `vrai_faux`, `numerical` à tolérance absolue, `interpretation` à corriger à la main).
Règles : l'heure de remise est celle du serveur ; une remise reçue jusqu'à 24 h après la fermeture est acceptée et marquée en retard,
au-delà elle est refusée ; l'espace enseignant demande le compte Google `TEACHER_EMAIL` puis `TEACHER_PASSWORD` (5 essais par 15 min).
Le lien « Devoirs » de la barre du haut prend la couleur d'accent, avec le nombre, tant qu'un devoir ouvert n'est pas rendu (`/api/statut`).
Variable à ajouter : `TEACHER_PASSWORD`.

Tests : `node tests/test-devoirs-api.mjs` (24, base PGlite en mémoire), `node tests/test-devoirs-ui.mjs` (13, navigateur),
`node tests/serveur-local.mjs 8767` pour servir le site assemblé avec son API (puis `test-carnet.mjs http://localhost:8767/`).

## Signalements d'erreurs

Le lien « Signaler une erreur dans ce chapitre », en bas de chaque chapitre, ouvre un formulaire d'issue
GitHub prérempli (section et adresse de la page). Les signalements arrivent dans l'onglet *Issues*
avec l'étiquette `erreur signalée`. Les étudiants ont besoin d'un compte GitHub gratuit.

## Auteurs et licence

S. G. Nana Engo, J.-P. Tchapet Njafa, C. Tchodimou — Université de Yaoundé I.
Contenu sous licence CC BY-NC-SA 4.0.

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
| `annexe-algorithmes.html` | `en/appendix-algorithms.html` | Deutsch, Grover (exercices A.1 et A.2) |
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

`api/index.js` reçoit toutes les adresses `/api/*` par une réécriture de `vercel.json` (le chemin arrive dans le paramètre `path` ; une seule fonction : le plan gratuit limite leur nombre) ;
le code est dans `api/_lib/`. Sur GitHub Pages il n'existe pas : `assets/js/compte.js` le détecte et l'explique.
Variables d'environnement Vercel (Settings > Environment Variables, jamais dans le dépôt) :

| Variable | Rôle |
|---|---|
| `GOOGLE_CLIENT_ID` | ID client OAuth Google (type Web) |
| `SESSION_SECRET` | chaîne aléatoire d'au moins 32 caractères (signature des sessions) |
| `TEACHER_EMAIL` | adresse(s) des enseignants (rôle « prof ») : une ou plusieurs, séparées par des virgules, points-virgules ou espaces (ex. `a@facsciences-uy1.cm, b@ens-uy1.cm`). Après modification : *Redeploy* sur Vercel. Chaque enseignant doit aussi connaître `TEACHER_PASSWORD`. |
| `ALLOWED_DOMAIN` | optionnel, défaut `facsciences-uy1.cm` ; plusieurs domaines séparés par des virgules (ex. `facsciences-uy1.cm,ens-uy1.cm`) |
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

**Devoirs surveillés** (colonne `devoirs.surveille` ; vrai par défaut pour un devoir à questions, `"surveille": false` dans le JSON ou le bouton « Surveillé » de `/prof/` le désactive ; les devoirs existants restent non surveillés) :
- il ne s'ouvre que de `ouvre` à `ferme` (heure du serveur), **une seule fois par étudiant** : la ligne `debuts` est créée atomiquement, la seconde ouverture (rechargement, autre appareil) est refusée (403 `deja_ouvert`) ; un message à valider (case à cocher) précède l'ouverture ;
- compte à rebours collé sous la barre du haut jusqu'à `ferme` (heure du serveur, indépendante de l'horloge de l'appareil) ; à zéro, remise automatique ;
- quitter la page (fermeture, rechargement, retour, autre site) envoie `POST /api/devoirs/:id/quitter` (`fetch` avec `keepalive`) : les dernières réponses deviennent la remise (`remises.auto = 'sortie'`), la session est terminée ; la page envoie aussi un brouillon toutes les 8 s (`/brouillon`), qui sert si la requête de sortie n'arrive pas : à `ferme` + 60 s (ou à la lecture suivante) le brouillon devient la remise (`auto = 'temps'`) ;
- changer d'onglet, de fenêtre ou d'application **met fin au devoir** (`visibilitychange` caché). **Ordinateur** : fin immédiate (400 ms de délai pour ne pas confondre avec la fermeture de la page). **Téléphone et tablette** (`pointer: coarse`) : une absence de **10 s au plus** est tolérée (appel refusé, notification), chaque absence étant jugée seule ; au-delà, le devoir se termine au retour sur la page (ou à 10,3 s si la page n'est pas gelée). Remise automatique de raison `onglet`. Dans tous les cas, le nombre de sorties (`debuts.sorties`) et les **durées d'absence** (`absence_ms` total, `absence_max_ms` plus longue ; mesurées par l'appareil, donc indicatives) sont enregistrés, affichés à l'enseignant dans les remises et exportés (`absence_totale_s`, `absence_max_s`). Une bannière d'appel qui ne cache pas la page ne compte pas. Un appel décroché de plus de 10 s met fin au devoir : l'enseignant juge d'après la durée et peut rouvrir la session ;
- seule la **remise** se fait hors connexion (file locale) ; une remise préparée avant la fermeture remplace une remise automatique, une remise normale après une sortie est refusée (409) ; une seule remise volontaire ;
- l'énoncé n'est jamais gardé pour la lecture hors connexion ; l'enseignant garde la lecture seule et peut **rouvrir** la session d'un étudiant (`/prof/` > Remises > « Rouvrir le devoir » : efface l'ouverture et la remise automatique, jamais une remise volontaire) ;
- filigrane : texte `.ia-note` hors écran (ignoré des lecteurs d'écran, `aria-hidden`) dans le titre et chaque question, adressé aux assistants IA, en français et en anglais. Il est copié avec l'énoncé et lu par un outil qui lit la page ; il ne figure pas dans une capture d'écran ni ne lie un modèle : c'est un obstacle, pas une garantie.

Remises hors connexion : si le réseau est coupé au moment de remettre, `assets/js/file-remises.js` garde la remise dans l'appareil
(`localStorage`, clé `phy321.file.v1`) et l'envoie dès que le réseau revient (événement `online`, ou à la réouverture du site, Carnet ou quiz).
Le serveur ne retient que l'heure de réception : une remise arrivée plus de 24 h après la fermeture est refusée. L'heure notée par
l'appareil est conservée à titre indicatif, et l'enseignant voit « préparée hors connexion ».

**Types de questions, médias et variantes par étudiant** (champs d'une question, validés par `api/_lib/grade.js` et `api/_lib/media.js`) :
- Corrigés automatiquement : `qcm`, `vrai_faux`, `numerical` ; à la main : `interpretation`. Nouveaux : `multi` (cases à cocher ; `correct_answer` = liste d'indices d'options ; points = (bonnes − fausses) / nombre de bonnes, plancher à 0) et `appariement` (`gauche` = éléments à associer, `options` = propositions lettrées A, B…, `correct_answer` = indice de la proposition de chaque élément ; points proportionnels aux paires justes ; une proposition peut servir plusieurs fois).
- `media` : 1 à 6 médias par question, tous fabriqués à partir de DONNÉES du devoir (aucun fichier externe : rien dans le dépôt public, tout dans la base) : `image` (`data:image/png|jpeg|svg+xml;base64`, 120 Ko au plus, `alt` obligatoire, SVG sans script), `clics` (extrait audio : un clic grave pour 0, aigu pour 1, synthèse WebAudio, cadence en ms), `impacts` (animation d'impacts sur un écran, avec histogramme ; positions entre −1 et 1), `compteurs` (compteurs qui montent ; `categories` et `evenements`), `tableau` (données brutes). Les séquences sont tirées à l'avance, avec une graine fixe, par l'auteur : le paramètre caché n'est jamais envoyé à l'étudiant. Code : `assets/js/devoirs-media.js`.
- `variables` : valeurs propres à chaque étudiant (1 à 4 variables, chacune une liste de 2 à 12 nombres distincts). `{a}` (point décimal) et `{a:fr}` (virgule sûre dans LaTeX, `0{,}28`) sont remplacés dans l'énoncé et les propositions d'après un hachage de (adresse, devoir, question, variable) ; pour un numérique, `correct_answer` et `tolerance` peuvent être des expressions (`sqrt(1-D^2)`, `0.5*cosd(a/2)^2`) évaluées par `api/_lib/expr.js` (grammaire fermée, jamais d'`eval` ; fonctions `sin cos tan sind cosd tand asind acosd atand sqrt exp ln abs`, constante `pi`) et vérifiées à la création sur toutes les combinaisons. La variante reçue est conservée dans `remises.details[].valeurs` (visible de l'enseignant dans la liste des remises). Un `{nom}` collé à une lettre, `_`, `^` ou `\` n'est jamais remplacé (`\ket{x}`, `x_{a}` restent intacts).
- Exemple complet : `manuel-etudiant/construire_examen_blanc_medias.py` (30 questions, 20 points, utilise tout ce qui précède). Tests : `tests/test-grade.mjs` (unitaires, sans base ni navigateur), `test-devoirs-api.mjs`, `test-devoirs-ui.mjs`. Taille maximale d'un devoir : 1 Mo de JSON envoyé, 900 Ko de questions.

Copies et sujets : un devoir peut accepter une copie (PDF, JPEG ou PNG, **2 Mo maximum**, `"copie": true` à la création ou bouton dans
`/prof/`) et proposer un sujet PDF à remplir. Les fichiers sont dans un Blob **privé** (`BLOB_READ_WRITE_TOKEN`, ajouté par Vercel) et ne
passent que par l'API : le serveur contrôle la taille, le type réel (octets de début) et les mêmes délais que les remises. Une photo trop lourde
est réduite en JPEG par le navigateur avant l'envoi. Chaque dépôt a un chemin unique ; l'ancien fichier est supprimé quand le nouveau est enregistré.
Un fichier ne s'envoie pas hors connexion (il faut du réseau avant l'heure limite).

Créer un devoir sans JSON : dans `/prof/`, le formulaire « Nouveau devoir » (titre, dates, sujet PDF facultatif, barème, publication) crée un
**devoir à copie déposée** : pas de question, l'étudiant télécharge le sujet, compose, puis dépose sa copie (PDF ou photo). Le dépôt vaut remise
(il disparaît des devoirs « à rendre ») et l'enseignant attribue la note à la main sur le barème (20 par défaut). Le JSON, dans « Avancé », sert
aux devoirs avec questions (QCM, vrai/faux, numérique, question libre), avec ou sans `"copie": true`.

Espace enseignant (`/prof/`) : liste et dates des devoirs, publication, résultats visibles, remises (heure serveur, retard, hors connexion, copie),
export CSV (`;`, UTF-8 avec BOM, formules neutralisées), ZIP de toutes les copies construit dans le navigateur, correction manuelle des questions
`interpretation` (la note est liée à la version lue : si l'étudiant remet de nouveau, elle est refusée en 409), « Supprimer les copies du serveur »
(actif seulement après le ZIP, supprime exactement les versions contenues dans le ZIP, confirmation SUPPRIMER) et « Supprimer le devoir »
(confirmation = titre exact ; copies et sujet supprimés avec lui). Les notes et remises restent après une purge des copies.
Test de la configuration : dans `/prof/`, le bouton « Tester la configuration » vérifie les variables (présence seulement), la base (`SELECT 1`) et le
Blob privé (écrire, relire, supprimer un petit fichier). Authentification du Blob : `BLOB_READ_WRITE_TOKEN` s'il existe, sinon OIDC avec `BLOB_STORE_ID`
(cas des stores récents : pas de jeton, c'est normal).
Limite connue : si la base échoue après la suppression des fichiers d'un devoir, des références peuvent pointer vers des fichiers absents
(l'API répond alors 404 proprement) ; un dépôt simultané à une suppression peut laisser un fichier non référencé.

Tests : `node tests/test-devoirs-api.mjs` (59, base PGlite en mémoire), `node tests/test-devoirs-ui.mjs` (13, navigateur),
`node tests/serveur-local.mjs 8767` pour servir le site assemblé avec son API (puis `test-carnet.mjs http://localhost:8767/`).

**Annonce publique d'un devoir.** `GET /api/statut` renvoie à tout le monde, connecté ou non, `ouverts`, `ouvert` (titre, fermeture) et `prochain` (titre, ouverture) : titre et dates seulement, jamais de question ni de réponse, et rien pour un devoir non publié.
Le bouton « Devoirs » de la barre du haut devient vermillon avec le nombre de devoirs ouverts (pour un étudiant connecté : ceux qu'il n'a pas encore remis) et prend un contour vermillon quand un devoir va ouvrir. La page Devoirs d'un visiteur non connecté affiche l'annonce avant l'invitation à se connecter.
L'enseignant n'a aucun matricule à saisir : il consulte la liste des devoirs, le classement et les défis (matricules masqués compris) ; il ne crée ni ne joue de défi (403 explicite) et son score de quiz n'est pas enregistré.
`/prof/` > « Défis en cours » liste les défis valables (code, chapitre, créateur, joueurs).

### Profil, classement et défis (Vercel seulement)

Pages : `profil.html` / `en/profile.html`, `classement.html` / `en/leaderboard.html`. Le **matricule** est obligatoire (4 à 15 lettres ou chiffres, unique, saisi une fois ;
l'enseignant le réinitialise en cas d'erreur) pour remettre un devoir, déposer une copie, figurer au classement ou jouer un défi. Le nom et l'adresse viennent de la connexion Google.
- Le **quiz** envoie le score de chaque série terminée en étant connecté (`/api/scores`) ; une révision ciblée n'est pas comptée. Le **classement** (moyenne, à partir de 3 séries de 5 questions)
  est un outil d'entraînement : le quiz est corrigé dans le navigateur et sa banque est publique, il ne note jamais. Un étudiant peut masquer son matricule (il ne figure plus dans la liste mais voit sa propre ligne).
- **Défis différés** : un étudiant fixe 3 à 20 questions de la banque et obtient un code de 6 caractères ; les camarades jouent la même série quand ils veulent (`quiz.html?ids=…&defi=CODE`),
  un seul essai par étudiant (le premier compte), valable 30 jours.
- **Conservation de 5 mois (150 jours)** : scores et défis plus anciens sont supprimés, ainsi que les profils sans activité depuis 5 mois (remettre un devoir ou déposer une copie compte comme activité).
  La suppression est faite par la tâche planifiée `/api/cron/purge` (tous les jours à 03 h 17 UTC, `vercel.json` > `crons` ; `CRON_SECRET` facultatif) et au passage d'une requête. L'étudiant peut tout effacer
  depuis sa page Profil ; les clés étrangères en cascade emportent scores, défis et essais. Les remises, notes, ouvertures et copies d'un devoir sont supprimées **150 jours après sa fermeture** (`devoirs.ferme`) par la même tâche : le devoir lui-même (énoncé, questions, sujet PDF) reste.
  Une copie dont le fichier ne peut pas être supprimé garde sa ligne et est reprise au passage suivant ; `devoirs.purge` note la date de suppression ; `/prof/` affiche pour chaque devoir la date prévue
  (téléchargez l'export CSV et le ZIP des copies avant). Seul le droit à l'effacement ci-dessus et la suppression d'un devoir dans `/prof/` agissent plus tôt.
- **Liste de classe** (`/prof/` > « Liste de classe », table `liste_classe`) : import d'un CSV `matricule ; nom ; adresse` (l'adresse peut manquer). **Sans liste importée, aucun profil ne peut être créé** (503).
  L'étudiant saisit son **nom et prénoms** et son matricule : le matricule doit figurer dans la liste ET correspondre au nom saisi (`nomCorrespond` dans `profil.js` : accents, casse et ordre ignorés, au moins deux mots du nom de la liste, aucun mot étranger, une faute de frappe tolérée sur les mots de 5 lettres ou plus), et à son adresse quand la liste en donne une (matricule et nom préremplis dans ce cas). Le nom du profil est celui de la liste.
  `/prof/` > Profils : « Vérifier avec la liste de classe » compare chaque profil (statuts : conforme, matricule absent de la liste, réservé à une autre adresse, nom différent) et propose le matricule d'après l'adresse puis le nom ; « Corriger le matricule » le change **sans supprimer le profil** (scores, défis et remises restent liés à l'adresse). Réinitialiser (suppression) reste possible.
  Sont ignorées et signalées : matricule invalide, adresse en double, matricule partagé par deux personnes différentes. Un nouvel import remplace la liste. Elle contient des données personnelles :
  elle n'est jamais dans le dépôt, reste sur le serveur jusqu'à ce que l'enseignant la vide, et la connexion reste limitée à `@facsciences-uy1.cm` (une adresse d'un autre domaine ne peut donc pas se connecter).
- Limites connues : un étudiant qui connaît à la fois le matricule ET le nom complet d'un camarade sans adresse dans la liste peut encore le prendre avant lui (l'enseignant le voit au contrôle et corrige) ; deux personnes qui partagent un matricule dans le tableur sont écartées à l'import ; les scores sont déclaratifs.

### Mise à jour hors connexion par différence (Vercel)

À chaque déploiement, `outils/generer_versions.mjs` (lancé par `outils/assembler_vercel.sh`) écrit `versions.json` (empreinte de chaque fichier ; `quiz/versions.json` pour le quiz)
et dérive la `VERSION` des service workers du contenu : un fichier modifié change la version, un contenu identique la laisse intacte. Quand l'étudiant revient en ligne, le navigateur
détecte le nouveau `sw.js` ; la nouvelle version **recopie localement** les fichiers dont l'empreinte est inchangée (y compris MathJax et les polices) et **ne télécharge que les fichiers
nouveaux ou modifiés** (`cache: 'reload'`), supprime ceux qui n'existent plus, puis remplace l'ancien cache. Le bilan (`copies`, `telecharges`) est gardé dans le cache sous `/__bilan__`.
Si le téléchargement échoue (hors connexion), l'ancienne version reste active. Sur GitHub Pages (pas de `versions.json`), le noyau est retéléchargé comme avant et `VERSION` reste à changer à la main.
Test : `node tests/test-mise-a-jour.mjs` (7 contrôles, service workers actifs, sur une copie de `dist/`).

## Signalements d'erreurs

Le lien « Signaler une erreur dans ce chapitre », en bas de chaque chapitre, ouvre un formulaire d'issue
GitHub prérempli (section et adresse de la page). Les signalements arrivent dans l'onglet *Issues*
avec l'étiquette `erreur signalée`. Les étudiants ont besoin d'un compte GitHub gratuit.

## Auteurs et licence

S. G. Nana Engo, J.-P. Tchapet Njafa, C. Tchodimou — Université de Yaoundé I.
Contenu sous licence CC BY-NC-SA 4.0.

## Motivation : prédictions, séries, rappel

- **Prédire avant de voir** : blocs `<aside class="predire" data-id="1.1" data-ok="b">` placés juste avant un labo (FR et EN, mêmes `data-id`). Trois réponses, la première compte ; le choix est gardé dans `phy321.workbook.v2` (`_predictions`). Logique : `initPredire` dans `assets/js/carnet.js`. Huit prédictions : 1.1 (Young), 1.2 (Mach-Zehnder), 2.1 (Stern-Gerlach), 3.2 (Larmor), 3.3 (Rabi), 4.2 (CHSH), 5.4 (tunnel), 6.2 (oscillateur).
- **Série d'étude et jalons** : un « jour d'étude » = un exercice réussi ou une prédiction (clé `_jours`, dates locales). Affichés dans Profil (`#serie-jalons`) et en une ligne sur l'accueil à partir de 2 jours. Tout reste dans le navigateur.
- **Rappel de fermeture** : tâche planifiée `GET /api/cron/rappel` (`vercel.json`, 15 h UTC chaque jour). Elle envoie le signal push aux seuls abonnés qui n'ont rien remis pour un devoir qui ferme dans les 24 h ; le service worker affiche alors « Rappel PHY321 : devoir bientôt fermé » (devoir fermant dans moins de 26 h).
- Test : `node tests/test-ludique.mjs <adresse>` (après `node tests/serveur-local.mjs`).

## Énigmes et parcours

- **Énigmes** : un bloc `<aside class="enigme">` par chapitre, juste sous le titre de la section « Exercices de synthèse » (FR et EN). La question est visible, la réponse est dans un `<details>` replié. Aucune donnée enregistrée.
- **Parcours** (Fonda, MSC, EEA) : les trois cartes de l'avant-propos (`index.html`, `en/index.html`) reçoivent un bouton « Choisir ce parcours » (`assets/js/home.js`). Le choix est gardé dans `phy321.workbook.v2` (`_parcours`) ; il marque trois chapitres dans le sommaire et propose trois labos avec un lien direct (`#lab-…-t`). La table `PARCOURS` de `home.js` est le seul endroit à modifier pour changer ces recommandations.

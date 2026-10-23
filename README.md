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

Remises hors connexion : si le réseau est coupé au moment de remettre, `assets/js/file-remises.js` garde la remise dans l'appareil
(`localStorage`, clé `phy321.file.v1`) et l'envoie dès que le réseau revient (événement `online`, ou à la réouverture du site, Carnet ou quiz).
Le serveur ne retient que l'heure de réception : une remise arrivée plus de 24 h après la fermeture est refusée. L'heure notée par
l'appareil est conservée à titre indicatif, et l'enseignant voit « préparée hors connexion ».

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
- **Liste de classe** (`/prof/` > « Liste de classe », table `liste_classe`) : import d'un CSV `matricule ; nom ; adresse` (l'adresse peut manquer). Tant que la liste est vide, le matricule est libre (comportement précédent) ;
  une fois importée, l'étudiant dont l'adresse figure dans la liste reçoit son matricule (prérempli, tout autre est refusé) ; sinon il ne peut saisir qu'un matricule de la liste sans adresse et encore libre.
  Sont ignorées et signalées : matricule invalide, adresse en double, matricule partagé par deux personnes différentes. Un nouvel import remplace la liste. Elle contient des données personnelles :
  elle n'est jamais dans le dépôt, reste sur le serveur jusqu'à ce que l'enseignant la vide, et la connexion reste limitée à `@facsciences-uy1.cm` (une adresse d'un autre domaine ne peut donc pas se connecter).
- Limites connues : un étudiant peut saisir le matricule d'un camarade avant lui (l'enseignant voit matricule, nom et adresse côte à côte et réinitialise) ; les scores sont déclaratifs.

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

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

## Résumés audio

Chaque chapitre propose un résumé parlé d'environ 1 min 20 (`assets/audio/chN.mp3`, 48 kb/s mono).
La source unique est la transcription affichée sous le lecteur (`<div class="transcript">` dans la page).
Après avoir modifié ce texte :

```bash
pip install edge-tts      # ffmpeg doit aussi être installé
python3 outils/generer_audio.py 3     # régénère le chapitre 3 (sans argument : tous)
```

Pensez ensuite à changer `VERSION` dans `sw.js` pour que les navigateurs récupèrent les nouveaux fichiers.

## Signalements d'erreurs

Le lien « Signaler une erreur dans ce chapitre », en bas de chaque chapitre, ouvre un formulaire d'issue
GitHub prérempli (section et adresse de la page). Les signalements arrivent dans l'onglet *Issues*
avec l'étiquette `erreur signalée`. Les étudiants ont besoin d'un compte GitHub gratuit.

## Auteurs et licence

S. G. Nana Engo, J.-P. Tchapet Njafa, C. Tchodimou — Université de Yaoundé I.
Contenu sous licence CC BY-NC-SA 4.0.

# Protocole de la promotion pilote — diagnostic avant / après (C4)

Objectif : savoir, avec une mesure simple, si l'usage du Carnet s'accompagne d'une meilleure compréhension des notions
sur lesquelles les étudiants se trompent le plus souvent (mesure, indétermination contre ignorance, superposition contre
mélange, intrication contre corrélation, décohérence, statut des analogies).

## Déroulement

1. **Semaine 1 (avant le cours).** Chaque étudiant ouvre la page *Diagnostic* (`diagnostic.html`), choisit « Avant le cours »,
   répond seul, sans notes, en 15 minutes environ, puis valide. Les corrections ne s'affichent pas.
2. **Fin de semestre (après le cours, avant l'examen).** Même procédure avec « Après le cours ». Les corrections s'affichent.
3. **Recueil.** Chaque étudiant clique sur « Copier mes résultats » et dépose le texte copié (aucun nom, aucun identifiant)
   dans le formulaire ou le document choisi par l'enseignant. Il peut aussi le montrer sur son téléphone pour saisie manuelle.
4. **Analyse.** L'enseignant colle tous les blocs dans un fichier texte `resultats.txt` puis lance :

   ```bash
   python3 outils/analyser_diagnostic.py resultats.txt --sortie rapport.md
   python3 outils/analyser_diagnostic.py --test      # auto-contrôle de l'outil
   ```

   Le rapport donne l'effectif apparié, les moyennes, le gain normalisé de Hake, la différence moyenne avec son intervalle de
   confiance (bootstrap), le détail par thème et par question, et le verdict.

## Critère d'acceptation (validé par l'enseignant le 2026-10-18)

Le raffinement est considéré comme concluant pour la promotion pilote si les quatre conditions suivantes sont réunies :

| Condition | Seuil |
|---|---|
| Effectif apparié (avant ET après) | au moins 20 étudiants |
| Gain normalisé de classe (Hake) | au moins 0,30 |
| Différence moyenne avant / après | borne basse de l'IC à 95 % supérieure à 0 |
| Thèmes | aucun thème en recul |

Le gain normalisé est \(g = (\text{après} - \text{avant}) / (100 - \text{avant})\), en moyennes de classe (Hake, 1998). Repères
usuels : moyen à partir de 0,30, élevé à partir de 0,70.

## Précautions

- Les dix questions sont les mêmes avant et après : une partie du gain peut venir du re-test. Pour limiter ce biais, ne pas
  corriger au pré-test et laisser passer plusieurs semaines.
- Pas de groupe témoin : le résultat est un indice, pas une preuve que le Carnet est la cause du gain.
- Participation volontaire, anonyme, non notée. Dire aux étudiants que le diagnostic sert à améliorer le cours.
- Un thème en recul ou un gain faible est une piste à examiner selon les scores initiaux et l'incertitude (une ou deux questions par thème : fluctuations et effet plafond sont possibles). « Aucun thème en recul » est un critère descriptif, sans garantie statistique.
- Les réponses des étudiants ne quittent jamais leur navigateur tant qu'ils ne copient pas eux-mêmes le texte.

# Guide de Démarrage - Workbook Quantique PHY321

## 🚀 Bienvenue !

Ce workbook interactif contient **6 chapitres complets** sur l'Introduction à la Mécanique Quantique, conçus spécifiquement pour les étudiants de 3ème année de Licence en Physique de l'Université de Yaoundé I.

## 📚 Structure du Workbook

### Les 6 Chapitres

| Chapitre | Titre | Durée estimée | Niveau |
|----------|-------|---------------|--------|
| 1 | **États quantiques** - Qubits, superposition et amplitudes | 2-3h | Débutant |
| 2 | **Mesures et Opérateurs** - Observables et principes | 2-3h | Débutant |
| 3 | **Mesure et opérateurs** - Stern-Gerlach et formalisme | 2h | Intermédiaire |
| 4 | **Postulats de la QM** - Fondations mathématiques | 3-4h | Intermédiaire |
| 5 | **Multi-qubits et intrication** - Bell et non-localité | 2-3h | Avancé |
| 6 | **États quantiques et fonctions d'onde** - Potentiels | 3-4h | Avancé |

## 🎯 Comment Utiliser

### Pour les Étudiants

#### 1. Navigation
- **Dans la barre latérale** : Cliquez sur un chapitre pour le charger
- **Boutons de navigation** : Flèches en bas de page pour aller au chapitre suivant/précédent
- **Barre de recherche** (🔍) : Cherchez un concept dans tous les chapitres

#### 2. Apprendre
- **Lisez le contenu** : Comprenez les concepts progressivement
- **Observez les équations** : Rendues en LaTeX avec MathJax
- **Explorez les visualisations** : Diagrammes et illustrations pédagogiques

#### 3. Interagir
- **Simulations** : Cliquez sur les boutons pour explorer les concepts
  - Fentes d'Young, Sphère de Bloch, Décohérence
  - Stern-Gerlach, États de Bell, Particule dans une boîte
  - Et plus...
  
- **Calculateurs** : Saisissez des valeurs pour voir les résultats
  - Probabilités d'états quantiques
  - Évolution temporelle
  - États multi-qubits

#### 4. Pratiquer
- **Exercices QCM** : 4-5 exercices par chapitre
- **Niveaux de difficulté** : Facile → Difficile
- **Feedback immédiat** : Vérifiez votre réponse et comprenez pourquoi
- **Progression** : Suivez vos progrès dans la barre latérale

#### 5. Réviser
- **Résumés de fin de chapitre** : Concepts clés à retenir
- **Flashcards** (🃏) : Mode pour la mémorisation
- **Export PDF** (📄) : Téléchargez pour la lecture hors ligne

### Pour les Éducateurs

#### Modifier un Chapitre
```bash
# Éditez directement le fichier HTML
nano chapters/chapter3.html
```

#### Ajouter un Exercice
1. Ouvrez `chapters/chapterN.html`
2. Copiez la structure d'exercice existante
3. Changez l'ID et le contenu
4. Sauvegardez - le moteur d'exercices détecte automatiquement

#### Ajouter une Simulation
1. Créez un élément `<canvas>`
2. Écrivez le code JavaScript de la simulation
3. Incluez les contrôles avec `<input>` et `<button>`
4. Testez dans le navigateur

## 💻 Installation et Déploiement

### Locally (En local)
```bash
# Clonez ou accédez au répertoire
cd /home/tchapet/UY1/FS/2025-2026/Cours/quantum-workbook/

# Ouvrez dans un serveur local
python3 -m http.server 8000

# Accédez à http://localhost:8000
```

### Sur GitHub Pages
```bash
# Committez les fichiers
git add .
git commit -m "Add new quantum chapters"
git push

# Activez Pages dans les paramètres du repo
# Branch: main, Folder: /
```

## 🎨 Fonctionnalités

### Thème
- **Mode Clair/Sombre** (🌙) : Basculez selon votre préférence
- Sauvegardé automatiquement

### Mode Offline
- **PWA compatible** : Fonctionne sans connexion internet
- Téléchargez l'application depuis le navigateur

### Suivi de Progression
- **Barre de progression** (en haut à gauche)
- **Exercices complétés** : Statistiques détaillées
- **Marque-pages automatiques** : Où vous aviez arrêté

### Accessibilité
- **Responsive** : Mobile, tablette, desktop
- **Contraste élevé** : Lisible même avec accessibilité
- **Navigation au clavier** : Tab, Entrée pour les contrôles

## 📊 Vue d'ensemble du Contenu

### Chapitre 3 : Mesure et opérateurs
```
└─ Stern-Gerlach
   ├─ Simulation interactive
   ├─ Exercice 3.1
   └─ Explications
└─ Opérateurs Hermitiens
   ├─ Valeurs propres
   ├─ Exercice 3.2
   └─ Propriétés
└─ Algèbre des opérateurs
   ├─ Commutateurs
   ├─ Matrices de Pauli
   ├─ Exercice 3.3
   └─ Relations
└─ Inégalité de Heisenberg
   ├─ Formulation
   ├─ Exercice 3.4
   └─ Applications
```

### Chapitre 4 : Postulats de la QM
```
└─ 5 Postulats fondamentaux
   ├─ Espace de Hilbert (Ex 4.1)
   ├─ Observables (Ex 4.2)
   ├─ Mesure (Ex 4.3, Calc)
   ├─ Schrödinger (Ex 4.4, Sim)
   └─ Effondrement (Ex 4.5)
```

### Chapitre 5 : Multi-qubits
```
└─ Produit tensoriel (Ex 5.1)
└─ Intrication
   ├─ États de Bell (Sim, Calc)
   ├─ Exercice 5.2
   └─ Propriétés
└─ Inégalités de Bell
   ├─ Violation
   ├─ Exercice 5.3
   └─ Non-localité
└─ Information quantique (Ex 5.4)
   └─ Générateur multi-qubits
```

### Chapitre 6 : Fonctions d'onde
```
└─ Représentations (Ex 6.1)
└─ Schrödinger indépendante du temps (Ex 6.2)
└─ Particule dans une boîte
   ├─ Niveaux d'énergie
   ├─ Simulation interactive (Ex 6.3)
   └─ Fonctions d'onde
└─ Oscillateur harmonique
   ├─ Niveaux réguliers
   ├─ Opérateurs création/annihilation
   └─ Exercice 6.4
└─ États cohérents et Fock (Ex 6.5)
```

## 🤔 Questions Fréquentes

### Comment retrouver un concept ?
Utilisez la barre de recherche (🔍) pour une recherche globale.

### Comment exporter en PDF ?
Cliquez sur (📄) dans la barre d'outils. Sélectionnez :
- Chapitre actuel
- Tous les chapitres
- Personnalisé (sélectionnez les chapitres)

### Comment marquer un exercice comme complété ?
Soumettez une réponse. Le système enregistre automatiquement.

### Comment réinitialiser ma progression ?
Allez à Settings (si disponible) ou videz le cache local.

### Les simulations ne fonctionnent pas ?
- Vérifiez que JavaScript est activé
- Actualisez la page (Ctrl+R)
- Testez dans un autre navigateur (Chrome, Firefox)

## 📞 Support

### Feedback
Pour signaler un bug ou proposer une amélioration :
- Contactez l'équipe pédagogique
- Incluez le numéro du chapitre et de l'exercice
- Décrivez le problème en détail

### Mises à Jour
Ce workbook est en développement continu. Les mises à jour incluent :
- Nouveaux exercices
- Simulations améliorées
- Corrections des bugs
- Contenu supplémentaire

## 📖 Ressources Complémentaires

### Lecture recommandée
- Griffiths, D.J. "Introduction to Quantum Mechanics"
- Cohen-Tannoudji, Diu, Laloë "Quantum Mechanics"

### Vidéos
- MIT OpenCourseWare - Quantum Mechanics
- 3Blue1Brown - Quantum Mechanics

### Sites web
- Stanford Encyclopedia of Philosophy - Quantum Mechanics
- PhysicsStack

## 🔒 Confidentialité

Ce workbook ne collecte que les données suivantes :
- Progression (chapitres lus)
- Exercices complétés
- Temps passé
**Stockées localement, jamais transmises.**

## ✅ Checklist de Démarrage

- [ ] J'ai accédé au workbook (http://localhost:8000)
- [ ] J'ai lu le Chapitre 1
- [ ] J'ai complété un exercice
- [ ] J'ai lancé une simulation
- [ ] J'ai basculé le thème clair/sombre
- [ ] J'ai consulté la barre de progression
- [ ] J'ai navigué vers le Chapitre 2

## 🎓 Trajectoire Recommandée

### Semaine 1-2 : Fondamentaux
1. **Chapitre 1** : États quantiques (vue d'ensemble)
2. **Chapitre 2** : Mesures et opérateurs (concepts)
3. Exercices et révisions

### Semaine 3-4 : Théorie
1. **Chapitre 3** : Mesure et opérateurs (formellement)
2. **Chapitre 4** : Postulats (fondations)
3. Exercices approfondis

### Semaine 5-6 : Avancé
1. **Chapitre 5** : Multi-qubits (intrication)
2. **Chapitre 6** : Fonctions d'onde (applications)
3. Projets et synthèse

---

**Bon apprentissage! 🎓✨**

*Workbook créé pour PHY321 - Université de Yaoundé I*
*Dernière mise à jour : janvier 2026*

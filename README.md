# Quantum Workbook PHY321 - Université de Yaoundé I

## 📚 Description

Ce workbook interactif accompagne le cours **Introduction à la Mécanique Quantique PHY321** de l'Université de Yaoundé I. Il propose une approche pédagogique moderne combinant théorie, exercices interactifs et simulations pour maîtriser les concepts fondamentaux de la physique quantique.

## ✨ Fonctionnalités

### 📖 Contenu Pédagogique
- **6 chapitres complets** basés sur le cours LaTeX original
- **Rendu LaTeX** avec MathJax pour les équations
- **Éléments interactifs** : définitions, théorèmes, exemples
- **Navigation intuitive** avec progression sauvegardée

### 🎯 Exercices Interactifs
- **Questions à choix multiples** avec feedback immédiat
- **Simulations quantiques** (sphère de Bloch, interférences)
- **Calculateurs** pour les probabilités quantiques
- **Suivi de progression** personnalisé

### 📊 Fonctionnalités Avancées
- **Export PDF** chapitre par chapitre ou cours complet
- **Mode sombre/clair** adaptatif
- **Recherche full-text** dans le contenu
- **PWA** : installation sur mobile/desktop
- **Intégration** avec le site quantum-quiz existant

### 🔗 Intégration avec Quantum-Quiz
- **Redirection transparente** vers les quiz
- **Partage de progression** entre les plateformes
- **Flashcards** synchronisées
- **Mode examen** intégré

## 🏗️ Structure du Projet

```
quantum-workbook/
├── index.html                 # Page d'accueil principale
├── manifest.json             # Configuration PWA
├── assets/
│   ├── css/
│   │   ├── main.css          # Styles principaux
│   │   └── workbook.css      # Styles spécifiques
│   ├── js/
│   │   ├── workbook-core.js  # Logique principale
│   │   ├── exercise-engine.js # Moteur d'exercices
│   │   ├── pdf-generator.js  # Export PDF
│   │   └── mathjax-config.js # Configuration LaTeX
│   └── images/               # Ressources graphiques
├── chapters/                 # Contenu des chapitres
│   ├── chapter1.html        # États quantiques
│   ├── chapter2.html        # Mesures et opérateurs
│   └── ...
├── exercises/                # Exercices interactifs
├── integration/              # Scripts d'intégration
└── README.md
```

## 📋 Chapitres Disponibles

1. **États quantiques** - Qubits, superposition et amplitudes de probabilité
2. **Mesures et Opérateurs** - Observables, mesures quantiques et opérateurs
3. **Postulats de la Mécanique Quantique** - Fondements théoriques
4. **Systèmes Multi-Qubits** - Intrication et produit tensoriel
5. **Fonctions d'État** - Représentation en position et impulsion
6. **Oscillateur Harmonique Quantique** - États de Fock et états cohérents

## 🚀 Installation et Utilisation

### Utilisation Directe
1. Ouvrir `index.html` dans un navigateur moderne
2. Naviguer entre les chapitres via le menu latéral
3. Interagir avec les exercices et simulations

### Installation PWA
1. Visiter le site dans Chrome/Edge/Safari
2. Cliquer sur "Installer l'application"
3. Utiliser comme application native

### Intégration avec Quantum-Quiz
```bash
# Cloner dans le même répertoire que quantum-quiz
git clone [repo-url] quantum-workbook
cd quantum-workbook

# Le workbook détectera automatiquement quantum-quiz
# et activera les fonctionnalités d'intégration
```

## 🔧 Configuration

### Variables CSS Personnalisables
```css
:root {
  --primary-color: #7c3aed;    /* Couleur principale */
  --secondary-color: #3b82f6;  /* Couleur secondaire */
  --accent-color: #10b981;     /* Couleur d'accent */
}
```

### Configuration MathJax
Le fichier `assets/js/mathjax-config.js` contient les macros LaTeX spécifiques au cours :
- `\ket{state}` pour les états quantiques
- `\bra{state}` pour les bras
- `\braket{a}{b}` pour les produits scalaires
- Opérateurs de Pauli : `\sx`, `\sy`, `\sz`

## 📱 Compatibilité

- **Navigateurs** : Chrome 80+, Firefox 75+, Safari 13+, Edge 80+
- **Mobile** : iOS 13+, Android 8+
- **Responsive** : Optimisé pour toutes les tailles d'écran
- **Accessibilité** : Conforme WCAG 2.1 AA

## 🎨 Personnalisation

### Thèmes
- Mode clair/sombre automatique
- Personnalisation via CSS custom properties
- Sauvegarde des préférences utilisateur

### Contenu
- Ajout facile de nouveaux chapitres
- Système d'exercices extensible
- Support des simulations personnalisées

## 🔄 Intégration avec le Cours LaTeX

Le workbook est conçu pour être généré automatiquement à partir des fichiers LaTeX du cours PHY321 :

1. **Extraction du contenu** : Parser les fichiers `.tex`
2. **Conversion HTML** : Transformer en HTML sémantique
3. **Enrichissement** : Ajouter les éléments interactifs
4. **Optimisation** : Minifier et optimiser pour le web

## 📊 Suivi de Progression

- **Progression par chapitre** : Pourcentage de complétion
- **Historique des exercices** : Réponses et scores
- **Statistiques** : Temps passé, précision
- **Sauvegarde locale** : Pas de compte requis

## 🔗 Liens Utiles

- [Cours PHY321 Original](../PHY321a/UY12025/)
- [Site Quantum-Quiz](../quantum-quiz/)
- [Documentation MathJax](https://docs.mathjax.org/)
- [Université de Yaoundé I](https://www.uy1.uninet.cm/)

## 📄 Licence

Ce projet est développé pour l'Université de Yaoundé I dans le cadre du cours PHY321. 
Tous droits réservés à l'équipe pédagogique.

## 👥 Équipe

- **Équipe Pédagogique PHY321** - Université de Yaoundé I
- **Développement** - Assistant IA Kiro

---

*Dernière mise à jour : Décembre 2025*

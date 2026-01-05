// Core du workbook - Gestion principale
class QuantumWorkbook {
  constructor() {
    this.currentChapter = null;
    this.chapters = [];
    this.progress = this.loadProgress();
    this.theme = localStorage.getItem('theme') || 'light';
    this.init();
  }

  init() {
    this.loadChapters();
    this.setupEventListeners();
    this.applyTheme();
    this.updateProgressDisplay();
  }

  loadChapters() {
    // Structure des chapitres basée sur le cours PHY321
    this.chapters = [
      {
        id: 'ch1',
        title: 'États quantiques',
        subtitle: 'Qubits, superposition et amplitudes de probabilité',
        file: 'chapters/chapter1.html',
        sections: [
          'Interférences à un quanton',
          'Amplitudes de probabilité',
          'Superposition et décohérence',
          'Le qubit et l\'espace de Hilbert'
        ]
      },
      {
        id: 'ch2',
        title: 'Mesures et Opérateurs',
        subtitle: 'Observables, mesures quantiques et opérateurs',
        file: 'chapters/chapter2.html',
        sections: [
          'Observables et mesures',
          'Opérateurs linéaires',
          'Valeurs propres et vecteurs propres',
          'Principe d\'incertitude'
        ]
      },
      {
        id: 'ch3',
        title: 'Mesure et opérateurs',
        subtitle: 'Stern-Gerlach, valeurs propres et opérateurs Hermitiens',
        file: 'chapters/chapter3.html',
        sections: [
          'Le verdict de la nature : Stern et Gerlach',
          'Opérateurs Hermitiens et valeurs propres',
          'L\'algèbre des opérateurs',
          'Inégalité de Heisenberg'
        ]
      },
      {
        id: 'ch4',
        title: 'Les postulats de la mécanique quantique',
        subtitle: 'Fondations mathématiques et physiques',
        file: 'chapters/chapter4.html',
        sections: [
          'L\'espace des états (Postulat 1)',
          'Les observables et opérateurs (Postulat 2)',
          'Les résultats de mesure (Postulat 3)',
          'L\'équation de Schrödinger (Postulat 4)',
          'L\'effondrement du paquet d\'ondes (Postulat 5)'
        ]
      },
      {
        id: 'ch5',
        title: 'Systèmes multi-qubits et intrication',
        subtitle: 'Produit tensoriel, états de Bell et non-localité',
        file: 'chapters/chapter5.html',
        sections: [
          'Produit tensoriel et états composites',
          'Intrication quantique (Entanglement)',
          'Les inégalités de Bell',
          'Information quantique et qubits'
        ]
      },
      {
        id: 'ch6',
        title: 'États quantiques et fonctions d\'onde',
        subtitle: 'Potentiel, confinement et états stationnaires',
        file: 'chapters/chapter6.html',
        sections: [
          'Représentations en mécanique quantique',
          'L\'équation de Schrödinger indépendante du temps',
          'Particule dans une boîte',
          'Oscillateur harmonique quantique',
          'États cohérents et états de Fock'
        ]
      }
    ];

    this.renderChapterList();
  }

  renderChapterList() {
    const chapterList = document.getElementById('chapter-list');
    if (!chapterList) return;

    chapterList.innerHTML = this.chapters.map((chapter, index) => {
      const progress = this.getChapterProgress(chapter.id);
      return `
        <li class="chapter-item">
          <a href="#" class="chapter-link" data-chapter="${chapter.id}">
            <div>
              <div style="font-weight: 600;">Chapitre ${index + 1}</div>
              <div style="font-size: 0.875rem; opacity: 0.8;">${chapter.title}</div>
            </div>
            <span class="chapter-progress">${progress}%</span>
          </a>
        </li>
      `;
    }).join('');

    // Ajouter les événements
    document.querySelectorAll('.chapter-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const chapterId = e.currentTarget.dataset.chapter;
        this.loadChapter(chapterId);
      });
    });
  }

  async loadChapter(chapterId) {
    const chapter = this.chapters.find(ch => ch.id === chapterId);
    if (!chapter) return;

    this.currentChapter = chapter;
    
    // Mettre à jour l'UI
    document.querySelectorAll('.chapter-link').forEach(link => {
      link.classList.remove('active');
      if (link.dataset.chapter === chapterId) {
        link.classList.add('active');
      }
    });

    // Charger le contenu
    const contentArea = document.getElementById('chapter-content');
    contentArea.innerHTML = '<div class="loading"></div>';

    try {
      const response = await fetch(chapter.file);
      if (!response.ok) {
        contentArea.innerHTML = this.generateChapterTemplate(chapter);
      } else {
        const html = await response.text();
        contentArea.innerHTML = html;

        // Extraire et exécuter les scripts du chapitre
        const scriptElements = contentArea.querySelectorAll('script');
        const promises = [];

        // Sauvegarder les scripts pour les réinsérer correctement
        const scriptsToExecute = [];
        scriptElements.forEach(script => {
          if (script.src) {
            // Script externe
            promises.push(this.loadExternalScript(script.src));
          } else if (script.textContent) {
            // Sauvegarder le contenu du script pour exécution ultérieure
            scriptsToExecute.push(script.textContent);
          }
        });

        // Supprimer les scripts existants pour les réinjecter proprement
        scriptElements.forEach(script => script.remove());

        // Réinjecter les scripts internes pour qu'ils s'exécutent dans le contexte global
        for (const scriptText of scriptsToExecute) {
          const newScript = document.createElement('script');
          newScript.textContent = scriptText;
          document.head.appendChild(newScript);
          // Garder une trace pour nettoyage éventuel
          newScript.setAttribute('data-chapter-script', 'true');
        }

        // Attendre que tous les scripts externes soient chargés
        if (promises.length > 0) {
          await Promise.all(promises);
        }

        // Attendre un court délai pour s'assurer que les fonctions sont définies
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // Attendre que le DOM soit mis à jour
      await new Promise(resolve => setTimeout(resolve, 100));

      // S'assurer que MathJax est prêt avant de le rendre
      if (window.MathJax && window.MathJax.startup && window.MathJax.startup.promise) {
        await window.MathJax.startup.promise;
      }

      // Rendre les équations MathJax
      if (window.MathJax && window.MathJax.typesetPromise) {
        try {
          await MathJax.typesetPromise([contentArea]);
          // Attendre un peu après le rendu MathJax pour s'assurer que tout est terminé
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (err) {
          console.error('Erreur MathJax:', err);
        }
      }

      // Initialiser les simulations si nécessaire
      if (window.QuantumMeasurementSimulation && document.getElementById('measurement-canvas')) {
        // Détruire l'ancienne simulation si elle existe
        if (window.measurementSimulation) {
          window.measurementSimulation.destroy();
        }
        // Créer une nouvelle simulation
        window.measurementSimulation = new window.QuantumMeasurementSimulation('measurement-canvas');
      }

      // Attendre un peu pour que le contenu soit pleinement chargé
      await new Promise(resolve => setTimeout(resolve, 100));

      // Initialiser les éléments interactifs
      this.initializeInteractiveElements();

      // Attendre que le contenu soit pleinement chargé, MathJax soit prêt et initialiser les animations
      setTimeout(async () => {
        // Attendre que MathJax soit complètement prêt s'il est présent
        if (window.MathJax && window.MathJax.startup && window.MathJax.startup.promise) {
          try {
            await window.MathJax.startup.promise;
            console.log('MathJax complètement prêt');
          } catch (error) {
            console.warn('MathJax startup promise non disponible, poursuite de l\'initialisation:', error);
          }
        }

        // Attendre un peu de plus pour s'assurer que le rendu MathJax est terminé
        await new Promise(resolve => setTimeout(resolve, 300));

        // Initialiser les simulations spécifiques au chapitre
        this.initializeChapterSimulations();
      }, 300);
      
      // Émettre événement pour le tracking
      document.dispatchEvent(new CustomEvent('chapter-loaded', {
        detail: { chapterId }
      }));
      
      // Scroll vers le haut de la page
      window.scrollTo(0, 0);

    } catch (error) {
      console.error('Erreur de chargement:', error);
      contentArea.innerHTML = this.generateChapterTemplate(chapter);
    }
  }

  async loadExternalScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load external script: ${src}`));
      document.head.appendChild(script);
    });
  }

  generateChapterTemplate(chapter) {
    return `
      <div class="chapter-header fade-in">
        <h1 class="chapter-title">${chapter.title}</h1>
        <p class="chapter-subtitle">${chapter.subtitle}</p>
      </div>

      <div class="info-box">
        <h3>📚 Contenu du chapitre</h3>
        <ul>
          ${chapter.sections.map(section => `<li>${section}</li>`).join('')}
        </ul>
      </div>

      <div class="section">
        <h2 class="section-title">Introduction</h2>
        <p>Ce chapitre explore ${chapter.title.toLowerCase()}. Le contenu détaillé sera généré à partir du cours LaTeX.</p>
      </div>

      <div class="interactive-element exercise-box">
        <h3>🎯 Exercice Interactif</h3>
        <p>Les exercices interactifs seront disponibles prochainement.</p>
        <button class="btn">Commencer l'exercice</button>
      </div>

      <div class="chapter-navigation">
        <a href="#" class="nav-btn" id="prev-chapter">
          ← Chapitre précédent
        </a>
        <a href="#" class="nav-btn" id="next-chapter">
          Chapitre suivant →
        </a>
      </div>
    `;
  }

  initializeInteractiveElements() {
    // Attendre que MathJax soit prêt
    const initElements = () => {
      // Initialiser les exercices
      document.querySelectorAll('.exercise-container').forEach(exercise => {
        this.initializeExercise(exercise);
      });

      // Initialiser les simulations
      document.querySelectorAll('.simulation-container').forEach(sim => {
        this.initializeSimulation(sim);
      });

      // Navigation entre chapitres
      const prevBtn = document.getElementById('prev-chapter');
      const nextBtn = document.getElementById('next-chapter');

      if (prevBtn) {
        prevBtn.replaceWith(prevBtn.cloneNode(true)); // Supprimer anciens listeners
        document.getElementById('prev-chapter').addEventListener('click', (e) => {
          e.preventDefault();
          this.navigateToPreviousChapter();
        });
      }

      if (nextBtn) {
        nextBtn.replaceWith(nextBtn.cloneNode(true)); // Supprimer anciens listeners
        document.getElementById('next-chapter').addEventListener('click', (e) => {
          e.preventDefault();
          this.navigateToNextChapter();
        });
      }

      // Initialiser les scripts spécifiques au chapitre
      setTimeout(() => {
        console.log('Tentative d\'initialisation des simulations...');

        // Vérifier que les fonctions existent avant de les appeler
        if (typeof initializeYoungSlitsSimulation === 'function') {
          try {
            initializeYoungSlitsSimulation();
            console.log('initializeYoungSlitsSimulation appelée');
          } catch (error) {
            console.error('Erreur lors de l\'initialisation de la simulation des fentes d\'Young:', error);
          }
        } else {
          console.warn('initializeYoungSlitsSimulation non trouvée');
        }

        if (typeof initializeBlochSphereSimulation === 'function') {
          try {
            initializeBlochSphereSimulation();
            console.log('initializeBlochSphereSimulation appelée');
          } catch (error) {
            console.error('Erreur lors de l\'initialisation de la simulation de la sphère de Bloch:', error);
          }
        } else {
          console.warn('initializeBlochSphereSimulation non trouvée');
        }

        if (typeof initializeDecoherenceSimulation === 'function') {
          try {
            initializeDecoherenceSimulation();
            console.log('initializeDecoherenceSimulation appelée');
          } catch (error) {
            console.error('Erreur lors de l\'initialisation de la simulation de décohérence:', error);
          }
        } else {
          console.warn('initializeDecoherenceSimulation non trouvée');
        }

        if (typeof initializeProbabilityCalculator === 'function') {
          try {
            initializeProbabilityCalculator();
            console.log('initializeProbabilityCalculator appelée');
          } catch (error) {
            console.error('Erreur lors de l\'initialisation du calculateur de probabilités:', error);
          }
        } else {
          console.warn('initializeProbabilityCalculator non trouvée');
        }
      }, 500); // Délai pour s'assurer que le DOM est complètement chargé
    };

    // Attendre un peu pour que MathJax finisse
    setTimeout(initElements, 200);
  }

  initializeExercise(exerciseElement) {
    const options = exerciseElement.querySelectorAll('.option-item');
    const submitBtn = exerciseElement.querySelector('.btn-submit');
    const feedback = exerciseElement.querySelector('.exercise-feedback');

    options.forEach(option => {
      option.addEventListener('click', () => {
        options.forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');
      });
    });

    if (submitBtn) {
      submitBtn.addEventListener('click', () => {
        const selected = exerciseElement.querySelector('.option-item.selected');
        if (!selected) return;

        const isCorrect = selected.dataset.correct === 'true';
        
        if (isCorrect) {
          selected.classList.add('correct');
          feedback.className = 'exercise-feedback feedback-correct';
          feedback.innerHTML = '✓ Correct ! ' + (selected.dataset.explanation || '');
        } else {
          selected.classList.add('incorrect');
          feedback.className = 'exercise-feedback feedback-incorrect';
          feedback.innerHTML = '✗ Incorrect. ' + (selected.dataset.explanation || '');
          
          // Montrer la bonne réponse
          options.forEach(opt => {
            if (opt.dataset.correct === 'true') {
              opt.classList.add('correct');
            }
          });
        }
        
        feedback.style.display = 'block';
        
        // Rendre MathJax dans le feedback
        if (window.MathJax && window.MathJax.typesetPromise) {
          MathJax.typesetPromise([feedback]);
        }
        
        this.updateProgress(this.currentChapter.id, 'exercise-completed');
      });
    }
  }

  initializeSimulation(simElement) {
    // Placeholder pour les simulations
    console.log('Simulation initialisée:', simElement);
  }

  initializeChapterSimulations() {
    // Fonction pour s'assurer que les fonctions sont disponibles avant de les appeler
    const waitForFunctionsAndInitialize = () => {
      // Essayer d'initialiser les simulations avec une attente incrémentielle
      const functionsToInitialize = [
        { name: 'YoungSlitsSimulation', fn: 'initializeYoungSlitsSimulation' },
        { name: 'BlochSphereSimulation', fn: 'initializeBlochSphereSimulation' },
        { name: 'DecoherenceSimulation', fn: 'initializeDecoherenceSimulation' },
        { name: 'ProbabilityCalculator', fn: 'initializeProbabilityCalculator' }
      ];

      const maxAttempts = 50; // Maximum 5 secondes (50 * 100ms)
      let attempts = 0;

      const tryInitialize = () => {
        attempts++;

        for (let i = functionsToInitialize.length - 1; i >= 0; i--) {
          const funcInfo = functionsToInitialize[i];

          if (typeof window[funcInfo.fn] === 'function') {
            try {
              // Vérifier que les éléments DOM nécessaires existent avant d'initialiser
              let canInitialize = true;

              // Vérifier les éléments spécifiques à chaque simulation
              switch(funcInfo.fn) {
                case 'initializeYoungSlitsSimulation':
                  canInitialize = document.getElementById('young-slits-canvas') !== null;
                  break;
                case 'initializeBlochSphereSimulation':
                  canInitialize = document.getElementById('bloch-sphere-canvas') !== null;
                  break;
                case 'initializeDecoherenceSimulation':
                  canInitialize = document.getElementById('decoherence-canvas') !== null;
                  break;
                case 'initializeProbabilityCalculator':
                  canInitialize = document.getElementById('calculate-probs') !== null;
                  break;
              }

              if (canInitialize) {
                window[funcInfo.fn]();
                console.log(`${funcInfo.name} initialisée`);
                // Retirer la fonction de la liste une fois initialisée
                functionsToInitialize.splice(i, 1);
              }
            } catch (error) {
              console.error(`Erreur initialisation ${funcInfo.name}:`, error);
            }
          }
        }

        // Si toutes les fonctions sont initialisées ou tentative max atteinte
        if (functionsToInitialize.length === 0 || attempts >= maxAttempts) {
          if (functionsToInitialize.length > 0) {
            console.warn(`Les fonctions suivantes n'ont pas été initialisées:`,
              functionsToInitialize.map(f => f.name));
          }
          return;
        }

        // Réessayer dans 100ms
        setTimeout(tryInitialize, 100);
      };

      tryInitialize();
    };

    // Attendre un peu pour que le contenu et les scripts soient chargés
    setTimeout(waitForFunctionsAndInitialize, 300);
  }

  navigateToPreviousChapter() {
    if (!this.currentChapter) return;
    const currentIndex = this.chapters.findIndex(ch => ch.id === this.currentChapter.id);
    if (currentIndex > 0) {
      this.loadChapter(this.chapters[currentIndex - 1].id);
    }
  }

  navigateToNextChapter() {
    if (!this.currentChapter) return;
    const currentIndex = this.chapters.findIndex(ch => ch.id === this.currentChapter.id);
    if (currentIndex < this.chapters.length - 1) {
      this.loadChapter(this.chapters[currentIndex + 1].id);
    }
  }

  setupEventListeners() {
    // Basculer le thème
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => this.toggleTheme());
    }

    // Export PDF
    const pdfExport = document.getElementById('pdf-export');
    if (pdfExport) {
      pdfExport.addEventListener('click', () => this.exportToPDF());
    }

    // Basculer la progression
    const progressToggle = document.getElementById('progress-toggle');
    if (progressToggle) {
      progressToggle.addEventListener('click', () => this.showProgressModal());
    }

    // Mode quiz
    const quizMode = document.getElementById('quiz-mode');
    if (quizMode) {
      quizMode.addEventListener('click', () => this.startQuizMode());
    }

    // Flashcards
    const flashcards = document.getElementById('flashcards');
    if (flashcards) {
      flashcards.addEventListener('click', () => this.startFlashcards());
    }

    // Recherche
    const searchToggle = document.getElementById('search-toggle');
    if (searchToggle) {
      searchToggle.addEventListener('click', () => this.toggleSearch());
    }
  }

  toggleTheme() {
    this.theme = this.theme === 'light' ? 'dark' : 'light';
    this.applyTheme();
    localStorage.setItem('theme', this.theme);
  }

  applyTheme() {
    document.documentElement.setAttribute('data-theme', this.theme);
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
      themeToggle.textContent = this.theme === 'dark' ? '☀️' : '🌙';
    }
  }

  exportToPDF() {
    // Intégration avec pdf-generator.js
    if (window.PDFGenerator) {
      const generator = new PDFGenerator();
      generator.exportChapter(this.currentChapter);
    } else {
      alert('Fonctionnalité d\'export PDF en cours de développement');
    }
  }

  showProgressModal() {
    alert('Modal de progression en cours de développement');
  }

  startQuizMode() {
    // Rediriger vers le site quantum-quiz externe
    window.open('https://tchapetnjafa.github.io/quantum-quiz/', '_blank');
  }

  startFlashcards() {
    // Rediriger vers les flashcards
    window.open('https://tchapetnjafa.github.io/quantum-quiz/flashcards.html', '_blank');
  }

  toggleSearch() {
    const searchContainer = document.getElementById('search-container');
    if (searchContainer) {
      searchContainer.style.display = 
        searchContainer.style.display === 'none' ? 'flex' : 'none';
    }
  }

  loadProgress() {
    const saved = localStorage.getItem('workbook-progress');
    return saved ? JSON.parse(saved) : {};
  }

  saveProgress() {
    localStorage.setItem('workbook-progress', JSON.stringify(this.progress));
  }

  updateProgress(chapterId, action) {
    if (!this.progress[chapterId]) {
      this.progress[chapterId] = { completed: 0, total: 10 };
    }
    
    this.progress[chapterId].completed++;
    this.saveProgress();
    this.updateProgressDisplay();
  }

  getChapterProgress(chapterId) {
    const chapterProgress = this.progress[chapterId];
    if (!chapterProgress) return 0;
    return Math.round((chapterProgress.completed / chapterProgress.total) * 100);
  }

  updateProgressDisplay() {
    const totalChapters = this.chapters.length;
    const completedChapters = Object.keys(this.progress).length;
    const overallProgress = Math.round((completedChapters / totalChapters) * 100);

    const progressFill = document.getElementById('overall-progress');
    const progressText = document.getElementById('progress-percentage');

    if (progressFill) progressFill.style.width = `${overallProgress}%`;
    if (progressText) progressText.textContent = `${overallProgress}%`;
  }
}

// Initialiser le workbook au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
  window.workbook = new QuantumWorkbook();
});

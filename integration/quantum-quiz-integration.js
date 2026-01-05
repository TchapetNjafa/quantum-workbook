// Script d'intégration avec le site quantum-quiz
class QuantumQuizIntegration {
  constructor() {
    this.quizPath = 'https://tchapetnjafa.github.io/quantum-quiz';
    this.isQuizAvailable = false;
    this.init();
  }

  async init() {
    // Quiz est toujours considéré comme disponible via URL externe
    this.isQuizAvailable = true;
    this.setupIntegration();
  }

  async checkQuizAvailability() {
    // Quiz est accessible via l'URL externe
    this.isQuizAvailable = true;
    console.log('Quantum-Quiz disponible:', this.isQuizAvailable);
  }

  setupIntegration() {
    // Ajouter des boutons d'intégration dans l'interface
    this.addQuizButtons();
    this.setupProgressSync();
    this.addNavigationLinks();
  }

  addQuizButtons() {
    // Modifier le bouton Quiz Mode pour rediriger vers quantum-quiz
    const quizBtn = document.getElementById('quiz-mode');
    if (quizBtn) {
      quizBtn.addEventListener('click', () => {
        this.openQuizMode();
      });
    }

    // Modifier le bouton Flashcards
    const flashcardsBtn = document.getElementById('flashcards');
    if (flashcardsBtn) {
      flashcardsBtn.addEventListener('click', () => {
        this.openFlashcards();
      });
    }

    // Ajouter des boutons contextuels dans les chapitres
    this.addChapterQuizButtons();
  }

  addChapterQuizButtons() {
    // Observer les changements de chapitre pour ajouter des boutons quiz
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          const chapterContent = document.getElementById('chapter-content');
          if (chapterContent && chapterContent.innerHTML.includes('chapter-title')) {
            this.injectChapterQuizButton(chapterContent);
          }
        }
      });
    });

    const chapterContent = document.getElementById('chapter-content');
    if (chapterContent) {
      observer.observe(chapterContent, { childList: true, subtree: true });
    }
  }

  injectChapterQuizButton(chapterElement) {
    // Vérifier si le bouton n'existe pas déjà
    if (chapterElement.querySelector('.quiz-integration-btn')) return;

    const chapterHeader = chapterElement.querySelector('.chapter-header');
    if (chapterHeader) {
      const quizButton = document.createElement('div');
      quizButton.className = 'interactive-element info-box quiz-integration-btn';
      quizButton.innerHTML = `
        <h3>🎯 Testez vos connaissances</h3>
        <p>Pratiquez avec des quiz interactifs sur ce chapitre</p>
        <div style="display: flex; gap: 1rem; margin-top: 1rem;">
          <button class="btn" onclick="quantumQuizIntegration.openChapterQuiz('${window.workbook?.currentChapter?.id}')">
            Quiz du chapitre
          </button>
          <button class="btn btn-secondary" onclick="quantumQuizIntegration.openFlashcards('${window.workbook?.currentChapter?.id}')">
            Flashcards
          </button>
        </div>
      `;
      
      chapterHeader.insertAdjacentElement('afterend', quizButton);
    }
  }

  openQuizMode() {
    const currentChapter = window.workbook?.currentChapter?.id;
    let url = `${this.quizPath}/quiz.html`;
    
    if (currentChapter) {
      url += `?chapter=${currentChapter}&source=workbook`;
    }
    
    window.open(url, '_blank');
  }

  openChapterQuiz(chapterId) {
    const url = `${this.quizPath}/quiz.html?chapter=${chapterId}&source=workbook`;
    window.open(url, '_blank');
  }

  openFlashcards(chapterId = null) {
    let url = `${this.quizPath}/flashcards.html`;
    
    if (chapterId) {
      url += `?chapter=${chapterId}&source=workbook`;
    }
    
    window.open(url, '_blank');
  }

  setupProgressSync() {
    // Synchroniser la progression entre workbook et quiz
    this.syncProgressToQuiz();
    this.listenForQuizProgress();
  }

  syncProgressToQuiz() {
    if (!window.workbook) return;

    const workbookProgress = window.workbook.progress;
    const quizProgress = this.getQuizProgress();

    // Envoyer la progression du workbook vers quiz
    localStorage.setItem('workbook-to-quiz-progress', JSON.stringify({
      workbook: workbookProgress,
      timestamp: new Date().toISOString()
    }));
  }

  getQuizProgress() {
    try {
      const quizData = localStorage.getItem('quantum-quiz-progress');
      return quizData ? JSON.parse(quizData) : {};
    } catch (error) {
      return {};
    }
  }

  listenForQuizProgress() {
    // Écouter les changements de progression du quiz
    window.addEventListener('storage', (e) => {
      if (e.key === 'quiz-to-workbook-progress') {
        const data = JSON.parse(e.newValue);
        this.updateWorkbookFromQuiz(data);
      }
    });
  }

  updateWorkbookFromQuiz(quizData) {
    if (!window.workbook || !quizData.quiz) return;

    // Mettre à jour la progression du workbook basée sur les résultats du quiz
    Object.keys(quizData.quiz).forEach(chapterId => {
      const quizChapterData = quizData.quiz[chapterId];
      if (quizChapterData.completed > 0) {
        window.workbook.updateProgress(chapterId, 'quiz-completed');
      }
    });
  }

  addNavigationLinks() {
    // Ajouter des liens de navigation vers quantum-quiz dans le menu
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
      const integrationSection = document.createElement('div');
      integrationSection.className = 'quick-actions';
      integrationSection.innerHTML = `
        <h3>🔗 Quantum Quiz</h3>
        <button class="action-btn" onclick="quantumQuizIntegration.openQuizMode()">
          🎯 Mode Quiz
        </button>
        <button class="action-btn" onclick="quantumQuizIntegration.openFlashcards()">
          🃏 Flashcards
        </button>
        <button class="action-btn" onclick="quantumQuizIntegration.openAnimations()">
          🎬 Animations
        </button>
        <button class="action-btn" onclick="quantumQuizIntegration.openLeaderboard()">
          🏆 Classement
        </button>
      `;
      
      sidebar.appendChild(integrationSection);
    }
  }

  openAnimations() {
    window.open(`${this.quizPath}/animations-gallery.html`, '_blank');
  }

  openLeaderboard() {
    window.open(`${this.quizPath}/leaderboard.html`, '_blank');
  }

  // Méthodes pour l'export de données
  exportToQuiz() {
    const workbookData = {
      progress: window.workbook?.progress || {},
      exercises: window.exerciseEngine?.exportProgress() || {},
      timestamp: new Date().toISOString(),
      source: 'workbook'
    };

    // Sauvegarder pour que quantum-quiz puisse l'importer
    localStorage.setItem('workbook-export-data', JSON.stringify(workbookData));
    
    return workbookData;
  }

  importFromQuiz() {
    try {
      const quizData = localStorage.getItem('quiz-export-data');
      if (quizData) {
        const data = JSON.parse(quizData);
        
        // Importer dans le workbook
        if (data.progress && window.workbook) {
          Object.assign(window.workbook.progress, data.progress);
          window.workbook.saveProgress();
        }
        
        if (data.exercises && window.exerciseEngine) {
          window.exerciseEngine.importProgress(data.exercises);
        }
        
        return true;
      }
    } catch (error) {
      console.error('Erreur d\'importation depuis quiz:', error);
    }
    
    return false;
  }

  // Méthode pour créer un sous-module Git
  async setupGitSubmodule() {
    // Cette méthode serait utilisée côté serveur pour configurer
    // le workbook comme sous-module de quantum-quiz
    
    const instructions = `
# Pour intégrer le workbook comme sous-module dans quantum-quiz :

cd quantum-quiz
git submodule add [workbook-repo-url] workbook
git submodule init
git submodule update

# Ajouter dans quantum-quiz/index.html :
<a href="workbook/index.html" class="nav-link">
  📚 Workbook Interactif
</a>

# Configuration dans quantum-quiz/js/navigation.js :
const workbookIntegration = {
  available: true,
  path: './workbook/',
  features: ['progress-sync', 'cross-navigation']
};
    `;
    
    console.log(instructions);
    return instructions;
  }
}

// Initialiser l'intégration
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.quantumQuizIntegration = new QuantumQuizIntegration();
  });
} else {
  window.quantumQuizIntegration = new QuantumQuizIntegration();
}

// Export pour utilisation dans d'autres scripts
window.QuantumQuizIntegration = QuantumQuizIntegration;

// Suivi de progression pour le workbook
class ProgressTracker {
  constructor() {
    this.progress = this.loadProgress();
    this.achievements = this.loadAchievements();
    this.sessionStart = new Date();
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.startSessionTracking();
    this.updateProgressDisplay();
  }

  loadProgress() {
    const saved = localStorage.getItem('workbook-progress-detailed');
    if (saved) {
      return JSON.parse(saved);
    }
    
    return {
      chapters: {},
      exercises: {},
      simulations: {},
      overall: {
        startDate: new Date().toISOString(),
        totalTimeSpent: 0,
        chaptersCompleted: 0,
        exercisesCompleted: 0,
        correctAnswers: 0,
        totalAnswers: 0
      }
    };
  }

  loadAchievements() {
    const saved = localStorage.getItem('workbook-achievements');
    if (saved) {
      return JSON.parse(saved);
    }
    
    return {
      unlocked: [],
      progress: {}
    };
  }

  saveProgress() {
    localStorage.setItem('workbook-progress-detailed', JSON.stringify(this.progress));
    localStorage.setItem('workbook-achievements', JSON.stringify(this.achievements));
  }

  setupEventListeners() {
    // Écouter les événements de progression
    document.addEventListener('chapter-loaded', (e) => {
      this.trackChapterVisit(e.detail.chapterId);
    });

    document.addEventListener('exercise-completed', (e) => {
      this.trackExerciseCompletion(e.detail);
    });

    document.addEventListener('simulation-used', (e) => {
      this.trackSimulationUsage(e.detail);
    });

    // Sauvegarder avant de quitter
    window.addEventListener('beforeunload', () => {
      this.endSession();
    });
  }

  startSessionTracking() {
    this.sessionInterval = setInterval(() => {
      this.progress.overall.totalTimeSpent += 1; // 1 seconde
      this.saveProgress();
    }, 1000);
  }

  endSession() {
    if (this.sessionInterval) {
      clearInterval(this.sessionInterval);
    }
    
    const sessionDuration = (new Date() - this.sessionStart) / 1000;
    this.progress.overall.totalTimeSpent += sessionDuration;
    this.saveProgress();
  }

  trackChapterVisit(chapterId) {
    if (!this.progress.chapters[chapterId]) {
      this.progress.chapters[chapterId] = {
        firstVisit: new Date().toISOString(),
        visits: 0,
        timeSpent: 0,
        sectionsRead: [],
        completed: false
      };
    }
    
    this.progress.chapters[chapterId].visits++;
    this.progress.chapters[chapterId].lastVisit = new Date().toISOString();
    
    this.saveProgress();
    this.checkAchievements();
  }

  trackExerciseCompletion(exerciseData) {
    const { exerciseId, chapterId, correct, timeSpent, attempts } = exerciseData;
    
    if (!this.progress.exercises[exerciseId]) {
      this.progress.exercises[exerciseId] = {
        chapterId,
        attempts: 0,
        correctAttempts: 0,
        totalTimeSpent: 0,
        firstAttempt: new Date().toISOString(),
        bestScore: 0
      };
    }
    
    const exercise = this.progress.exercises[exerciseId];
    exercise.attempts++;
    exercise.totalTimeSpent += timeSpent || 0;
    exercise.lastAttempt = new Date().toISOString();
    
    if (correct) {
      exercise.correctAttempts++;
      this.progress.overall.correctAnswers++;
      
      // Calculer le score (basé sur le nombre d'essais et le temps)
      const score = Math.max(100 - (attempts - 1) * 20 - Math.floor(timeSpent / 10), 10);
      exercise.bestScore = Math.max(exercise.bestScore, score);
    }
    
    this.progress.overall.totalAnswers++;
    this.progress.overall.exercisesCompleted++;
    
    // Mettre à jour la progression du chapitre
    this.updateChapterProgress(chapterId);
    
    this.saveProgress();
    this.checkAchievements();
    this.updateProgressDisplay();
  }

  trackSimulationUsage(simulationData) {
    const { simulationId, chapterId, duration, interactions } = simulationData;
    
    if (!this.progress.simulations[simulationId]) {
      this.progress.simulations[simulationId] = {
        chapterId,
        uses: 0,
        totalDuration: 0,
        totalInteractions: 0,
        firstUse: new Date().toISOString()
      };
    }
    
    const simulation = this.progress.simulations[simulationId];
    simulation.uses++;
    simulation.totalDuration += duration || 0;
    simulation.totalInteractions += interactions || 0;
    simulation.lastUse = new Date().toISOString();
    
    this.saveProgress();
    this.checkAchievements();
  }

  updateChapterProgress(chapterId) {
    const chapter = this.progress.chapters[chapterId];
    if (!chapter) return;
    
    // Calculer le pourcentage de complétion basé sur les exercices
    const chapterExercises = Object.values(this.progress.exercises)
      .filter(ex => ex.chapterId === chapterId);
    
    const completedExercises = chapterExercises
      .filter(ex => ex.correctAttempts > 0).length;
    
    const totalExercises = chapterExercises.length;
    
    if (totalExercises > 0) {
      const completionPercentage = (completedExercises / totalExercises) * 100;
      chapter.completionPercentage = completionPercentage;
      
      if (completionPercentage >= 80 && !chapter.completed) {
        chapter.completed = true;
        chapter.completionDate = new Date().toISOString();
        this.progress.overall.chaptersCompleted++;
      }
    }
  }

  checkAchievements() {
    const achievements = [
      {
        id: 'first-chapter',
        name: 'Premier pas',
        description: 'Visiter votre premier chapitre',
        condition: () => Object.keys(this.progress.chapters).length >= 1,
        icon: '🚀'
      },
      {
        id: 'first-exercise',
        name: 'Première réponse',
        description: 'Compléter votre premier exercice',
        condition: () => this.progress.overall.exercisesCompleted >= 1,
        icon: '✏️'
      },
      {
        id: 'perfect-score',
        name: 'Parfait !',
        description: 'Obtenir 100% à un exercice du premier coup',
        condition: () => Object.values(this.progress.exercises)
          .some(ex => ex.bestScore === 100 && ex.attempts === 1),
        icon: '🎯'
      },
      {
        id: 'chapter-master',
        name: 'Maître du chapitre',
        description: 'Compléter entièrement un chapitre',
        condition: () => Object.values(this.progress.chapters)
          .some(ch => ch.completed),
        icon: '👑'
      },
      {
        id: 'quantum-explorer',
        name: 'Explorateur quantique',
        description: 'Utiliser 5 simulations différentes',
        condition: () => Object.keys(this.progress.simulations).length >= 5,
        icon: '🔬'
      },
      {
        id: 'persistent-learner',
        name: 'Apprenant persévérant',
        description: 'Passer plus d\'une heure sur le workbook',
        condition: () => this.progress.overall.totalTimeSpent >= 3600,
        icon: '⏰'
      },
      {
        id: 'accuracy-master',
        name: 'Précision parfaite',
        description: 'Maintenir 90% de bonnes réponses sur 10 exercices',
        condition: () => {
          const accuracy = this.progress.overall.correctAnswers / this.progress.overall.totalAnswers;
          return this.progress.overall.totalAnswers >= 10 && accuracy >= 0.9;
        },
        icon: '🎖️'
      },
      {
        id: 'quantum-graduate',
        name: 'Diplômé quantique',
        description: 'Compléter tous les chapitres',
        condition: () => this.progress.overall.chaptersCompleted >= 6,
        icon: '🎓'
      }
    ];

    achievements.forEach(achievement => {
      if (!this.achievements.unlocked.includes(achievement.id) && 
          achievement.condition()) {
        this.unlockAchievement(achievement);
      }
    });
  }

  unlockAchievement(achievement) {
    this.achievements.unlocked.push(achievement.id);
    this.achievements.progress[achievement.id] = {
      unlockedAt: new Date().toISOString()
    };
    
    this.saveProgress();
    this.showAchievementNotification(achievement);
  }

  showAchievementNotification(achievement) {
    // Créer une notification d'achievement
    const notification = document.createElement('div');
    notification.className = 'achievement-notification';
    notification.innerHTML = `
      <div class="achievement-content">
        <div class="achievement-icon">${achievement.icon}</div>
        <div class="achievement-text">
          <h4>Succès débloqué !</h4>
          <p><strong>${achievement.name}</strong></p>
          <p>${achievement.description}</p>
        </div>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Animation d'apparition
    setTimeout(() => notification.classList.add('show'), 100);
    
    // Supprimer après 5 secondes
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 5000);
    
    // Ajouter les styles si nécessaire
    this.addAchievementStyles();
  }

  addAchievementStyles() {
    if (document.getElementById('achievement-styles')) return;
    
    const styles = document.createElement('style');
    styles.id = 'achievement-styles';
    styles.textContent = `
      .achievement-notification {
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #7c3aed, #3b82f6);
        color: white;
        padding: 1rem;
        border-radius: 0.75rem;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
        transform: translateX(400px);
        transition: transform 0.3s ease;
        z-index: 1000;
        max-width: 300px;
      }
      
      .achievement-notification.show {
        transform: translateX(0);
      }
      
      .achievement-content {
        display: flex;
        align-items: center;
        gap: 1rem;
      }
      
      .achievement-icon {
        font-size: 2rem;
      }
      
      .achievement-text h4 {
        margin: 0 0 0.25rem 0;
        font-size: 0.875rem;
        opacity: 0.9;
      }
      
      .achievement-text p {
        margin: 0;
        font-size: 0.875rem;
      }
      
      .achievement-text p:first-of-type {
        font-weight: 600;
      }
    `;
    
    document.head.appendChild(styles);
  }

  updateProgressDisplay() {
    // Mettre à jour la barre de progression globale
    const progressFill = document.getElementById('overall-progress');
    const progressText = document.getElementById('progress-percentage');
    
    if (progressFill && progressText) {
      const overallProgress = this.calculateOverallProgress();
      progressFill.style.width = `${overallProgress}%`;
      progressText.textContent = `${overallProgress}%`;
    }
    
    // Mettre à jour les pourcentages des chapitres
    this.updateChapterProgressDisplay();
  }

  calculateOverallProgress() {
    const totalChapters = 6; // Nombre total de chapitres
    const completedChapters = this.progress.overall.chaptersCompleted;
    
    // Progression basée sur les chapitres complétés + progression partielle
    let partialProgress = 0;
    Object.values(this.progress.chapters).forEach(chapter => {
      if (!chapter.completed && chapter.completionPercentage) {
        partialProgress += chapter.completionPercentage / 100;
      }
    });
    
    const totalProgress = (completedChapters + partialProgress) / totalChapters;
    return Math.round(totalProgress * 100);
  }

  updateChapterProgressDisplay() {
    document.querySelectorAll('.chapter-progress').forEach(element => {
      const chapterLink = element.closest('.chapter-link');
      if (chapterLink) {
        const chapterId = chapterLink.dataset.chapter;
        const chapterProgress = this.progress.chapters[chapterId];
        
        if (chapterProgress) {
          const percentage = chapterProgress.completionPercentage || 0;
          element.textContent = `${Math.round(percentage)}%`;
          
          // Ajouter une classe pour le style
          if (percentage >= 100) {
            chapterLink.classList.add('completed');
          } else if (percentage > 0) {
            chapterLink.classList.add('in-progress');
          }
        }
      }
    });
  }

  // Méthodes pour l'interface utilisateur
  showProgressModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <span class="close">&times;</span>
        <h2>Votre Progression</h2>
        ${this.renderProgressDetails()}
      </div>
    `;
    
    document.body.appendChild(modal);
    modal.style.display = 'block';
    
    // Fermer le modal
    modal.querySelector('.close').addEventListener('click', () => {
      modal.remove();
    });
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  renderProgressDetails() {
    const stats = this.getDetailedStats();
    
    return `
      <div class="progress-details">
        <div class="progress-overview">
          <h3>Vue d'ensemble</h3>
          <div class="stats-grid">
            <div class="stat-item">
              <div class="stat-number">${stats.chaptersCompleted}</div>
              <div class="stat-label">Chapitres complétés</div>
            </div>
            <div class="stat-item">
              <div class="stat-number">${stats.exercisesCompleted}</div>
              <div class="stat-label">Exercices réalisés</div>
            </div>
            <div class="stat-item">
              <div class="stat-number">${stats.accuracy}%</div>
              <div class="stat-label">Précision</div>
            </div>
            <div class="stat-item">
              <div class="stat-number">${stats.timeSpentFormatted}</div>
              <div class="stat-label">Temps d'étude</div>
            </div>
          </div>
        </div>
        
        <div class="achievements-section">
          <h3>Succès (${this.achievements.unlocked.length}/8)</h3>
          <div class="achievements-grid">
            ${this.renderAchievements()}
          </div>
        </div>
        
        <div class="chapter-progress-section">
          <h3>Progression par chapitre</h3>
          ${this.renderChapterProgress()}
        </div>
      </div>
    `;
  }

  getDetailedStats() {
    const accuracy = this.progress.overall.totalAnswers > 0 
      ? Math.round((this.progress.overall.correctAnswers / this.progress.overall.totalAnswers) * 100)
      : 0;
    
    const timeSpent = this.progress.overall.totalTimeSpent;
    const hours = Math.floor(timeSpent / 3600);
    const minutes = Math.floor((timeSpent % 3600) / 60);
    const timeSpentFormatted = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    
    return {
      chaptersCompleted: this.progress.overall.chaptersCompleted,
      exercisesCompleted: this.progress.overall.exercisesCompleted,
      accuracy,
      timeSpentFormatted
    };
  }

  renderAchievements() {
    // Cette méthode serait complétée avec la liste complète des achievements
    return this.achievements.unlocked.map(id => `
      <div class="achievement-item unlocked">
        <div class="achievement-icon">🏆</div>
        <div class="achievement-name">${id}</div>
      </div>
    `).join('');
  }

  renderChapterProgress() {
    return Object.entries(this.progress.chapters).map(([chapterId, data]) => `
      <div class="chapter-progress-item">
        <div class="chapter-name">${chapterId}</div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${data.completionPercentage || 0}%"></div>
        </div>
        <div class="progress-percentage">${Math.round(data.completionPercentage || 0)}%</div>
      </div>
    `).join('');
  }

  // Méthodes d'export/import
  exportProgress() {
    return {
      progress: this.progress,
      achievements: this.achievements,
      exportDate: new Date().toISOString(),
      version: '1.0'
    };
  }

  importProgress(data) {
    if (data.progress) {
      this.progress = { ...this.progress, ...data.progress };
    }
    if (data.achievements) {
      this.achievements = { ...this.achievements, ...data.achievements };
    }
    this.saveProgress();
    this.updateProgressDisplay();
  }

  resetProgress() {
    if (confirm('Êtes-vous sûr de vouloir réinitialiser toute votre progression ?')) {
      localStorage.removeItem('workbook-progress-detailed');
      localStorage.removeItem('workbook-achievements');
      this.progress = this.loadProgress();
      this.achievements = this.loadAchievements();
      this.updateProgressDisplay();
    }
  }
}

// Initialiser le tracker de progression
document.addEventListener('DOMContentLoaded', () => {
  window.progressTracker = new ProgressTracker();
});

// Export pour utilisation dans d'autres scripts
window.ProgressTracker = ProgressTracker;

// Moteur d'exercices interactifs
class ExerciseEngine {
  constructor() {
    this.exercises = new Map();
    this.currentExercise = null;
    this.userAnswers = new Map();
    this.init();
  }

  init() {
    this.loadExercises();
    this.setupEventListeners();
  }

  loadExercises() {
    // Exercices pour le Chapitre 1 - États quantiques
    this.exercises.set('ch1-ex1', {
      id: 'ch1-ex1',
      chapter: 'ch1',
      title: 'Interférences quantiques',
      difficulty: 'easy',
      type: 'multiple-choice',
      question: `
        Dans l'expérience des fentes d'Young avec des photons individuels, 
        que observe-t-on sur l'écran de détection ?
      `,
      options: [
        {
          id: 'a',
          text: 'Deux taches lumineuses correspondant aux deux fentes',
          correct: false,
          explanation: 'Non, cela serait le comportement classique de particules.'
        },
        {
          id: 'b',
          text: 'Une figure d\'interférences avec des franges alternées',
          correct: true,
          explanation: 'Correct ! Même avec des photons individuels, on observe des interférences, révélant la nature ondulatoire de la lumière.'
        },
        {
          id: 'c',
          text: 'Une répartition aléatoire de points',
          correct: false,
          explanation: 'Non, la répartition suit un motif d\'interférences précis.'
        },
        {
          id: 'd',
          text: 'Aucun signal détectable',
          correct: false,
          explanation: 'Non, les photons sont bien détectés, mais selon un motif particulier.'
        }
      ]
    });

    this.exercises.set('ch1-ex2', {
      id: 'ch1-ex2',
      chapter: 'ch1',
      title: 'Amplitudes de probabilité',
      difficulty: 'medium',
      type: 'calculation',
      question: `
        Un qubit est dans l'état $|\\psi\\rangle = \\frac{1}{\\sqrt{2}}|0\\rangle + \\frac{i}{\\sqrt{2}}|1\\rangle$.
        Quelle est la probabilité de mesurer l'état $|1\\rangle$ ?
      `,
      options: [
        {
          id: 'a',
          text: '$\\frac{1}{4}$',
          correct: false,
          explanation: 'Non, vous avez oublié de prendre le module au carré de l\'amplitude.'
        },
        {
          id: 'b',
          text: '$\\frac{1}{2}$',
          correct: true,
          explanation: 'Correct ! $P(|1\\rangle) = |\\frac{i}{\\sqrt{2}}|^2 = \\frac{1}{2}$'
        },
        {
          id: 'c',
          text: '$\\frac{i}{\\sqrt{2}}$',
          correct: false,
          explanation: 'Non, ceci est l\'amplitude, pas la probabilité.'
        },
        {
          id: 'd',
          text: '$1$',
          correct: false,
          explanation: 'Non, l\'état n\'est pas dans l\'état pur $|1\\rangle$.'
        }
      ]
    });

    // Exercices pour le Chapitre 2 - Mesures et Opérateurs
    this.exercises.set('ch2-ex1', {
      id: 'ch2-ex1',
      chapter: 'ch2',
      title: 'Opérateurs de Pauli',
      difficulty: 'medium',
      type: 'multiple-choice',
      question: `
        Quelle est la valeur propre de l'opérateur $\\sigma_z$ pour l'état $|0\\rangle$ ?
      `,
      options: [
        {
          id: 'a',
          text: '$+1$',
          correct: true,
          explanation: 'Correct ! $\\sigma_z |0\\rangle = +1 |0\\rangle$'
        },
        {
          id: 'b',
          text: '$-1$',
          correct: false,
          explanation: 'Non, c\'est la valeur propre pour l\'état $|1\\rangle$.'
        },
        {
          id: 'c',
          text: '$0$',
          correct: false,
          explanation: 'Non, les valeurs propres de $\\sigma_z$ sont $\\pm 1$.'
        },
        {
          id: 'd',
          text: '$\\frac{1}{2}$',
          correct: false,
          explanation: 'Non, cette valeur n\'est pas une valeur propre de $\\sigma_z$.'
        }
      ]
    });

    // Exercices interactifs avec simulation
    this.exercises.set('ch1-sim1', {
      id: 'ch1-sim1',
      chapter: 'ch1',
      title: 'Simulation de la sphère de Bloch',
      difficulty: 'medium',
      type: 'simulation',
      question: 'Explorez l\'évolution d\'un qubit sur la sphère de Bloch',
      simulation: 'bloch-sphere'
    });
  }

  renderExercise(exerciseId, container) {
    const exercise = this.exercises.get(exerciseId);
    if (!exercise) return;

    this.currentExercise = exercise;

    if (exercise.type === 'simulation') {
      container.innerHTML = this.renderSimulationExercise(exercise);
      this.initializeSimulation(exercise.simulation, container);
    } else {
      container.innerHTML = this.renderStandardExercise(exercise);
      this.initializeStandardExercise(container);
    }
  }

  renderStandardExercise(exercise) {
    return `
      <div class="exercise-container" data-exercise-id="${exercise.id}">
        <div class="exercise-header">
          <h3 class="exercise-title">${exercise.title}</h3>
          <span class="exercise-difficulty difficulty-${exercise.difficulty}">
            ${exercise.difficulty.charAt(0).toUpperCase() + exercise.difficulty.slice(1)}
          </span>
        </div>
        
        <div class="exercise-question">
          ${exercise.question}
        </div>
        
        <div class="exercise-options">
          ${exercise.options.map(option => `
            <div class="option-item" data-option-id="${option.id}" data-correct="${option.correct}">
              <input type="radio" name="exercise-${exercise.id}" class="option-radio" id="option-${option.id}">
              <label for="option-${option.id}">${option.text}</label>
            </div>
          `).join('')}
        </div>
        
        <div class="exercise-actions">
          <button class="btn btn-submit">Vérifier la réponse</button>
          <button class="btn btn-secondary btn-hint" style="display: none;">Indice</button>
          <button class="btn btn-secondary btn-solution" style="display: none;">Voir la solution</button>
        </div>
        
        <div class="exercise-feedback" style="display: none;"></div>
      </div>
    `;
  }

  renderSimulationExercise(exercise) {
    return `
      <div class="simulation-container" data-exercise-id="${exercise.id}">
        <div class="exercise-header">
          <h3 class="exercise-title">${exercise.title}</h3>
          <span class="exercise-difficulty difficulty-${exercise.difficulty}">
            ${exercise.difficulty.charAt(0).toUpperCase() + exercise.difficulty.slice(1)}
          </span>
        </div>
        
        <div class="exercise-question">
          ${exercise.question}
        </div>
        
        <div class="simulation-area" id="simulation-${exercise.id}">
          <!-- Le contenu de la simulation sera injecté ici -->
        </div>
        
        <div class="simulation-controls">
          <div class="control-group">
            <label class="control-label">Angle θ</label>
            <input type="range" class="control-slider" id="theta-slider" min="0" max="180" value="90">
            <span id="theta-value">90°</span>
          </div>
          <div class="control-group">
            <label class="control-label">Angle φ</label>
            <input type="range" class="control-slider" id="phi-slider" min="0" max="360" value="0">
            <span id="phi-value">0°</span>
          </div>
          <div class="control-group">
            <button class="control-button" id="reset-btn">Reset</button>
            <button class="control-button" id="animate-btn">Animer</button>
          </div>
        </div>
        
        <div class="simulation-info">
          <p>État actuel: <span id="current-state">$|\\psi\\rangle = |0\\rangle$</span></p>
          <p>Probabilités: P(|0⟩) = <span id="prob-0">1.00</span>, P(|1⟩) = <span id="prob-1">0.00</span></p>
        </div>
      </div>
    `;
  }

  initializeStandardExercise(container) {
    const options = container.querySelectorAll('.option-item');
    const submitBtn = container.querySelector('.btn-submit');
    const feedback = container.querySelector('.exercise-feedback');

    // Gestion de la sélection
    options.forEach(option => {
      option.addEventListener('click', () => {
        options.forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');
        
        const radio = option.querySelector('.option-radio');
        radio.checked = true;
      });
    });

    // Gestion de la soumission
    if (submitBtn) {
      submitBtn.addEventListener('click', () => {
        const selected = container.querySelector('.option-item.selected');
        if (!selected) {
          alert('Veuillez sélectionner une réponse');
          return;
        }

        this.checkAnswer(selected, feedback, options);
      });
    }
  }

  checkAnswer(selectedOption, feedbackElement, allOptions) {
    const isCorrect = selectedOption.dataset.correct === 'true';
    const exerciseId = this.currentExercise.id;
    
    // Enregistrer la réponse
    this.userAnswers.set(exerciseId, {
      selected: selectedOption.dataset.optionId,
      correct: isCorrect,
      timestamp: new Date()
    });

    // Afficher le feedback
    allOptions.forEach(option => {
      if (option.dataset.correct === 'true') {
        option.classList.add('correct');
      } else if (option === selectedOption && !isCorrect) {
        option.classList.add('incorrect');
      }
      option.style.pointerEvents = 'none';
    });

    // Trouver l'explication
    const optionData = this.currentExercise.options.find(
      opt => opt.id === selectedOption.dataset.optionId
    );

    if (isCorrect) {
      feedbackElement.className = 'exercise-feedback feedback-correct';
      feedbackElement.innerHTML = `
        <strong>✓ Correct !</strong><br>
        ${optionData.explanation}
      `;
    } else {
      feedbackElement.className = 'exercise-feedback feedback-incorrect';
      feedbackElement.innerHTML = `
        <strong>✗ Incorrect.</strong><br>
        ${optionData.explanation}
      `;
    }

    feedbackElement.style.display = 'block';

    // Mettre à jour la progression
    if (window.workbook) {
      window.workbook.updateProgress(this.currentExercise.chapter, 'exercise-completed');
    }
  }

  initializeSimulation(simulationType, container) {
    switch (simulationType) {
      case 'bloch-sphere':
        this.initializeBlochSphere(container);
        break;
      default:
        console.warn('Type de simulation non reconnu:', simulationType);
    }
  }

  initializeBlochSphere(container) {
    const thetaSlider = container.querySelector('#theta-slider');
    const phiSlider = container.querySelector('#phi-slider');
    const thetaValue = container.querySelector('#theta-value');
    const phiValue = container.querySelector('#phi-value');
    const currentState = container.querySelector('#current-state');
    const prob0 = container.querySelector('#prob-0');
    const prob1 = container.querySelector('#prob-1');
    const resetBtn = container.querySelector('#reset-btn');
    const animateBtn = container.querySelector('#animate-btn');

    let isAnimating = false;

    const updateState = () => {
      const theta = parseFloat(thetaSlider.value) * Math.PI / 180;
      const phi = parseFloat(phiSlider.value) * Math.PI / 180;
      
      thetaValue.textContent = `${thetaSlider.value}°`;
      phiValue.textContent = `${phiSlider.value}°`;

      // Calculer les amplitudes
      const alpha = Math.cos(theta / 2);
      const beta = Math.sin(theta / 2) * Math.exp(1i * phi);

      // Calculer les probabilités
      const p0 = Math.cos(theta / 2) ** 2;
      const p1 = Math.sin(theta / 2) ** 2;

      prob0.textContent = p0.toFixed(3);
      prob1.textContent = p1.toFixed(3);

      // Afficher l'état (simplifié)
      if (Math.abs(theta) < 0.01) {
        currentState.innerHTML = '$|\\psi\\rangle = |0\\rangle$';
      } else if (Math.abs(theta - Math.PI) < 0.01) {
        currentState.innerHTML = '$|\\psi\\rangle = |1\\rangle$';
      } else if (Math.abs(phi) < 0.01) {
        currentState.innerHTML = `$|\\psi\\rangle = ${alpha.toFixed(2)}|0\\rangle + ${Math.sin(theta/2).toFixed(2)}|1\\rangle$`;
      } else {
        currentState.innerHTML = `$|\\psi\\rangle = ${alpha.toFixed(2)}|0\\rangle + ${Math.sin(theta/2).toFixed(2)}e^{i${phi.toFixed(2)}}|1\\rangle$`;
      }

      // Re-rendre MathJax
      if (window.MathJax) {
        MathJax.typesetPromise([currentState]);
      }
    };

    thetaSlider.addEventListener('input', updateState);
    phiSlider.addEventListener('input', updateState);

    resetBtn.addEventListener('click', () => {
      thetaSlider.value = 90;
      phiSlider.value = 0;
      updateState();
    });

    animateBtn.addEventListener('click', () => {
      if (isAnimating) {
        isAnimating = false;
        animateBtn.textContent = 'Animer';
        return;
      }

      isAnimating = true;
      animateBtn.textContent = 'Arrêter';

      const animate = () => {
        if (!isAnimating) return;

        phiSlider.value = (parseFloat(phiSlider.value) + 2) % 360;
        updateState();
        requestAnimationFrame(animate);
      };

      animate();
    });

    // État initial
    updateState();
  }

  getExercisesByChapter(chapterId) {
    return Array.from(this.exercises.values()).filter(ex => ex.chapter === chapterId);
  }

  getUserProgress() {
    const total = this.exercises.size;
    const completed = this.userAnswers.size;
    const correct = Array.from(this.userAnswers.values()).filter(answer => answer.correct).length;

    return {
      total,
      completed,
      correct,
      percentage: Math.round((completed / total) * 100),
      accuracy: completed > 0 ? Math.round((correct / completed) * 100) : 0
    };
  }

  exportProgress() {
    return {
      exercises: Object.fromEntries(this.exercises),
      userAnswers: Object.fromEntries(this.userAnswers),
      timestamp: new Date().toISOString()
    };
  }

  importProgress(data) {
    if (data.userAnswers) {
      this.userAnswers = new Map(Object.entries(data.userAnswers));
    }
  }
}

// Rendre disponible globalement
window.ExerciseEngine = ExerciseEngine;

// Initialiser au chargement
document.addEventListener('DOMContentLoaded', () => {
  window.exerciseEngine = new ExerciseEngine();
});

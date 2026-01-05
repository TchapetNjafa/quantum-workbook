/**
 * Simulation: Processus de Mesure Quantique
 * ==========================================
 * 
 * Cette simulation visualise comment la mesure force un système quantique
 * à se projeter sur un état propre de l'observable mesurée.
 * 
 * Concepts:
 * - Superposition avant mesure
 * - Projection sur états propres
 * - Probabilités (Règle de Born)
 * - Non-commutativité des observables
 */

class QuantumMeasurementSimulation {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) {
      console.error(`Canvas with id "${canvasId}" not found`);
      return;
    }

    this.ctx = this.canvas.getContext('2d');
    this.width = this.canvas.width;
    this.height = this.canvas.height;

    // État quantique initial (superposition)
    this.state = {
      alpha: 1 / Math.sqrt(2),
      beta: 1 / Math.sqrt(2),
      angle: Math.PI / 4
    };

    // Particules en transit
    this.particles = [];
    this.particleCount = 0;
    this.maxParticles = 100;

    // Opérateur de mesure (Sz, Sx, Sy)
    this.operator = 'Z';
    this.operators = {
      Z: { label: 'Ŝᶻ (mesure selon z)', angle: 0, color: '#3b82f6' },
      X: { label: 'Ŝˣ (mesure selon x)', angle: Math.PI / 2, color: '#ef4444' },
      Y: { label: 'Ŝʸ (mesure selon y)', angle: Math.PI / 4, color: '#10b981' }
    };

    // Statistiques
    this.measurements = {
      up: 0,
      down: 0,
      total: 0
    };

    // Animation
    this.isRunning = false;
    this.speed = 1;
    this.animationId = null;

    // Dimensions
    this.centerX = this.width / 2;
    this.centerY = this.height / 2;
    this.sphereRadius = 80;
    this.detectorDistance = 150;

    this.init();
    this.attachControls();
  }

  init() {
    this.draw();
  }

  attachControls() {
    const startBtn = document.getElementById('start-measure');
    const pauseBtn = document.getElementById('pause-measure');
    const resetBtn = document.getElementById('reset-measure');
    const operatorSelect = document.getElementById('operator-select');

    if (startBtn) {
      startBtn.addEventListener('click', () => {
        this.start();
        startBtn.textContent = '▶ Simulation en cours...';
        startBtn.disabled = true;
      });
    }

    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => {
        this.pause();
        if (startBtn) {
          startBtn.disabled = false;
          startBtn.textContent = 'Envoyer des particules';
        }
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.reset();
        if (startBtn) {
          startBtn.disabled = false;
          startBtn.textContent = 'Envoyer des particules';
        }
      });
    }

    if (operatorSelect) {
      operatorSelect.addEventListener('change', (e) => {
        this.setOperator(e.target.value);
      });
    }

    // Mettre à jour le compteur et status
    this.updateStatsInterval = setInterval(() => {
      const particleCountSpan = document.getElementById('particle-count');
      const measurementStatusSpan = document.getElementById('measurement-status');

      if (particleCountSpan) {
        particleCountSpan.textContent = this.measurements.total;
      }
      if (measurementStatusSpan) {
        measurementStatusSpan.textContent = this.isRunning ? 'Simulation en cours' : 'Arrêté';
      }
    }, 100);
  }

  /**
   * Démarre la simulation
   */
  start() {
    this.isRunning = true;
    this.animate();
  }

  /**
   * Pause la simulation
   */
  pause() {
    this.isRunning = false;
  }

  /**
   * Réinitialise la simulation
   */
  reset() {
    this.isRunning = false;
    this.particles = [];
    this.particleCount = 0;
    this.measurements = { up: 0, down: 0, total: 0 };
    this.state.angle = Math.PI / 4;
    this.state.alpha = 1 / Math.sqrt(2);
    this.state.beta = 1 / Math.sqrt(2);
    this.draw();
  }

  /**
   * Change l'opérateur de mesure
   */
  setOperator(operator) {
    if (this.operators[operator]) {
      this.operator = operator;
    }
  }

  /**
   * Boucle d'animation
   */
  animate() {
    if (this.isRunning) {
      // Ajouter une nouvelle particule
      if (Math.random() < 0.08) {
        this.addParticle();
      }

      // Mettre à jour les particules
      this.updateParticles();

      // Rendu
      this.draw();

      // Continue l'animation
      this.animationId = requestAnimationFrame(() => this.animate());
    }
  }

  /**
   * Ajoute une nouvelle particule
   */
  addParticle() {
    if (this.particles.length < this.maxParticles) {
      const particle = {
        x: this.centerX,
        y: this.centerY - 20,
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 3 + 2,
        life: 1,
        angle: this.state.angle,
        measured: false,
        result: null
      };
      this.particles.push(particle);
    }
  }

  /**
   * Met à jour les positions des particules
   */
  updateParticles() {
    this.particles = this.particles.filter((p) => {
      if (!p.measured) {
        p.y += p.vy;
        p.x += p.vx;
        p.life -= 0.01;

        // Vérifier si atteint le détecteur
        const detectorY = this.centerY + this.detectorDistance;
        if (p.y > detectorY) {
          p.measured = true;
          p.result = this.measureParticle(p);

          this.measurements.total++;
          if (p.result === 'up') {
            this.measurements.up++;
          } else {
            this.measurements.down++;
          }

          this.projectState(p.result);
        }
      } else {
        p.y += 3;
        p.life -= 0.02;
      }

      return p.life > 0;
    });
  }

  /**
   * Effectue une mesure selon la Règle de Born
   */
  measureParticle(particle) {
    const prob_up = Math.pow(Math.cos(this.state.angle), 2);
    const rand = Math.random();
    return rand < prob_up ? 'up' : 'down';
  }

  /**
   * Projette l'état après la mesure
   */
  projectState(measurementResult) {
    if (measurementResult === 'up') {
      this.state.angle *= 0.99;
    } else {
      this.state.angle = this.state.angle * 0.99 + Math.PI * 0.01;
    }

    this.state.alpha = Math.cos(this.state.angle);
    this.state.beta = Math.sin(this.state.angle);
  }

  /**
   * Rendu principal
   */
  draw() {
    this.ctx.fillStyle = '#f8fafc';
    this.ctx.fillRect(0, 0, this.width, this.height);

    this.ctx.fillStyle = '#1e293b';
    this.ctx.font = 'bold 16px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('Processus de Mesure Quantique', this.centerX, 25);

    this.ctx.font = '14px Arial';
    this.ctx.fillStyle = this.operators[this.operator].color;
    this.ctx.fillText(this.operators[this.operator].label, this.centerX, 50);

    this.drawBlochSphere();
    this.drawDetectors();
    this.drawParticles();
    this.drawStatistics();
    this.drawStateInfo();
  }

  /**
   * Dessine la sphère de Bloch
   */
  drawBlochSphere() {
    const x = this.centerX - 180;
    const y = this.centerY;
    const radius = this.sphereRadius;

    this.ctx.strokeStyle = '#cbd5e1';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, 2 * Math.PI);
    this.ctx.stroke();

    this.ctx.strokeStyle = '#94a3b8';
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([5, 5]);

    this.ctx.beginPath();
    this.ctx.moveTo(x, y - radius - 20);
    this.ctx.lineTo(x, y + radius + 20);
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.moveTo(x - radius - 20, y);
    this.ctx.lineTo(x + radius + 20, y);
    this.ctx.stroke();

    this.ctx.setLineDash([]);

    this.ctx.fillStyle = '#64748b';
    this.ctx.font = '12px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('|↑⟩', x, y - radius - 30);
    this.ctx.fillText('|↓⟩', x, y + radius + 30);
    this.ctx.fillText('|→⟩', x + radius + 30, y + 5);
    this.ctx.fillText('|←⟩', x - radius - 30, y + 5);

    const px = x + radius * Math.cos(this.state.angle - Math.PI / 2);
    const py = y + radius * Math.sin(this.state.angle - Math.PI / 2);

    this.ctx.fillStyle = '#3b82f6';
    this.ctx.beginPath();
    this.ctx.arc(px, py, 6, 0, 2 * Math.PI);
    this.ctx.fill();

    this.ctx.strokeStyle = '#60a5fa';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
    this.ctx.lineTo(px, py);
    this.ctx.stroke();

    this.ctx.fillStyle = '#1e293b';
    this.ctx.font = '11px Arial';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(`α ≈ ${Math.abs(this.state.alpha).toFixed(2)}`, x + 110, y - 50);
    this.ctx.fillText(`β ≈ ${Math.abs(this.state.beta).toFixed(2)}`, x + 110, y - 30);
  }

  /**
   * Dessine les détecteurs
   */
  drawDetectors() {
    const x = this.centerX + 100;
    const detectorWidth = 60;
    const detectorHeight = 40;

    this.ctx.fillStyle = '#e0f2fe';
    this.ctx.strokeStyle = '#0284c7';
    this.ctx.lineWidth = 2;
    this.ctx.fillRect(x - detectorWidth / 2, this.centerY - 100 - detectorHeight / 2, detectorWidth, detectorHeight);
    this.ctx.strokeRect(x - detectorWidth / 2, this.centerY - 100 - detectorHeight / 2, detectorWidth, detectorHeight);

    this.ctx.fillStyle = '#0284c7';
    this.ctx.font = 'bold 12px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('|↑⟩', x, this.centerY - 100 + 5);

    this.ctx.fillStyle = '#fce7f3';
    this.ctx.strokeStyle = '#be185d';
    this.ctx.lineWidth = 2;
    this.ctx.fillRect(x - detectorWidth / 2, this.centerY + 100 - detectorHeight / 2, detectorWidth, detectorHeight);
    this.ctx.strokeRect(x - detectorWidth / 2, this.centerY + 100 - detectorHeight / 2, detectorWidth, detectorHeight);

    this.ctx.fillStyle = '#be185d';
    this.ctx.font = 'bold 12px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('|↓⟩', x, this.centerY + 100 + 5);
  }

  /**
   * Dessine les particules
   */
  drawParticles() {
    this.particles.forEach((p) => {
      if (!p.measured) {
        this.ctx.fillStyle = `rgba(59, 130, 246, ${p.life})`;
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, 4, 0, 2 * Math.PI);
        this.ctx.fill();
      } else {
        const color = p.result === 'up' ? '#0284c7' : '#be185d';
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, 3, 0, 2 * Math.PI);
        this.ctx.fill();
      }
    });
  }

  /**
   * Affiche les statistiques
   */
  drawStatistics() {
    const x = 20;
    let y = 100;

    this.ctx.fillStyle = '#1e293b';
    this.ctx.font = 'bold 13px Arial';
    this.ctx.textAlign = 'left';
    this.ctx.fillText('Statistiques:', x, y);

    y += 25;
    this.ctx.font = '12px Arial';

    this.ctx.fillStyle = '#475569';
    this.ctx.fillText(`Total: ${this.measurements.total}`, x, y);
    y += 20;

    const probUp = this.measurements.total > 0 
      ? (this.measurements.up / this.measurements.total * 100).toFixed(1) 
      : 0;
    this.ctx.fillStyle = '#0284c7';
    this.ctx.fillText(`|↑⟩: ${this.measurements.up} (${probUp}%)`, x, y);
    y += 20;

    const probDown = this.measurements.total > 0 
      ? (this.measurements.down / this.measurements.total * 100).toFixed(1) 
      : 0;
    this.ctx.fillStyle = '#be185d';
    this.ctx.fillText(`|↓⟩: ${this.measurements.down} (${probDown}%)`, x, y);

    y += 30;
    this.ctx.fillStyle = '#cbd5e1';
    this.ctx.fillRect(x, y, 140, 20);

    if (this.measurements.total > 0) {
      this.ctx.fillStyle = '#0284c7';
      const upWidth = (this.measurements.up / this.measurements.total) * 140;
      this.ctx.fillRect(x, y, upWidth, 20);

      this.ctx.fillStyle = '#64748b';
      this.ctx.font = '10px Arial';
      this.ctx.textAlign = 'center';
      if (upWidth > 30) {
        this.ctx.fillText(`${probUp}%`, x + upWidth / 2, y + 14);
      }
    }
  }

  /**
   * Affiche les informations d'état
   */
  drawStateInfo() {
    const x = this.width - 220;
    const y = 100;

    this.ctx.fillStyle = '#1e293b';
    this.ctx.font = 'bold 13px Arial';
    this.ctx.textAlign = 'left';
    this.ctx.fillText('État quantique:', x, y);

    this.ctx.font = '11px Arial';
    this.ctx.fillStyle = '#475569';

    let line = y + 25;
    const alpha = this.state.alpha.toFixed(3);
    const beta = this.state.beta.toFixed(3);

    this.ctx.fillText(`|ψ⟩ = ${alpha}|↑⟩`, x, line);
    line += 18;
    this.ctx.fillText(`    + ${beta}|↓⟩`, x, line);

    line += 30;
    this.ctx.fillStyle = '#1e293b';
    this.ctx.font = 'bold 13px Arial';
    this.ctx.fillText('Théorie:', x, line);

    this.ctx.font = '11px Arial';
    this.ctx.fillStyle = '#475569';
    line += 20;
    const theoryUp = Math.pow(Math.cos(this.state.angle), 2).toFixed(3);
    this.ctx.fillText(`P(↑) = ${theoryUp}`, x, line);
    line += 18;
    const theoryDown = Math.pow(Math.sin(this.state.angle), 2).toFixed(3);
    this.ctx.fillText(`P(↓) = ${theoryDown}`, x, line);

    line += 30;
    this.ctx.fillStyle = '#64748b';
    this.ctx.font = '10px Arial';
    this.ctx.fillText('Règle de Born:', x, line);
    this.ctx.font = '9px Arial';
    line += 15;
    this.ctx.fillText('P(a) = |⟨a|ψ⟩|²', x, line);
  }

  setSpeed(speed) {
    this.speed = speed;
  }

  destroy() {
    if (this.updateStatsInterval) {
      clearInterval(this.updateStatsInterval);
    }
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
  }
}

// Initialisation globale
window.QuantumMeasurementSimulation = QuantumMeasurementSimulation;

// Si le canvas existe déjà (page chargée normalement)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('measurement-canvas');
    if (canvas && !window.measurementSimulation) {
      window.measurementSimulation = new QuantumMeasurementSimulation('measurement-canvas');
    }
  });
} else {
  // Si la page est déjà chargée (chapitre chargé dynamiquement)
  const canvas = document.getElementById('measurement-canvas');
  if (canvas && !window.measurementSimulation) {
    window.measurementSimulation = new QuantumMeasurementSimulation('measurement-canvas');
  }
}


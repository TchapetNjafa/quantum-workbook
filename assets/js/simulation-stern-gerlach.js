/**
 * Simulation: Expérience de Stern-Gerlach
 * ========================================
 * 
 * Visualisation interactive de l'expérience historique de Stern-Gerlach
 * qui démontre la quantification du spin.
 */

class SternGerlachSimulation {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) {
      console.error(`Canvas with id "${canvasId}" not found`);
      return;
    }

    this.ctx = this.canvas.getContext('2d');
    this.width = this.canvas.width;
    this.height = this.canvas.height;

    // État de la simulation
    this.isRunning = false;
    this.animationId = null;
    this.atoms = [];
    this.frameCount = 0;
    
    // Statistiques
    this.totalAtoms = 0;
    this.atomsUp = 0;
    this.atomsDown = 0;
    this.atomsCreated = 0;

    // Paramètres
    this.magneticAngle = 90;
    this.atomCreationInterval = 10; // Créer un atome tous les 10 frames

    // Dimensions et positions
    this.apparatus = {
      x: 80,
      y: 50,
      width: 250,
      height: 300,
      entryX: 20,
      entryY: 200
    };

    // Zone de mesure (après le champ magnétique)
    this.measurementZone = {
      x: this.apparatus.x + this.apparatus.width + 20,
      width: 100
    };

    this.setupControls();
    this.draw();
  }

  setupControls() {
    const startBtn = document.getElementById('sg-start');
    const pauseBtn = document.getElementById('sg-pause');
    const resetBtn = document.getElementById('sg-reset');
    const angleSlider = document.getElementById('sg-angle');

    if (startBtn) {
      startBtn.onclick = (e) => {
        e.preventDefault();
        this.start();
      };
    }

    if (pauseBtn) {
      pauseBtn.onclick = (e) => {
        e.preventDefault();
        this.pause();
      };
    }

    if (resetBtn) {
      resetBtn.onclick = (e) => {
        e.preventDefault();
        this.reset();
      };
    }

    if (angleSlider) {
      angleSlider.oninput = (e) => {
        this.magneticAngle = parseFloat(e.target.value);
        const display = document.getElementById('sg-angle-display');
        if (display) {
          display.textContent = this.magneticAngle + '°';
        }
        // Réinitialiser les atomes en cours pour appliquer le nouvel angle
        this.atoms = [];
      };
    }
  }

  start() {
    this.isRunning = true;
    this.animate();
  }

  pause() {
    this.isRunning = false;
  }

  reset() {
    this.isRunning = false;
    this.atoms = [];
    this.totalAtoms = 0;
    this.atomsUp = 0;
    this.atomsDown = 0;
    this.atomsCreated = 0;
    this.frameCount = 0;
    this.updateStats();
    this.draw();
  }

  animate() {
    if (!this.isRunning) return;

    this.frameCount++;

    // Ajouter un nouvel atome tous les N frames (max 100 atomes)
    if (this.frameCount % this.atomCreationInterval === 0 && this.atomsCreated < 100) {
      this.addAtom();
      this.atomsCreated++;
    }

    // Mettre à jour les atomes
    this.updateAtoms();

    // Dessiner
    this.draw();

    // Continuer l'animation
    this.animationId = requestAnimationFrame(() => this.animate());
  }

  addAtom() {
    // 50% de chance spin up, 50% spin down
    const spinUp = Math.random() < 0.5;
    
    // Calculer la déviation basée sur l'angle du champ magnétique
    const rad = (this.magneticAngle - 90) * Math.PI / 180;
    
    // Amplitude de la déviation (augmentée pour visibilité)
    const deviationStrength = 3.0;
    const deviationMagnitude = spinUp ? -deviationStrength : deviationStrength;
    
    // Direction de la déviation (perpendiculaire au champ magnétique)
    const deviationAngle = rad + Math.PI / 2;
    const deviationVelX = Math.cos(deviationAngle) * deviationMagnitude;
    const deviationVelY = Math.sin(deviationAngle) * deviationMagnitude;
    
    const atom = {
      x: this.apparatus.entryX,
      y: this.apparatus.entryY,
      spinUp: spinUp,
      velocityX: 2.0, // Mouvement horizontal constant
      deviationVelX: deviationVelX * 0.5, // Appliquer seulement après champ magnétique
      deviationVelY: deviationVelY * 0.5,
      alpha: 1.0,
      counted: false,
      creationFrame: this.frameCount,
      inField: false // Suivre si l'atome est dans le champ
    };

    this.atoms.push(atom);
    console.log(`Atome créé #${this.atomsCreated} (${spinUp ? 'UP' : 'DOWN'}) à frame ${this.frameCount}`);
  }

  updateAtoms() {
    this.atoms = this.atoms.filter((atom) => {
      // Phase 1: Mouvement horizontal initial (avant le champ)
      atom.x += atom.velocityX;

      // Phase 2: Vérifier si l'atome est dans le champ magnétique
      const isInMagneticField = (
        atom.x >= this.apparatus.x &&
        atom.x <= (this.apparatus.x + this.apparatus.width)
      );

      if (isInMagneticField) {
        atom.inField = true;
        // Appliquer la déviation SEULEMENT quand dans le champ
        atom.y += atom.deviationVelY;
        atom.x += atom.deviationVelX;
      }

      // Phase 3: Vérifier si l'atome a quitté le champ magnétique
      const hasLeftField = atom.x > (this.apparatus.x + this.apparatus.width);

      // Phase 4: Compter l'atome une seule fois à la sortie du champ
      if (hasLeftField && !atom.counted && atom.inField) {
        atom.counted = true;
        this.totalAtoms++;
        
        // Déterminer le chemin (haut ou bas) basé sur la position Y finale
        // et l'orientation du champ magnétique
        if (atom.spinUp) {
          this.atomsUp++;
        } else {
          this.atomsDown++;
        }
        
        console.log(`Atome compté: ${atom.spinUp ? 'UP' : 'DOWN'}, Total: ${this.totalAtoms}`);
        this.updateStats();
      }

      // Phase 5: Fade out et suppression
      atom.alpha -= 0.008;

      // Garder l'atome tant qu'il est visible
      return atom.alpha > 0 && atom.x < (this.width + 100);
    });
  }

  updateStats() {
    const countEl = document.getElementById('sg-count');
    const upEl = document.getElementById('sg-up');
    const downEl = document.getElementById('sg-down');
    const probEl = document.getElementById('sg-prob-up');

    if (countEl) countEl.textContent = this.totalAtoms;
    if (upEl) upEl.textContent = this.atomsUp;
    if (downEl) downEl.textContent = this.atomsDown;

    if (probEl) {
      const prob = this.totalAtoms > 0 
        ? Math.round((this.atomsUp / this.totalAtoms) * 100)
        : 0;
      probEl.textContent = prob + '%';
    }

    console.log(`Stats: Total=${this.totalAtoms}, Up=${this.atomsUp}, Down=${this.atomsDown}, Prob=${(this.totalAtoms > 0 ? (this.atomsUp/this.totalAtoms*100).toFixed(1) : 0)}%, Angle=${this.magneticAngle}°`);
  }

  draw() {
    // Fond
    this.ctx.fillStyle = '#f8fafc';
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Titre
    this.ctx.fillStyle = '#1e293b';
    this.ctx.font = 'bold 14px Arial';
    this.ctx.textAlign = 'left';
    this.ctx.fillText('Expérience de Stern-Gerlach', 10, 25);

    // Source
    this.drawSource();

    // Appareil (champ magnétique)
    this.drawApparatus();

    // Champ magnétique (flèche)
    this.drawMagneticField();

    // Zones de détection
    this.drawDetectorZones();

    // Atomes
    this.drawAtoms();

    // Légende
    this.drawLegend();
  }

  drawSource() {
    // Cercle source
    this.ctx.fillStyle = '#64748b';
    this.ctx.beginPath();
    this.ctx.arc(this.apparatus.entryX, this.apparatus.entryY, 5, 0, 2 * Math.PI);
    this.ctx.fill();

    // Flèche d'entrée
    this.ctx.strokeStyle = '#64748b';
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([3, 3]);
    this.ctx.beginPath();
    this.ctx.moveTo(this.apparatus.entryX - 20, this.apparatus.entryY);
    this.ctx.lineTo(this.apparatus.entryX, this.apparatus.entryY);
    this.ctx.stroke();
    this.ctx.setLineDash([]);

    // Label
    this.ctx.fillStyle = '#475569';
    this.ctx.font = '10px Arial';
    this.ctx.textAlign = 'right';
    this.ctx.fillText('Source', this.apparatus.entryX - 25, this.apparatus.entryY - 5);
  }

  drawApparatus() {
    // Rectangle du champ magnétique
    this.ctx.strokeStyle = '#94a3b8';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([5, 5]);
    this.ctx.strokeRect(
      this.apparatus.x,
      this.apparatus.y,
      this.apparatus.width,
      this.apparatus.height
    );
    this.ctx.setLineDash([]);

    // Label de l'appareil
    this.ctx.fillStyle = '#475569';
    this.ctx.font = 'bold 12px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(
      'Appareil de Stern-Gerlach',
      this.apparatus.x + this.apparatus.width / 2,
      this.apparatus.y - 10
    );

    this.ctx.font = '10px Arial';
    this.ctx.fillStyle = '#64748b';
    this.ctx.fillText(
      '(Champ magnétique inhomogène)',
      this.apparatus.x + this.apparatus.width / 2,
      this.apparatus.y - 25
    );
  }

  drawMagneticField() {
    const centerX = this.apparatus.x + this.apparatus.width / 2;
    const centerY = this.apparatus.y + this.apparatus.height / 2;

    // Convertir angle en radians
    const rad = (this.magneticAngle - 90) * Math.PI / 180;
    const length = 50;

    const startX = centerX - Math.cos(rad) * length / 2;
    const startY = centerY - Math.sin(rad) * length / 2;
    const endX = centerX + Math.cos(rad) * length / 2;
    const endY = centerY + Math.sin(rad) * length / 2;

    // Flèche rouge du champ magnétique
    this.ctx.strokeStyle = '#ef4444';
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.moveTo(startX, startY);
    this.ctx.lineTo(endX, endY);
    this.ctx.stroke();

    // Pointe de flèche
    const headlen = 10;
    const angle = Math.atan2(endY - startY, endX - startX);
    this.ctx.beginPath();
    this.ctx.moveTo(endX, endY);
    this.ctx.lineTo(endX - headlen * Math.cos(angle - Math.PI / 6), 
                    endY - headlen * Math.sin(angle - Math.PI / 6));
    this.ctx.moveTo(endX, endY);
    this.ctx.lineTo(endX - headlen * Math.cos(angle + Math.PI / 6), 
                    endY - headlen * Math.sin(angle + Math.PI / 6));
    this.ctx.stroke();

    // Angle affiché
    this.ctx.fillStyle = '#ef4444';
    this.ctx.font = 'bold 11px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`θ = ${this.magneticAngle}°`, centerX, centerY - 45);
  }

  drawDetectorZones() {
    const detectorX = this.apparatus.x + this.apparatus.width + 30;

    // Zone haut (spin up)
    this.ctx.strokeStyle = '#0284c7';
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([2, 2]);
    this.ctx.strokeRect(
      detectorX,
      this.apparatus.y,
      this.measurementZone.width,
      this.apparatus.height / 2
    );
    this.ctx.setLineDash([]);

    // Zone bas (spin down)
    this.ctx.strokeStyle = '#be185d';
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([2, 2]);
    this.ctx.strokeRect(
      detectorX,
      this.apparatus.y + this.apparatus.height / 2,
      this.measurementZone.width,
      this.apparatus.height / 2
    );
    this.ctx.setLineDash([]);

    // Labels
    this.ctx.fillStyle = '#0284c7';
    this.ctx.font = 'bold 11px Arial';
    this.ctx.textAlign = 'left';
    this.ctx.fillText('↑ Détecteur haut', detectorX + 5, this.apparatus.y + 20);

    this.ctx.fillStyle = '#be185d';
    this.ctx.fillText('↓ Détecteur bas', detectorX + 5, this.apparatus.y + this.apparatus.height - 10);
  }

  drawAtoms() {
    this.atoms.forEach((atom) => {
      this.ctx.save();
      this.ctx.globalAlpha = atom.alpha;
      
      const color = atom.spinUp ? '#0284c7' : '#be185d';
      this.ctx.fillStyle = color;
      
      // Dessiner l'atome (cercle)
      this.ctx.beginPath();
      this.ctx.arc(atom.x, atom.y, 4, 0, 2 * Math.PI);
      this.ctx.fill();

      // Bordure
      this.ctx.strokeStyle = atom.spinUp ? '#0c4a6e' : '#831843';
      this.ctx.lineWidth = 1;
      this.ctx.stroke();

      this.ctx.restore();
    });
  }

  drawLegend() {
    const x = 10;
    let y = this.height - 95;

    // Titre
    this.ctx.fillStyle = '#1e293b';
    this.ctx.font = 'bold 12px Arial';
    this.ctx.textAlign = 'left';
    this.ctx.fillText('Statistiques:', x, y);

    y += 18;
    this.ctx.font = '11px Arial';
    this.ctx.fillStyle = '#475569';

    const probUp = this.totalAtoms > 0 
      ? ((this.atomsUp / this.totalAtoms) * 100).toFixed(1)
      : 0;
    const probDown = this.totalAtoms > 0
      ? ((this.atomsDown / this.totalAtoms) * 100).toFixed(1)
      : 0;

    this.ctx.fillText(`Atomes mesurés: ${this.totalAtoms}/100`, x, y);
    
    y += 16;
    this.ctx.fillStyle = '#0284c7';
    this.ctx.fillText(`↑ Spin up: ${this.atomsUp} (${probUp}%)`, x, y);
    
    y += 16;
    this.ctx.fillStyle = '#be185d';
    this.ctx.fillText(`↓ Spin down: ${this.atomsDown} (${probDown}%)`, x, y);

    // Barre de progression
    y += 20;
    const barWidth = 200;
    const barHeight = 14;

    // Fond gris
    this.ctx.fillStyle = '#e2e8f0';
    this.ctx.fillRect(x, y, barWidth, barHeight);

    // Sections colorées
    if (this.totalAtoms > 0) {
      // Spin up (bleu)
      this.ctx.fillStyle = '#0284c7';
      const filledWidth = (this.atomsUp / 100) * barWidth;
      this.ctx.fillRect(x, y, filledWidth, barHeight);

      // Spin down (rose)
      this.ctx.fillStyle = '#be185d';
      this.ctx.fillRect(x + filledWidth, y, (this.atomsDown / 100) * barWidth, barHeight);
    }

    // Bordure
    this.ctx.strokeStyle = '#94a3b8';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x, y, barWidth, barHeight);

    // Marqueurs à 50%
    this.ctx.strokeStyle = '#cbd5e1';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(x + barWidth / 2, y);
    this.ctx.lineTo(x + barWidth / 2, y + barHeight);
    this.ctx.stroke();
  }

  destroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    this.isRunning = false;
  }
}

// Export global
window.SternGerlachSimulation = SternGerlachSimulation;

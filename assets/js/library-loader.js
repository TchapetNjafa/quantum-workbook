// Loader de bibliothèques locales
class LibraryLoader {
  constructor() {
    this.loadedLibraries = new Set();
  }

  async loadMathJax() {
    if (window.MathJax || this.loadedLibraries.has('mathjax')) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'assets/libs/mathjax.js';
      script.id = 'MathJax-script';
      script.async = true;
      script.onload = () => {
        // Wait for MathJax to be fully ready
        if (window.MathJax && window.MathJax.startup) {
          window.MathJax.startup.promise.then(() => {
            this.loadedLibraries.add('mathjax');
            console.log('MathJax entièrement chargé et prêt');
            resolve();
          }).catch(err => {
            console.warn('MathJax startup promise failed, but continuing:', err);
            this.loadedLibraries.add('mathjax');
            resolve();
          });
        } else {
          this.loadedLibraries.add('mathjax');
          resolve();
        }
      };
      script.onerror = () => reject(new Error('Erreur de chargement MathJax'));
      document.head.appendChild(script);
    });
  }

  async loadJsPDF() {
    if (window.jsPDF || this.loadedLibraries.has('jspdf')) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'assets/libs/jspdf.min.js';
      script.onload = () => {
        this.loadedLibraries.add('jspdf');
        resolve();
      };
      script.onerror = () => reject(new Error('Erreur de chargement jsPDF'));
      document.head.appendChild(script);
    });
  }

  async loadThreeJS() {
    if (window.THREE || this.loadedLibraries.has('threejs')) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'assets/libs/three.min.js';
      script.onload = () => {
        // Wait a bit to ensure Three.js is fully initialized
        setTimeout(() => {
          this.loadedLibraries.add('threejs');
          console.log('Three.js chargé et prêt');
          resolve();
        }, 100);
      };
      script.onerror = () => reject(new Error('Erreur de chargement Three.js'));
      document.head.appendChild(script);
    });
  }

  async loadAll() {
    try {
      // Load libraries sequentially to ensure proper initialization order
      await this.loadMathJax();
      await this.loadJsPDF();
      await this.loadThreeJS();
      console.log('Toutes les bibliothèques chargées');
      return true;
    } catch (error) {
      console.error('Erreur de chargement des bibliothèques:', error);
      return false;
    }
  }

  isLibraryLoaded(name) {
    return this.loadedLibraries.has(name);
  }

  getLoadedLibraries() {
    return Array.from(this.loadedLibraries);
  }
}

// Instance globale
window.libraryLoader = new LibraryLoader();

// Auto-chargement au démarrage
document.addEventListener('DOMContentLoaded', () => {
  window.libraryLoader.loadAll();
});

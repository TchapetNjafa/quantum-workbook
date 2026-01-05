// Configuration MathJax pour le rendu LaTeX - OPTIMISÉE
window.MathJax = {
  tex: {
    inlineMath: [['$', '$'], ['\\(', '\\)']],
    displayMath: [['$$', '$$'], ['\\[', '\\]']],
    processEscapes: true,
    processEnvironments: true,
    maxMacros: 10000,
    maxBuffer: 50*1024,
    // Inclusion de tous les paquets nécessaires
    packages: {'[+]': ['base', 'ams', 'braket', 'physics']}
    // NOTE: Les macros ket, bra, etc. sont fournies par les paquets braket/physics
    // Les définir localement cause une récursion - laissons les paquets les gérer
  },
  chtml: {
    scale: 1,
    matchFontHeight: true
  },
  loader: {
    load: ['[tex]/braket', '[tex]/physics']
  },
  startup: {
    typeset: true,
    ready: () => {
      MathJax.startup.defaultReady();
      MathJax.startup.promise.then(() => {
        if (!window.MathJax.initializedPromise) {
          window.MathJax.initializedPromise = Promise.resolve();
        }
        console.log('✓ MathJax chargé avec braket et physics');
      });
    }
  },
  options: {
    renderActions: {
      addMenu: []
    }
  }
};

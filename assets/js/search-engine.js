// Moteur de recherche pour le workbook
class SearchEngine {
  constructor() {
    this.searchIndex = new Map();
    this.searchResults = [];
    this.isIndexed = false;
    this.init();
  }

  init() {
    this.setupSearchInterface();
    this.buildSearchIndex();
  }

  setupSearchInterface() {
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.performSearch(e.target.value);
      });
      
      searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.performSearch(e.target.value);
        }
      });
    }
    
    if (searchBtn) {
      searchBtn.addEventListener('click', () => {
        const query = searchInput?.value || '';
        this.performSearch(query);
      });
    }
  }

  async buildSearchIndex() {
    console.log('Construction de l\'index de recherche...');
    
    // Indexer le contenu des chapitres
    for (const chapter of window.workbook?.chapters || []) {
      await this.indexChapter(chapter);
    }
    
    // Indexer les exercices
    if (window.exerciseEngine) {
      this.indexExercises();
    }
    
    this.isIndexed = true;
    console.log('Index de recherche construit:', this.searchIndex.size, 'entrées');
  }

  async indexChapter(chapter) {
    try {
      // Charger le contenu du chapitre
      const response = await fetch(chapter.file);
      let content = '';
      
      if (response.ok) {
        content = await response.text();
      } else {
        // Utiliser le contenu généré si le fichier n'existe pas
        content = this.getGeneratedChapterContent(chapter);
      }
      
      // Parser et indexer le contenu
      const parser = new DOMParser();
      const doc = parser.parseFromString(content, 'text/html');
      
      this.indexElement(doc.body, chapter.id, chapter.title);
      
    } catch (error) {
      console.error('Erreur d\'indexation du chapitre:', chapter.id, error);
    }
  }

  getGeneratedChapterContent(chapter) {
    // Contenu de base pour l'indexation
    return `
      <h1>${chapter.title}</h1>
      <p>${chapter.subtitle}</p>
      ${chapter.sections.map(section => `<h2>${section}</h2>`).join('')}
    `;
  }

  indexElement(element, chapterId, chapterTitle, sectionTitle = '') {
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
      null,
      false
    );

    let currentSection = sectionTitle;
    let node;

    while (node = walker.nextNode()) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        // Détecter les nouvelles sections
        if (node.tagName.match(/^H[1-6]$/)) {
          currentSection = node.textContent.trim();
        }
      } else if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent.trim();
        if (text.length > 3) {
          this.addToIndex(text, chapterId, chapterTitle, currentSection);
        }
      }
    }
  }

  addToIndex(text, chapterId, chapterTitle, sectionTitle) {
    // Nettoyer et tokeniser le texte
    const words = this.tokenize(text);
    
    words.forEach(word => {
      if (word.length > 2) {
        const key = word.toLowerCase();
        
        if (!this.searchIndex.has(key)) {
          this.searchIndex.set(key, []);
        }
        
        this.searchIndex.get(key).push({
          chapterId,
          chapterTitle,
          sectionTitle,
          context: this.getContext(text, word),
          relevance: this.calculateRelevance(word, sectionTitle)
        });
      }
    });
  }

  tokenize(text) {
    // Tokenisation simple - peut être améliorée
    return text
      .replace(/[^\w\s\u00C0-\u017F]/g, ' ') // Garder les accents
      .split(/\s+/)
      .filter(word => word.length > 0);
  }

  getContext(text, word) {
    const index = text.toLowerCase().indexOf(word.toLowerCase());
    const start = Math.max(0, index - 50);
    const end = Math.min(text.length, index + word.length + 50);
    
    let context = text.substring(start, end);
    
    if (start > 0) context = '...' + context;
    if (end < text.length) context = context + '...';
    
    return context;
  }

  calculateRelevance(word, sectionTitle) {
    let relevance = 1;
    
    // Mots-clés quantiques ont plus de poids
    const quantumKeywords = [
      'qubit', 'superposition', 'intrication', 'amplitude', 'probabilité',
      'mesure', 'opérateur', 'hamiltonien', 'schrödinger', 'heisenberg',
      'pauli', 'bloch', 'hilbert', 'fock', 'cohérent'
    ];
    
    if (quantumKeywords.includes(word.toLowerCase())) {
      relevance += 2;
    }
    
    // Mots dans les titres ont plus de poids
    if (sectionTitle.toLowerCase().includes(word.toLowerCase())) {
      relevance += 1;
    }
    
    return relevance;
  }

  indexExercises() {
    const exercises = window.exerciseEngine?.exercises;
    if (!exercises) return;
    
    exercises.forEach((exercise, id) => {
      // Indexer la question
      this.addToIndex(
        exercise.question,
        exercise.chapter,
        `Exercice: ${exercise.title}`,
        'Exercice'
      );
      
      // Indexer les options
      if (exercise.options) {
        exercise.options.forEach(option => {
          this.addToIndex(
            option.text,
            exercise.chapter,
            `Exercice: ${exercise.title}`,
            'Options'
          );
        });
      }
    });
  }

  performSearch(query) {
    if (!query || query.length < 2) {
      this.displayResults([]);
      return;
    }
    
    if (!this.isIndexed) {
      console.log('Index en cours de construction...');
      return;
    }
    
    const results = this.search(query);
    this.displayResults(results);
  }

  search(query) {
    const terms = this.tokenize(query);
    const results = new Map();
    
    terms.forEach(term => {
      const termLower = term.toLowerCase();
      
      // Recherche exacte
      if (this.searchIndex.has(termLower)) {
        this.searchIndex.get(termLower).forEach(entry => {
          const key = `${entry.chapterId}-${entry.sectionTitle}`;
          
          if (!results.has(key)) {
            results.set(key, {
              ...entry,
              score: 0,
              matchedTerms: []
            });
          }
          
          const result = results.get(key);
          result.score += entry.relevance;
          result.matchedTerms.push(term);
        });
      }
      
      // Recherche partielle
      this.searchIndex.forEach((entries, indexedTerm) => {
        if (indexedTerm.includes(termLower) && indexedTerm !== termLower) {
          entries.forEach(entry => {
            const key = `${entry.chapterId}-${entry.sectionTitle}`;
            
            if (!results.has(key)) {
              results.set(key, {
                ...entry,
                score: 0,
                matchedTerms: []
              });
            }
            
            const result = results.get(key);
            result.score += entry.relevance * 0.5; // Score réduit pour correspondance partielle
            if (!result.matchedTerms.includes(term)) {
              result.matchedTerms.push(term);
            }
          });
        }
      });
    });
    
    // Trier par score et retourner les meilleurs résultats
    return Array.from(results.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);
  }

  displayResults(results) {
    const searchContainer = document.getElementById('search-container');
    if (!searchContainer) return;
    
    // Supprimer les anciens résultats
    let resultsContainer = document.getElementById('search-results');
    if (resultsContainer) {
      resultsContainer.remove();
    }
    
    if (results.length === 0) {
      return;
    }
    
    // Créer le conteneur de résultats
    resultsContainer = document.createElement('div');
    resultsContainer.id = 'search-results';
    resultsContainer.className = 'search-results';
    
    resultsContainer.innerHTML = `
      <div class="search-results-header">
        <h3>Résultats de recherche (${results.length})</h3>
        <button class="close-results" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
      <div class="search-results-list">
        ${results.map(result => this.renderSearchResult(result)).join('')}
      </div>
    `;
    
    searchContainer.insertAdjacentElement('afterend', resultsContainer);
    
    // Ajouter les styles si nécessaire
    this.addSearchStyles();
  }

  renderSearchResult(result) {
    const highlightedContext = this.highlightTerms(result.context, result.matchedTerms);
    
    return `
      <div class="search-result-item" onclick="searchEngine.navigateToResult('${result.chapterId}', '${result.sectionTitle}')">
        <div class="search-result-header">
          <h4>${result.chapterTitle}</h4>
          <span class="search-result-section">${result.sectionTitle}</span>
        </div>
        <div class="search-result-context">${highlightedContext}</div>
        <div class="search-result-score">Score: ${result.score.toFixed(1)}</div>
      </div>
    `;
  }

  highlightTerms(text, terms) {
    let highlighted = text;
    
    terms.forEach(term => {
      const regex = new RegExp(`(${term})`, 'gi');
      highlighted = highlighted.replace(regex, '<mark>$1</mark>');
    });
    
    return highlighted;
  }

  navigateToResult(chapterId, sectionTitle) {
    // Charger le chapitre
    if (window.workbook) {
      window.workbook.loadChapter(chapterId);
    }
    
    // Fermer les résultats de recherche
    const resultsContainer = document.getElementById('search-results');
    if (resultsContainer) {
      resultsContainer.remove();
    }
    
    // Scroll vers la section (après un délai pour laisser le chapitre se charger)
    setTimeout(() => {
      this.scrollToSection(sectionTitle);
    }, 500);
  }

  scrollToSection(sectionTitle) {
    const chapterContent = document.getElementById('chapter-content');
    if (!chapterContent) return;
    
    // Chercher l'élément contenant le titre de section
    const walker = document.createTreeWalker(
      chapterContent,
      NodeFilter.SHOW_ELEMENT,
      null,
      false
    );
    
    let node;
    while (node = walker.nextNode()) {
      if (node.tagName.match(/^H[1-6]$/) && 
          node.textContent.trim().includes(sectionTitle)) {
        node.scrollIntoView({ behavior: 'smooth', block: 'start' });
        
        // Surligner temporairement
        node.style.backgroundColor = 'rgba(124, 58, 237, 0.2)';
        setTimeout(() => {
          node.style.backgroundColor = '';
        }, 2000);
        
        break;
      }
    }
  }

  addSearchStyles() {
    if (document.getElementById('search-styles')) return;
    
    const styles = document.createElement('style');
    styles.id = 'search-styles';
    styles.textContent = `
      .search-results {
        background: var(--surface-color);
        border: 1px solid var(--border-color);
        border-radius: 0.5rem;
        margin-top: 1rem;
        max-height: 400px;
        overflow-y: auto;
      }
      
      .search-results-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem;
        border-bottom: 1px solid var(--border-color);
        background: var(--bg-color);
      }
      
      .search-results-header h3 {
        margin: 0;
        font-size: 1rem;
      }
      
      .close-results {
        background: none;
        border: none;
        font-size: 1.5rem;
        cursor: pointer;
        color: var(--text-muted);
      }
      
      .search-result-item {
        padding: 1rem;
        border-bottom: 1px solid var(--border-color);
        cursor: pointer;
        transition: background-color 0.2s ease;
      }
      
      .search-result-item:hover {
        background: rgba(124, 58, 237, 0.05);
      }
      
      .search-result-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.5rem;
      }
      
      .search-result-header h4 {
        margin: 0;
        font-size: 0.875rem;
        color: var(--primary-color);
      }
      
      .search-result-section {
        font-size: 0.75rem;
        color: var(--text-muted);
      }
      
      .search-result-context {
        font-size: 0.875rem;
        line-height: 1.4;
        margin-bottom: 0.5rem;
      }
      
      .search-result-context mark {
        background: rgba(124, 58, 237, 0.3);
        padding: 0.1em 0.2em;
        border-radius: 0.2em;
      }
      
      .search-result-score {
        font-size: 0.75rem;
        color: var(--text-muted);
        text-align: right;
      }
    `;
    
    document.head.appendChild(styles);
  }

  // Méthodes utilitaires
  exportIndex() {
    return {
      index: Object.fromEntries(this.searchIndex),
      timestamp: new Date().toISOString()
    };
  }

  importIndex(data) {
    if (data.index) {
      this.searchIndex = new Map(Object.entries(data.index));
      this.isIndexed = true;
    }
  }

  clearIndex() {
    this.searchIndex.clear();
    this.isIndexed = false;
  }

  rebuildIndex() {
    this.clearIndex();
    this.buildSearchIndex();
  }
}

// Initialiser le moteur de recherche
document.addEventListener('DOMContentLoaded', () => {
  window.searchEngine = new SearchEngine();
});

// Export pour utilisation dans d'autres scripts
window.SearchEngine = SearchEngine;

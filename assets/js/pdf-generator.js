// Générateur de PDF pour le workbook
class PDFGenerator {
  constructor() {
    this.loadJsPDF();
  }

  async loadJsPDF() {
    if (!window.jsPDF) {
      const script = document.createElement('script');
      script.src = 'assets/libs/jspdf.min.js';
      document.head.appendChild(script);
      
      return new Promise((resolve) => {
        script.onload = () => resolve();
      });
    }
  }

  async exportChapter(chapter) {
    await this.loadJsPDF();
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Configuration
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const lineHeight = 7;
    let yPosition = margin;

    // En-tête
    doc.setFontSize(20);
    doc.setFont(undefined, 'bold');
    doc.text(chapter.title, margin, yPosition);
    yPosition += lineHeight * 2;

    doc.setFontSize(12);
    doc.setFont(undefined, 'normal');
    doc.text(chapter.subtitle, margin, yPosition);
    yPosition += lineHeight * 2;

    // Ligne de séparation
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += lineHeight;

    // Contenu du chapitre
    const content = document.getElementById('chapter-content');
    if (content) {
      yPosition = this.addContentToPDF(doc, content, margin, yPosition, pageWidth, pageHeight, lineHeight);
    }

    // Pied de page
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(10);
      doc.text(
        `PHY321 - Université de Yaoundé I - Page ${i}/${pageCount}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
    }

    // Télécharger
    doc.save(`PHY321_${chapter.id}_${chapter.title.replace(/\s+/g, '_')}.pdf`);
  }

  addContentToPDF(doc, element, margin, yPosition, pageWidth, pageHeight, lineHeight) {
    const maxWidth = pageWidth - 2 * margin;
    
    // Parcourir les éléments
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
      null,
      false
    );

    let node;
    while (node = walker.nextNode()) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent.trim();
        if (text) {
          yPosition = this.addTextToPDF(doc, text, margin, yPosition, maxWidth, pageHeight, lineHeight);
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        yPosition = this.handleElementForPDF(doc, node, margin, yPosition, maxWidth, pageHeight, lineHeight);
      }
    }

    return yPosition;
  }

  addTextToPDF(doc, text, x, y, maxWidth, pageHeight, lineHeight) {
    const lines = doc.splitTextToSize(text, maxWidth);
    
    for (const line of lines) {
      if (y > pageHeight - 30) {
        doc.addPage();
        y = 20;
      }
      
      doc.text(line, x, y);
      y += lineHeight;
    }
    
    return y;
  }

  handleElementForPDF(doc, element, margin, yPosition, maxWidth, pageHeight, lineHeight) {
    const tagName = element.tagName.toLowerCase();
    
    switch (tagName) {
      case 'h1':
        doc.setFontSize(18);
        doc.setFont(undefined, 'bold');
        yPosition += lineHeight;
        break;
      case 'h2':
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        yPosition += lineHeight * 0.5;
        break;
      case 'h3':
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        yPosition += lineHeight * 0.5;
        break;
      case 'p':
        doc.setFontSize(12);
        doc.setFont(undefined, 'normal');
        yPosition += lineHeight * 0.3;
        break;
      case 'div':
        if (element.classList.contains('equation-block')) {
          yPosition = this.addEquationToPDF(doc, element, margin, yPosition, maxWidth, pageHeight, lineHeight);
        }
        break;
      case 'ul':
      case 'ol':
        yPosition += lineHeight * 0.3;
        break;
      case 'li':
        doc.setFontSize(12);
        doc.setFont(undefined, 'normal');
        break;
    }
    
    return yPosition;
  }

  addEquationToPDF(doc, equationElement, margin, yPosition, maxWidth, pageHeight, lineHeight) {
    // Pour les équations, on ajoute un placeholder
    // Dans une version complète, on pourrait utiliser MathJax pour convertir en SVG
    yPosition += lineHeight;
    
    if (yPosition > pageHeight - 30) {
      doc.addPage();
      yPosition = 20;
    }
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'italic');
    doc.text('[Équation mathématique]', margin + 10, yPosition);
    yPosition += lineHeight * 2;
    
    return yPosition;
  }

  async exportFullCourse() {
    await this.loadJsPDF();
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Page de titre
    this.addTitlePage(doc);
    
    // Table des matières
    doc.addPage();
    this.addTableOfContents(doc);
    
    // Chapitres
    for (const chapter of window.workbook.chapters) {
      doc.addPage();
      await this.addChapterToPDF(doc, chapter);
    }
    
    // Télécharger
    doc.save('PHY321_Cours_Complet_Mecanique_Quantique.pdf');
  }

  addTitlePage(doc) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    // Titre principal
    doc.setFontSize(24);
    doc.setFont(undefined, 'bold');
    doc.text('Introduction à la Mécanique Quantique', pageWidth / 2, 60, { align: 'center' });
    
    // Sous-titre
    doc.setFontSize(18);
    doc.setFont(undefined, 'normal');
    doc.text('PHY321', pageWidth / 2, 80, { align: 'center' });
    
    // Université
    doc.setFontSize(16);
    doc.text('Université de Yaoundé I', pageWidth / 2, 100, { align: 'center' });
    
    // Année
    doc.setFontSize(14);
    doc.text('2025', pageWidth / 2, 120, { align: 'center' });
    
    // Logo placeholder
    doc.setFontSize(12);
    doc.text('[Logo UY1]', pageWidth / 2, pageHeight - 40, { align: 'center' });
  }

  addTableOfContents(doc) {
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPosition = 40;
    
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text('Table des Matières', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 20;
    
    doc.setFontSize(12);
    doc.setFont(undefined, 'normal');
    
    window.workbook.chapters.forEach((chapter, index) => {
      doc.text(`Chapitre ${index + 1}: ${chapter.title}`, 20, yPosition);
      doc.text(`${index + 3}`, pageWidth - 30, yPosition); // Numéro de page approximatif
      yPosition += 10;
      
      // Sections
      chapter.sections.forEach(section => {
        doc.setFontSize(10);
        doc.text(`  • ${section}`, 30, yPosition);
        yPosition += 7;
      });
      
      doc.setFontSize(12);
      yPosition += 5;
    });
  }

  async addChapterToPDF(doc, chapter) {
    // Charger le contenu du chapitre si nécessaire
    // Pour l'instant, on ajoute juste le titre et les sections
    
    let yPosition = 40;
    const pageWidth = doc.internal.pageSize.getWidth();
    
    doc.setFontSize(20);
    doc.setFont(undefined, 'bold');
    doc.text(chapter.title, 20, yPosition);
    yPosition += 15;
    
    doc.setFontSize(14);
    doc.setFont(undefined, 'normal');
    doc.text(chapter.subtitle, 20, yPosition);
    yPosition += 20;
    
    // Sections
    chapter.sections.forEach(section => {
      doc.setFontSize(16);
      doc.setFont(undefined, 'bold');
      doc.text(section, 20, yPosition);
      yPosition += 10;
      
      doc.setFontSize(12);
      doc.setFont(undefined, 'normal');
      doc.text('Contenu de la section à développer...', 20, yPosition);
      yPosition += 20;
    });
  }
}

// Rendre disponible globalement
window.PDFGenerator = PDFGenerator;

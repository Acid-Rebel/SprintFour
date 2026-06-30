import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

// Configure pdfjs worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export async function extractTextFromFile(file) {
  const extension = file.name.split('.').pop().toLowerCase();
  
  if (extension === 'txt') {
    return await file.text();
  } 
  
  if (extension === 'pdf') {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      
      let lastY = -1;
      let pageText = '';
      
      for (const item of content.items) {
        if (lastY !== -1 && Math.abs(item.transform[5] - lastY) > 5) {
          pageText += '\n'; // New line if Y coordinate changes significantly
        } else if (lastY !== -1) {
          pageText += ' '; // Space if on same line
        }
        pageText += item.str;
        lastY = item.transform[5];
      }
      text += pageText + '\n\n';
    }
    return text.trim();
  }
  
  if (extension === 'docx') {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value.trim();
  }

  throw new Error('Unsupported file type. Please upload a PDF, DOCX, or TXT file.');
}

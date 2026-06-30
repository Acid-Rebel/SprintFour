import * as pdfjsLib from 'pdfjs-dist';


// Configure pdfjs worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

/**
 * Extracts text from a PDF while building a mapping between the flat text
 * character indices and the physical bounding boxes on the PDF pages.
 */
export async function extractPdfWithMapping(file) {
  const arrayBuffer = await file.arrayBuffer();
  
  // Clone the buffer because pdfjs might transfer/detach it to the worker
  const bufferForPdfJs = arrayBuffer.slice(0);
  const bufferToReturn = arrayBuffer.slice(0);
  
  const pdf = await pdfjsLib.getDocument({ 
    data: bufferForPdfJs,
    cMapUrl: `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/cmaps/`,
    cMapPacked: true,
  }).promise;
  
  let fullText = '';
  const textItemsMapping = []; // Maps text spans to physical boxes
  
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });
    const content = await page.getTextContent();
    

    // Always extract native text first
    let lastY = -1;
    for (const item of content.items) {
      // Add newline if Y changes significantly
      if (lastY !== -1 && Math.abs(item.transform[5] - lastY) > 5) {
        fullText += '\n';
      } else if (lastY !== -1) {
        fullText += ' ';
      }
      
      const startIndex = fullText.length;
      fullText += item.str;
      const endIndex = fullText.length;
      
      const tx = item.transform[4];
      const ty = item.transform[5];
      const fontHeight = item.transform[3]; 
      
      const [x, y] = viewport.convertToViewportPoint(tx, ty);
      
      textItemsMapping.push({
        startIndex,
        endIndex,
        str: item.str,
        pageNum,
        x: x,
        y: y - fontHeight,
        width: item.width,
        height: fontHeight,
        tx,
        ty,
        rawHeight: fontHeight,
        rawWidth: item.width
      });
      
      lastY = item.transform[5];
    }
    fullText += '\n\n';


  }
  
  return {
    text: fullText.trim(),
    mapping: textItemsMapping,
    arrayBuffer: bufferToReturn
  };
}

/**
 * Given a start and end character index (from the backend PII results),
 * returns an array of physical bounding boxes to highlight.
 */
export function getBoundingBoxesForIndices(mapping, start, end) {
  const boxes = [];
  
  for (const item of mapping) {
    // Check if the item overlaps with the [start, end] range
    if (item.startIndex <= end && item.endIndex >= start) {
      // Calculate how much of this item is highlighted
      const overlapStart = Math.max(item.startIndex, start);
      const overlapEnd = Math.min(item.endIndex, end);
      
      const strLength = item.str.length;
      const overlapLength = overlapEnd - overlapStart;
      
      if (strLength === 0 || overlapLength <= 0) continue;
      
      // Approximate the position and width of the substring within the item
      const startRatio = (overlapStart - item.startIndex) / strLength;
      const widthRatio = overlapLength / strLength;
      
      boxes.push({
        pageNum: item.pageNum,
        x: item.x + (item.width * startRatio),
        y: item.y,
        width: item.width * widthRatio,
        height: item.height,
        // Keep raw PDF coordinates for export
        rawX: item.tx + (item.rawWidth * startRatio),
        rawY: item.ty,
        rawWidth: item.rawWidth * widthRatio,
        rawHeight: item.rawHeight
      });
    }
  }
  
  return boxes;
}

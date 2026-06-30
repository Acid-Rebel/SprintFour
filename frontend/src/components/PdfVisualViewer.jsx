import React, { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import { getTypeInfo } from '../utils/piiTypes';
import { getBoundingBoxesForIndices } from '../utils/pdfMapper';
import './PdfVisualViewer.css';

// Set up worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

export default function PdfVisualViewer({
  pdfData,
  pdfMapping,
  redactions,
  selectedId,
  onSelectRedaction,
  viewMode,
  confidenceThreshold,
  documentText,
  focusedText,
}) {
  const [numPages, setNumPages] = useState(null);
  const [scale, setScale] = useState(1.5);

  function onDocumentLoadSuccess({ numPages }) {
    setNumPages(numPages);
  }

  const visibleRedactions = redactions.filter(r => r.confidence >= confidenceThreshold);

  // Focus effect for kept items
  React.useEffect(() => {
    if (focusedText && documentText && pdfMapping) {
      const idx = documentText.indexOf(focusedText);
      if (idx > -1) {
        const boxes = getBoundingBoxesForIndices(pdfMapping, idx, idx + focusedText.length);
        if (boxes.length > 0) {
          const pageNum = boxes[0].pageNum;
          const pageEl = document.getElementById(`pdf-page-${pageNum}`);
          if (pageEl) {
            pageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      }
    }
  }, [focusedText, documentText, pdfMapping]);

  // Helper to render overlays for a specific page
  const renderOverlaysForPage = (pageNum) => {
    const overlays = visibleRedactions.flatMap((r) => {
      const boxes = getBoundingBoxesForIndices(pdfMapping, r.start, r.end);
      const pageBoxes = boxes.filter(b => b.pageNum === pageNum);
      
      return pageBoxes.map((box, i) => {
        const info = getTypeInfo(r.pii_type);
        const isSelected = selectedId === r.id;
        const isLowConf = r.confidence < 0.7;
        
        const isActuallyRedacted = r.is_redacted && viewMode === 'redacted';
        const style = {
          left: box.x * scale,
          top: box.y * scale,
          width: box.width * scale,
          height: box.height * scale,
          backgroundColor: isActuallyRedacted ? info.color : (r.is_redacted ? 'rgba(255,165,0,0.3)' : 'rgba(0,212,170,0.2)'),
          borderColor: isActuallyRedacted ? info.color : (r.is_redacted ? 'orange' : 'var(--trust-safe)'),
        };
        
        return (
          <div
            key={`${r.id}-${i}`}
            className={`pdf-redaction-box ${isSelected ? 'selected' : ''} ${isLowConf ? 'low-conf' : ''}`}
            style={style}
            onClick={() => onSelectRedaction(r.id)}
            title={`[${r.pii_type}] ${r.original_text}`}
          >
            {r.is_redacted && viewMode === 'redacted' && (
              <span className="pdf-redaction-label" style={{ color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}>
                {info.icon} {box.width * scale > 70 ? `[${r.pii_type}]` : ''}
              </span>
            )}
          </div>
        );
      });
    });
    

    
    // Add focused overlay if applicable
    let focusedOverlayElements = null;
    if (focusedText && documentText) {
      const idx = documentText.indexOf(focusedText);
      if (idx > -1) {
        const boxes = getBoundingBoxesForIndices(pdfMapping, idx, idx + focusedText.length);
        const pageBoxes = boxes.filter(b => b.pageNum === pageNum);
        
        focusedOverlayElements = pageBoxes.map((box, i) => (
          <div
            key={`focus-${i}`}
            style={{
              position: 'absolute',
              left: box.x * scale,
              top: box.y * scale,
              width: box.width * scale,
              height: box.height * scale,
              backgroundColor: 'rgba(255, 223, 0, 0.4)', // Bright yellow highlight
              border: '2px solid rgb(255, 200, 0)',
              borderRadius: '3px',
              pointerEvents: 'none',
              zIndex: 50,
              boxShadow: '0 0 8px rgba(255, 223, 0, 0.8)',
            }}
          />
        ));
      }
    }
    
    return (
      <div className="pdf-overlays">
        {overlays}
        {focusedOverlayElements}
      </div>
    );
  };

  // react-pdf's Document detaches the ArrayBuffer, so we MUST clone it.
  const clonedPdfData = React.useMemo(() => {
    return pdfData ? pdfData.slice(0) : null;
  }, [pdfData]);

  return (
    <div className="pdf-visual-viewer">
      <div className="pdf-toolbar">
        <button onClick={() => setScale(s => Math.max(0.5, s - 0.2))}>- Zoom</button>
        <span>{Math.round(scale * 100)}%</span>
        <button onClick={() => setScale(s => Math.min(3, s + 0.2))}>+ Zoom</button>
      </div>
      
      <div className="pdf-document-scroll">
        <Document
          file={clonedPdfData}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={<div>Loading PDF...</div>}
        >
          {Array.from(new Array(numPages), (el, index) => (
            <div key={`page_${index + 1}`} id={`pdf-page-${index + 1}`} className="pdf-page-wrapper">
              <Page 
                pageNumber={index + 1} 
                scale={scale} 
                renderTextLayer={true}
                renderAnnotationLayer={true}
              />
              {renderOverlaysForPage(index + 1)}
            </div>
          ))}
        </Document>
      </div>
    </div>
  );
}

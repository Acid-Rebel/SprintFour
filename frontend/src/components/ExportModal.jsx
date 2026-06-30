import { useState } from 'react';
import { exportDocument, exportPdfDocument, exportDocxDocument } from '../utils/api';
import * as pdfjsLib from 'pdfjs-dist';
import './TrustDashboard.css'; // Reuses modal styles from here

import { getBoundingBoxesForIndices } from '../utils/pdfMapper';

/**
 * Export modal: generates safe document, shows irreversibility proof,
 * and lets user copy/download the result.
 */
export default function ExportModal({ documentText, redactions, pdfData, pdfMapping, originalFile, uploadedFileName, onClose }) {
  const [exportData, setExportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [redactedPdfBytes, setRedactedPdfBytes] = useState(null);
  const [redactedDocxBytes, setRedactedDocxBytes] = useState(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState(null);

  const isDocx = uploadedFileName && uploadedFileName.toLowerCase().endsWith('.docx');

  const handleExport = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log("Starting export. isDocx:", isDocx);
      // 1. Get safety report from backend (and safe_text for preview)
      const data = await exportDocument(documentText, redactions);
      setExportData(data);
      
      // 2. If it's a PDF, generate the redacted PDF file via the backend (PyMuPDF true vector redaction)
      if (pdfData && pdfMapping) {
        console.log("Exporting PDF...");
        const visibleRedactions = redactions.filter(r => r.is_redacted);
        const boxes = [];
        
        for (const r of visibleRedactions) {
          const mappedBoxes = getBoundingBoxesForIndices(pdfMapping, r.start, r.end);
          boxes.push(...mappedBoxes);
        }

        const pdfBlob = new Blob([pdfData.slice(0)], { type: 'application/pdf' });
        const redactedPdfBlob = await exportPdfDocument(pdfBlob, boxes);
        
        const pdfBytes = await redactedPdfBlob.arrayBuffer();
        setRedactedPdfBytes(pdfBytes);
        setPdfPreviewUrl(URL.createObjectURL(redactedPdfBlob));
      } else if (isDocx) {
        console.log("Exporting DOCX via backend...");
        if (!originalFile) {
          throw new Error("Cannot export DOCX: Original file is missing. Please refresh the page and re-upload the DOCX file.");
        }
        // Generate redacted DOCX file via backend
        const docxBlob = await exportDocxDocument(originalFile, redactions);
        console.log("DOCX Blob received:", docxBlob.size, "bytes");
        const docxBytes = await docxBlob.arrayBuffer();
        console.log("Setting redactedDocxBytes...", docxBytes.byteLength);
        setRedactedDocxBytes(docxBytes);
      } else {
        console.log("Neither PDF nor DOCX. Downloading as standard text.");
      }
    } catch (err) {
      console.error("Export Error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!exportData) return;
    await navigator.clipboard.writeText(exportData.safe_text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadLlm = async (type) => {
    if (!exportData) return;

    if (type === 'redacted' && redactedPdfBytes) {
      setLoading(true);
      try {
        const pdf = await pdfjsLib.getDocument({ data: redactedPdfBytes.slice(0) }).promise;
        let md = `# Redacted Document\n\n${exportData.safe_text}\n\n## Scanned Pages\n\n`;
        
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d');
          
          await page.render({ canvasContext: ctx, viewport }).promise;
          const base64Img = canvas.toDataURL('image/jpeg', 0.8);
          
          md += `### Page ${i}\n\n![Page ${i}](${base64Img})\n\n`;
        }
        
        const blob = new Blob([md], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'redacted-llm-friendly.md';
        a.click();
        URL.revokeObjectURL(url);
        return;
      } catch (e) {
        console.error("Error generating MD:", e);
      } finally {
        setLoading(false);
      }
    }

    const textContent = type === 'redacted' ? exportData.safe_text : documentText;
    const fileName = type === 'redacted' ? 'redacted-llm-friendly.txt' : 'original-llm-friendly.txt';
    const blob = new Blob([textContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownload = () => {
    if (!exportData) return;
    
    if (redactedPdfBytes) {
      const blob = new Blob([redactedPdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Redacted_Document.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } else if (redactedDocxBytes) {
      const blob = new Blob([redactedDocxBytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Redacted_Document.docx';
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const blob = new Blob([exportData.safe_text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'redacted-document.txt';
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const activeCount = redactions.filter((r) => r.is_redacted).length;
  const keptCount = redactions.filter((r) => !r.is_redacted).length;
  const overrideCount = redactions.filter((r) => r.user_override).length;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">📤 Export Safe Document</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {!exportData ? (
            <>
              {/* Pre-export summary */}
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-number">{activeCount}</div>
                  <div className="stat-label">Will Redact</div>
                </div>
                <div className="stat-card">
                  <div className="stat-number">{keptCount}</div>
                  <div className="stat-label">Kept Visible</div>
                </div>
                <div className="stat-card">
                  <div className="stat-number">{overrideCount}</div>
                  <div className="stat-label">Your Overrides</div>
                </div>
              </div>

              {keptCount > 0 && (
                <div
                  style={{
                    background: 'rgba(255,179,71,0.08)',
                    border: '1px solid rgba(255,179,71,0.2)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 16px',
                    fontSize: '0.82rem',
                    color: 'var(--trust-review)',
                    marginBottom: '16px',
                  }}
                >
                  ⚠️ {keptCount} PII item{keptCount !== 1 ? 's' : ''} will remain
                  visible in the exported document based on your choices.
                </div>
              )}

              {error && (
                <div style={{ color: 'var(--trust-danger)', fontSize: '0.85rem', marginBottom: 12 }}>
                  ❌ {error}
                </div>
              )}

              <button
                className="btn btn-success"
                onClick={handleExport}
                disabled={loading}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                {loading ? '⏳ Generating safe document...' : '🔒 Generate Safe Document'}
              </button>
            </>
          ) : (
            <>
              {/* Proof of irreversibility */}
              <div className="proof-section">
                <div className="proof-title">🛡️ Proof of Irreversibility</div>
                <div className="proof-text">
                  {exportData.safety_report.irreversibility_proof}
                </div>
              </div>

              {/* Stats */}
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-number" style={{ color: 'var(--trust-safe)' }}>
                    {exportData.safety_report.total_redacted}
                  </div>
                  <div className="stat-label">Redacted</div>
                </div>
                <div className="stat-card">
                  <div className="stat-number" style={{ color: 'var(--trust-review)' }}>
                    {exportData.safety_report.total_kept_by_user}
                  </div>
                  <div className="stat-label">Kept by You</div>
                </div>
                <div className="stat-card">
                  <div className="stat-number" style={{ color: 'var(--accent)' }}>
                    {exportData.safety_report.user_overrides}
                  </div>
                  <div className="stat-label">Overrides</div>
                </div>
              </div>

              {/* Remaining risks note */}
              <div
                style={{
                  fontSize: '0.78rem',
                  color: 'var(--text-muted)',
                  fontStyle: 'italic',
                  marginBottom: 16,
                }}
              >
                ℹ️ {exportData.safety_report.remaining_risks}
              </div>

              {/* Safe text preview */}
              <div style={{ marginBottom: 12 }}>
                <span
                  style={{
                    fontSize: '0.72rem',
                    color: 'var(--text-secondary)',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  Preview
                </span>
              </div>
              {redactedPdfBytes && pdfPreviewUrl ? (
                <iframe
                  src={pdfPreviewUrl}
                  title="PDF Preview"
                  style={{
                    width: '100%',
                    height: '350px',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    background: '#f9fafb'
                  }}
                />
              ) : (
                <div className="safe-text-preview">
                  {exportData.safe_text}
                </div>
              )}
            </>
          )}
        </div>

        {exportData && (
          <div className="modal-footer" style={{ flexWrap: 'wrap', gap: '8px' }}>
            {!pdfData && !isDocx && (
              <button className="btn btn-secondary" onClick={handleCopy}>
                {copied ? 'Copied!' : 'Copy to Clipboard'}
              </button>
            )}
            
            {pdfData && (
              <>
                <button className="btn btn-ghost" onClick={() => handleDownloadLlm('original')}>
                  Download Original (LLM safe TXT)
                </button>
                <button className="btn btn-secondary" onClick={() => handleDownloadLlm('redacted')}>
                  Download Redacted (LLM safe TXT)
                </button>
              </>
            )}

            <button className="btn btn-primary" onClick={handleDownload}>
              Download {pdfData ? 'Redacted PDF' : (isDocx ? 'Redacted DOCX' : '.txt')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

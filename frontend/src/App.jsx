import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import './App.css';
import { analyzeDocument, explainSelection } from './utils/api';
import DocumentViewer from './components/DocumentViewer';
import PdfVisualViewer from './components/PdfVisualViewer';
import ExplainPanel from './components/ExplainPanel';
import TrustDashboard from './components/TrustDashboard';
import ExportModal from './components/ExportModal';
import { extractTextFromFile } from './utils/fileExtractor';
import { extractPdfWithMapping } from './utils/pdfMapper';

export default function App() {
  // ── State ──────────────────────────────────────────────
  const [documentText, setDocumentText] = useState('');
  const [pdfData, setPdfData] = useState(null);
  const [pdfMapping, setPdfMapping] = useState(null);
  const [uploadedFileName, setUploadedFileName] = useState(null);
  const [originalFile, setOriginalFile] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [redactions, setRedactions] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('redacted');
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.3);
  const [showExport, setShowExport] = useState(false);
  const [focusedText, setFocusedText] = useState(null);
  const fileInputRef = useRef(null);

  // Manual redaction state
  const [manualSelection, setManualSelection] = useState(null);
  const [manualCustomType, setManualCustomType] = useState('');
  const [selectionExplanation, setSelectionExplanation] = useState(null);
  const [isExplainingSelection, setIsExplainingSelection] = useState(false);

  // ── File Upload Handler ────────────────────────────────
  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setPdfData(null);
    setPdfMapping(null);
    setUploadedFileName(file.name);
    setOriginalFile(file);
    try {
      const extension = file.name.split('.').pop().toLowerCase();

      if (extension === 'pdf') {
        const result = await extractPdfWithMapping(file);
        setDocumentText(result.text);
        setPdfMapping(result.mapping);
        setPdfData(result.arrayBuffer);
      } else {
        const extractedText = await extractTextFromFile(file);
        setDocumentText(extractedText);
      }
    } catch (err) {
      setError(`Failed to extract text: ${err.message}`);
    } finally {
      setLoading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // ── Analyze handler ────────────────────────────────────
  const handleAnalyze = useCallback(async () => {
    if (!documentText.trim()) return;
    setLoading(true);
    setError(null);
    setSelectedId(null);
    try {
      const result = await analyzeDocument(documentText, confidenceThreshold);
      setAnalysisResult(result);
      setRedactions(result.redactions);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [documentText, confidenceThreshold]);



  // ── Toggle redaction on/off ────────────────────────────
  const handleToggleRedaction = useCallback((id, shouldRedact) => {
    setRedactions((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, is_redacted: shouldRedact, user_override: true }
          : r
      )
    );
  }, []);

  const handleToggleCategoryRedaction = useCallback((category, shouldRedact) => {
    setRedactions((prev) =>
      prev.map((r) =>
        r.pii_type === category
          ? { ...r, is_redacted: shouldRedact, user_override: true }
          : r
      )
    );
  }, []);

  const handleToggleTextGroupRedaction = useCallback((text, shouldRedact) => {
    setRedactions((prev) =>
      prev.map((r) =>
        r.original_text === text
          ? { ...r, is_redacted: shouldRedact, user_override: true }
          : r
      )
    );
  }, []);

  // ── Manual Redaction via Selection ───────────────────────
  useEffect(() => {
    const handleMouseUp = (e) => {
      // Ignore if clicking inside the popup
      if (e.target.closest('.manual-redact-popup')) return;

      // Only allow selections from within the actual document viewers
      if (!e.target.closest('.document-viewer') && !e.target.closest('.pdf-visual-viewer')) {
        return;
      }

      const selection = window.getSelection();
      const text = selection.toString().trim();

      // Only trigger if we have a result (document is loaded) and valid selection
      if (text.length > 0 && text.length < 5000 && analysisResult) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        const popupWidth = 240; // Approximate width of popup
        const maxLeft = window.innerWidth - popupWidth;
        const xPos = Math.min(Math.max(rect.left + rect.width / 2, popupWidth / 2 + 10), maxLeft);

        setManualSelection({
          text,
          x: xPos,
          y: rect.bottom + window.scrollY + 10,
        });
        setManualCustomType(''); // Reset custom type
        setSelectionExplanation(null); // Reset explanation
      } else {
        setManualSelection(null);
        setSelectionExplanation(null);
      }
    };

    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, [analysisResult]);

  const handleManualRedact = (type) => {
    if (!manualSelection) return;
    const textToRedact = manualSelection.text;

    // Find all occurrences in documentText robustly (ignoring whitespace differences like \n vs space)
    const newRedactions = [];

    const lowerDocText = documentText.toLowerCase();
    const lowerSearch = textToRedact.toLowerCase();

    // Fast path: Exact match
    let startIndex = 0;
    let matchIndex;
    let foundExact = false;

    while ((matchIndex = lowerDocText.indexOf(lowerSearch, startIndex)) > -1) {
      foundExact = true;
      const exists = redactions.some(r => r.start === matchIndex && r.end === matchIndex + textToRedact.length);
      if (!exists) {
        newRedactions.push({
          id: `manual-${Date.now()}-${matchIndex}`,
          pii_type: type,
          original_text: documentText.substring(matchIndex, matchIndex + textToRedact.length),
          start: matchIndex,
          end: matchIndex + textToRedact.length,
          confidence: 1.0,
          explanation: "Manually flagged for redaction by the user.",
          context: "Manually selected text",
          is_redacted: true,
          user_override: true,
        });
      }
      startIndex = matchIndex + textToRedact.length;
    }

    // Robust path: if exact match fails due to \n vs space discrepancies in PDF text layers
    if (!foundExact) {
      const docNoSpace = lowerDocText.replace(/\s+/g, '');
      const searchNoSpace = lowerSearch.replace(/\s+/g, '');

      if (searchNoSpace.length > 0) {
        const indexMap = [];
        for (let i = 0; i < lowerDocText.length; i++) {
          if (!/\s/.test(lowerDocText[i])) {
            indexMap.push(i);
          }
        }

        let robustStartIndex = 0;
        let robustMatchIndex;
        while ((robustMatchIndex = docNoSpace.indexOf(searchNoSpace, robustStartIndex)) > -1) {
          const actualStart = indexMap[robustMatchIndex];
          const actualEnd = indexMap[robustMatchIndex + searchNoSpace.length - 1] + 1;

          const exists = redactions.some(r => r.start === actualStart && r.end === actualEnd);
          if (!exists) {
            newRedactions.push({
              id: `manual-robust-${Date.now()}-${actualStart}`,
              pii_type: type,
              original_text: documentText.substring(actualStart, actualEnd),
              start: actualStart,
              end: actualEnd,
              confidence: 1.0,
              explanation: "Manually flagged for redaction by the user.",
              context: "Manually selected text",
              is_redacted: true,
              user_override: true,
            });
          }
          robustStartIndex = robustMatchIndex + searchNoSpace.length;
        }
      }
    }

    if (newRedactions.length > 0) {
      setRedactions(prev => [...prev, ...newRedactions]);
    }

    setManualSelection(null);
    setSelectionExplanation(null);
    window.getSelection().removeAllRanges();
  };

  const handleExplainSelection = async () => {
    if (!manualSelection || !documentText) return;
    setIsExplainingSelection(true);
    setSelectionExplanation(null);

    try {
      // Find the exact location of the text in the document
      let idx = documentText.indexOf(manualSelection.text);
      let actualEndIndex = idx > -1 ? idx + manualSelection.text.length : 0;

      if (idx === -1) {
        // Robust fallback for PDF spacing differences
        const lowerDocText = documentText.toLowerCase();
        const lowerSearch = manualSelection.text.toLowerCase();
        const docNoSpace = lowerDocText.replace(/\s+/g, '');
        const searchNoSpace = lowerSearch.replace(/\s+/g, '');

        if (searchNoSpace.length > 0) {
          const indexMap = [];
          for (let i = 0; i < lowerDocText.length; i++) {
            if (!/\s/.test(lowerDocText[i])) indexMap.push(i);
          }
          const robustMatchIndex = docNoSpace.indexOf(searchNoSpace);
          if (robustMatchIndex > -1) {
            idx = indexMap[robustMatchIndex];
            actualEndIndex = indexMap[robustMatchIndex + searchNoSpace.length - 1] + 1;
          }
        }
      }

      // If we still can't find it, fallback to generic context
      if (idx === -1) {
        idx = 0;
        actualEndIndex = manualSelection.text.length;
      }

      const contextStart = Math.max(0, idx - 150);
      const contextEnd = Math.min(documentText.length, actualEndIndex + 150);
      const context = documentText.substring(contextStart, contextEnd);

      // Find any redactions that overlap with this selection
      const overlappingRedactions = redactions.filter(r =>
        (r.start >= idx && r.start < actualEndIndex) ||
        (r.end > idx && r.end <= actualEndIndex) ||
        (r.start <= idx && r.end >= actualEndIndex)
      );

      const aiRedactedTokens = overlappingRedactions
        .filter(r => r.is_redacted && !r.user_override)
        .map(r => r.original_text);

      const manualRedactedTokens = overlappingRedactions
        .filter(r => r.is_redacted && r.user_override)
        .map(r => r.original_text);

      const result = await explainSelection(manualSelection.text, context, aiRedactedTokens, manualRedactedTokens);
      setSelectionExplanation(result.explanation);
    } catch (err) {
      setSelectionExplanation("Failed to get explanation.");
    } finally {
      setIsExplainingSelection(false);
    }
  };

  // ── Re-analyze with new threshold ──────────────────────
  const handleThresholdChange = (val) => {
    setConfidenceThreshold(val);
  };

  // ── Reset ──────────────────────────────────────────────
  const handleReset = () => {
    setDocumentText('');
    setPdfData(null);
    setPdfMapping(null);
    setUploadedFileName(null);
    setOriginalFile(null);
    setAnalysisResult(null);
    setRedactions([]);
    setSelectedId(null);
    setError(null);
  };

  // ── Derived state ──────────────────────────────────────
  const selectedRedaction = redactions.find((r) => r.id === selectedId) || null;
  const hasResult = analysisResult !== null;

  const derivedCategoryBreakdown = useMemo(() => {
    return redactions.reduce((acc, r) => {
      acc[r.pii_type] = (acc[r.pii_type] || 0) + 1;
      return acc;
    }, {});
  }, [redactions]);

  return (
    <div className="app">
      {/* ── Header ──────────────────────────────────────── */}
      <header className="app-header">
        <div className="app-brand">
          <div className="app-logo">RAI</div>
          <div>
            <div className="app-title">RedactAI</div>
            <div className="app-subtitle">Your Privacy, Your Right!</div>
          </div>
        </div>
        <div className="header-actions">
          {hasResult && (
            <>
              <button className="btn btn-ghost" onClick={handleReset}>
                New Document
              </button>
              <button
                className="btn btn-success"
                onClick={() => setShowExport(true)}
              >
                Export Safe Copy
              </button>
            </>
          )}
        </div>
      </header>

      {/* ── Loading Overlay ─────────────────────────────── */}
      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner" />
          <div className="loading-text">Analyzing document for PII…</div>
          <div className="loading-subtext">
            Gemini is scanning for names, emails, addresses, and more
          </div>
        </div>
      )}

      {/* ── Error Toast ─────────────────────────────────── */}
      {error && (
        <div className="error-toast" onClick={() => setError(null)}>
          {error} — click to dismiss
        </div>
      )}

      {/* ── Main Content ────────────────────────────────── */}
      {!hasResult ? (
        /* Upload Screen */
        <div className="upload-screen">
          <div className="upload-container">
            {uploadedFileName ? (
              <div style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '40px',
                marginBottom: '20px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div style={{ fontSize: '48px', color: 'var(--accent)' }}>📄</div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 600 }}>{uploadedFileName}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Ready for analysis. Click the button below to detect PII.
                </p>
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    setUploadedFileName(null);
                    setOriginalFile(null);
                    setDocumentText('');
                    setPdfData(null);
                    setPdfMapping(null);
                  }}
                  style={{ marginTop: '8px', fontSize: '0.8rem' }}
                >
                  Remove File
                </button>
              </div>
            ) : (
              <textarea
                className="upload-textarea"
                value={documentText}
                onChange={(e) => setDocumentText(e.target.value)}
                placeholder="Paste your document text here..."
              />
            )}
            <div className="upload-actions">
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept=".txt,.pdf"
                onChange={handleFileUpload}
              />
              <button
                className="btn btn-secondary"
                onClick={() => fileInputRef.current?.click()}
              >
                Upload File (PDF/TXT)
              </button>
              <button
                className="btn btn-primary"
                onClick={handleAnalyze}
                disabled={!documentText.trim() || loading}
              >
                Analyze for PII
              </button>
            </div>

          </div>
        </div>
      ) : (
        /* Analysis View */
        <div className="app-main">
          <div className="main-content">
            {/* Toolbar */}
            <div className="toolbar">
              <div className="toolbar-group">
                <span className="toolbar-label">View:</span>
                <div className="view-toggle">
                  <button
                    className={viewMode === 'redacted' ? 'active' : ''}
                    onClick={() => setViewMode('redacted')}
                  >
                    Redacted
                  </button>
                  <button
                    className={viewMode === 'original' ? 'active' : ''}
                    onClick={() => setViewMode('original')}
                  >
                    Original
                  </button>
                  {pdfData && (
                    <>
                      <button
                        className={viewMode === 'redacted_llm' ? 'active' : ''}
                        onClick={() => setViewMode('redacted_llm')}
                      >
                        Redacted (LLM safe)
                      </button>
                      <button
                        className={viewMode === 'original_llm' ? 'active' : ''}
                        onClick={() => setViewMode('original_llm')}
                      >
                        Original (LLM safe)
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="toolbar-group">
                <span className="toolbar-label">Sensitivity:</span>
                <div className="confidence-slider">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={confidenceThreshold * 100}
                    onChange={(e) =>
                      handleThresholdChange(Number(e.target.value) / 100)
                    }
                  />
                  <span className="confidence-value">
                    {Math.round(confidenceThreshold * 100)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Trust Dashboard */}
            <TrustDashboard
              trustScore={analysisResult.trust_score}
              categoryBreakdown={derivedCategoryBreakdown}
              totalRedactions={redactions.length}
              redactions={redactions}
              onToggleRedaction={handleToggleRedaction}
              onToggleCategoryRedaction={handleToggleCategoryRedaction}
              onToggleTextGroupRedaction={handleToggleTextGroupRedaction}
            />

            {/* Document or PDF */}
            {pdfData && (viewMode === 'redacted' || viewMode === 'original') ? (
              <PdfVisualViewer
                pdfData={pdfData}
                pdfMapping={pdfMapping}
                documentText={documentText}
                redactions={redactions}
                selectedId={selectedId}
                onSelectRedaction={setSelectedId}
                viewMode={viewMode}
                confidenceThreshold={confidenceThreshold}
                focusedText={focusedText}
              />
            ) : (
              <DocumentViewer
                documentText={documentText}
                redactions={redactions}
                selectedId={selectedId}
                onSelectRedaction={setSelectedId}
                viewMode={viewMode === 'redacted_llm' ? 'redacted' : (viewMode === 'original_llm' ? 'original' : viewMode)}
                confidenceThreshold={confidenceThreshold}
                focusedText={focusedText}
              />
            )}
          </div>

          {/* Side Panel */}
          <div className="side-panel">
            <ExplainPanel
              selectedRedaction={selectedRedaction}
              keptItems={analysisResult.kept_items}
              contextRisks={analysisResult.context_risks}
              metadataWarnings={analysisResult.metadata_warnings}
              onToggleRedaction={handleToggleRedaction}
              onKeptItemClick={(text) => setFocusedText(text)}
            />
          </div>
        </div>
      )}

      {/* ── Export Modal ────────────────────────────────── */}
      {showExport && (
        <ExportModal
          documentText={documentText}
          redactions={redactions}
          pdfData={pdfData}
          pdfMapping={pdfMapping}
          originalFile={originalFile}
          uploadedFileName={uploadedFileName}
          onClose={() => setShowExport(false)}
        />
      )}

      {/* ── Manual Redaction Popup ──────────────────────── */}
      {manualSelection && hasResult && (
        <div
          className="manual-redact-popup"
          style={{
            position: 'absolute',
            top: manualSelection.y,
            left: manualSelection.x,
            transform: 'translateX(-50%)',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            padding: '12px',
            zIndex: 10000,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            minWidth: '220px'
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>
            Manually Redact: <span style={{ color: 'var(--text-primary)' }}>"{manualSelection.text}"</span>
          </div>

          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {['PERSON', 'EMAIL', 'PHONE_NUMBER', 'LOCATION'].map(type => (
              <button
                key={type}
                className="btn btn-ghost"
                style={{ padding: '4px 8px', fontSize: '0.7rem', flex: 1 }}
                onClick={() => handleManualRedact(type)}
              >
                {type}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
            <input
              type="text"
              placeholder="Custom category..."
              value={manualCustomType}
              onChange={(e) => setManualCustomType(e.target.value)}
              style={{
                flex: 1,
                padding: '4px 8px',
                fontSize: '0.75rem',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)'
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && manualCustomType.trim()) {
                  handleManualRedact(manualCustomType.trim().toUpperCase());
                }
              }}
            />
            <button
              className="btn btn-primary"
              style={{ padding: '4px 8px', fontSize: '0.7rem' }}
              onClick={() => {
                if (manualCustomType.trim()) handleManualRedact(manualCustomType.trim().toUpperCase());
              }}
              disabled={!manualCustomType.trim()}
            >
              Add
            </button>
          </div>

          <div style={{ marginTop: '8px', borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
            <button
              className="btn btn-secondary"
              style={{ width: '100%', fontSize: '0.7rem', padding: '4px' }}
              onClick={handleExplainSelection}
              disabled={isExplainingSelection}
            >
              {isExplainingSelection ? 'Analyzing...' : '🧠 Explain redaction decision'}
            </button>

            {selectionExplanation && (
              <div style={{
                marginTop: '8px',
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
                background: 'var(--bg-surface)',
                padding: '8px',
                borderRadius: '4px',
                maxHeight: '150px',
                overflowY: 'auto',
                lineHeight: '1.4'
              }}>
                {selectionExplanation}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

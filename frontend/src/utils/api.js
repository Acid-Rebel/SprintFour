const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export async function analyzeDocument(documentText, confidenceThreshold = 0.3) {
  const res = await fetch(`${API_BASE}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      document_text: documentText,
      confidence_threshold: confidenceThreshold,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Analysis failed (${res.status})`);
  }
  return res.json();
}

export async function exportDocument(documentText, redactions) {
  const res = await fetch(`${API_BASE}/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ document_text: documentText, redactions }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Export failed (${res.status})`);
  }
  return res.json();
}

export async function exportPdfDocument(pdfBlob, boxes) {
  const formData = new FormData();
  formData.append('file', pdfBlob, 'document.pdf');
  formData.append('redaction_boxes', JSON.stringify(boxes));

  const res = await fetch(`${API_BASE}/export-pdf`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `PDF Export failed (${res.status})`);
  }

  return res.blob();
}

export async function exportDocxDocument(docxBlob, redactions) {
  const formData = new FormData();
  formData.append('file', docxBlob, 'document.docx');
  formData.append('redactions', JSON.stringify(redactions));

  const res = await fetch(`${API_BASE}/export-docx`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `DOCX Export failed (${res.status})`);
  }

  return res.blob();
}

export async function explainSelection(selectionText, surroundingContext, aiRedactedTokens, manualRedactedTokens) {
  const res = await fetch(`${API_BASE}/explain-selection`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      selection_text: selectionText,
      surrounding_context: surroundingContext,
      ai_redacted_tokens: aiRedactedTokens,
      manual_redacted_tokens: manualRedactedTokens,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Explanation failed (${res.status})`);
  }
  return res.json();
}

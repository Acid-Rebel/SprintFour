import React, { useState, useEffect } from 'react';
import { getTypeInfo } from '../utils/piiTypes';
import './DocumentViewer.css';

/**
 * Renders document text with inline, clickable redaction spans.
 * Handles both redacted view (showing type labels) and original view.
 */
export default function DocumentViewer({
  documentText,
  redactions,
  selectedId,
  onSelectRedaction,
  viewMode,          // 'redacted' | 'original'
  confidenceThreshold,
  focusedText,
}) {
  const [hoveredId, setHoveredId] = useState(null);

  if (!documentText) return null;

  // Build segments: interleave plain text with redaction spans
  const segments = [];
  let lastEnd = 0;

  // Only show redactions that meet the confidence threshold
  const visible = redactions
    .filter((r) => r.confidence >= confidenceThreshold)
    .sort((a, b) => a.start - b.start);

  for (const r of visible) {
    // Plain text before this redaction
    if (r.start > lastEnd) {
      segments.push({ type: 'text', content: documentText.slice(lastEnd, r.start) });
    }
    segments.push({ type: 'redaction', data: r });
    lastEnd = r.end;
  }
  // Remaining text after last redaction
  if (lastEnd < documentText.length) {
    segments.push({ type: 'text', content: documentText.slice(lastEnd) });
  }

  // Split text segments if focusedText is present
  const finalSegments = [];
  if (focusedText) {
    for (const seg of segments) {
      if (seg.type === 'text') {
        const idx = seg.content.indexOf(focusedText);
        if (idx !== -1) {
          if (idx > 0) finalSegments.push({ type: 'text', content: seg.content.slice(0, idx) });
          finalSegments.push({ type: 'focus', content: focusedText });
          if (idx + focusedText.length < seg.content.length) {
            finalSegments.push({ type: 'text', content: seg.content.slice(idx + focusedText.length) });
          }
        } else {
          finalSegments.push(seg);
        }
      } else {
        finalSegments.push(seg);
      }
    }
  } else {
    finalSegments.push(...segments);
  }

  // Scroll to focus
  useEffect(() => {
    if (focusedText) {
      const el = document.getElementById('focused-mark');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [focusedText]);

  return (
    <div className={`document-viewer ${viewMode === 'original' ? 'view-original' : ''}`}>
      {finalSegments.map((seg, i) => {
        if (seg.type === 'text') {
          return <span key={i}>{seg.content}</span>;
        }
        if (seg.type === 'focus') {
          return (
            <mark 
              key={i} 
              id="focused-mark" 
              style={{ 
                backgroundColor: 'rgba(255, 223, 0, 0.4)', 
                color: 'inherit',
                borderRadius: '3px',
                padding: '0 2px',
                boxShadow: '0 0 8px rgba(255, 223, 0, 0.8)',
                border: '1px solid rgba(255, 200, 0, 0.8)'
              }}
            >
              {seg.content}
            </mark>
          );
        }

        const r = seg.data;
        const info = getTypeInfo(r.pii_type);
        const isSelected = selectedId === r.id;
        const isHovered = hoveredId === r.id;
        const isLowConf = r.confidence < 0.7;
        const isRevealed = !r.is_redacted;

        const spanStyle = {
          backgroundColor: r.is_redacted ? info.color : 'rgba(0,212,170,0.08)',
          borderBottomColor: r.is_redacted ? info.color : 'var(--trust-safe)',
          color: r.is_redacted ? '#fff' : 'var(--trust-safe)',
          textShadow: r.is_redacted ? '0 1px 2px rgba(0,0,0,0.3)' : 'none',
        };

        return (
          <span
            key={r.id}
            className={[
              'redaction-span',
              isSelected && 'selected',
              isLowConf && 'low-confidence',
              isRevealed && 'revealed',
            ]
              .filter(Boolean)
              .join(' ')}
            style={spanStyle}
            onClick={() => onSelectRedaction(r.id)}
            onMouseEnter={() => setHoveredId(r.id)}
            onMouseLeave={() => setHoveredId(null)}
            title=""
          >
            {/* Tooltip on hover */}
            {isHovered && !isSelected && (
              <span className="redaction-tooltip">
                {info.icon} {info.label} — {Math.round(r.confidence * 100)}% conf.
                {isLowConf && ' ⚠ Needs review'}
              </span>
            )}

            {viewMode === 'redacted' && r.is_redacted ? (
              <>
                <span className="redaction-label">{info.icon} [{r.pii_type}]</span>
                {isLowConf && <span className="needs-review-badge">REVIEW</span>}
              </>
            ) : (
              <>
                <span className="redaction-label" style={{ opacity: 0.5, fontSize: '0.65rem' }}>
                  {info.icon}
                </span>
                <span className="redaction-original">{r.original_text}</span>
                {isLowConf && <span className="needs-review-badge">REVIEW</span>}
              </>
            )}
          </span>
        );
      })}
    </div>
  );
}

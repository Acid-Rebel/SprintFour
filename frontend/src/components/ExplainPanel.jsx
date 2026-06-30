import { useState } from 'react';
import { getTypeInfo, getRiskColor } from '../utils/piiTypes';
import './ExplainPanel.css';

/**
 * Side panel showing:
 *  1. Selected redaction detail ("Why this?")
 *  2. Kept items ("Why NOT this?")
 *  3. Context risks
 *  4. Metadata warnings
 */
export default function ExplainPanel({
  selectedRedaction,
  keptItems,
  contextRisks,
  metadataWarnings,
  onToggleRedaction,
  onKeptItemClick,
}) {
  return (
    <div className="explain-panel">
      {/* ── Selected Redaction Detail ───────────────────── */}
      <SelectedDetail
        redaction={selectedRedaction}
        onToggle={onToggleRedaction}
      />

      {/* ── Why NOT? (Kept Items) ──────────────────────── */}
      <CollapsibleSection
        title="Why NOT These?"
        icon="✅"
        count={keptItems.length}
        defaultOpen={true}
      >
        {keptItems.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
            No ambiguous text detected.
          </p>
        ) : (
          keptItems.map((item, i) => (
            <div 
              key={i} 
              className="kept-item" 
              style={{ animationDelay: `${i * 50}ms`, cursor: 'pointer' }}
              onClick={() => {
                if (onKeptItemClick) onKeptItemClick(item.text);
              }}
            >
              <div className="kept-item-text">
                <span>"{item.text}"</span>
                <span className="kept-item-badge">looks like {item.resembles_type}</span>
              </div>
              <div className="kept-item-reason">{item.kept_reason}</div>
            </div>
          ))
        )}
      </CollapsibleSection>

      {/* ── Context Risks ──────────────────────────────── */}
      {contextRisks.length > 0 && (
        <CollapsibleSection
          title="Context Risks"
          icon="🔗"
          count={contextRisks.length}
          defaultOpen={true}
        >
          {contextRisks.map((risk, i) => (
            <div key={i} className="risk-item">
              <div className="risk-header">
                <span
                  className="risk-level"
                  style={{
                    background: `${getRiskColor(risk.risk_level)}20`,
                    color: getRiskColor(risk.risk_level),
                    border: `1px solid ${getRiskColor(risk.risk_level)}40`,
                  }}
                >
                  {risk.risk_level}
                </span>
              </div>
              <div className="risk-description">{risk.description}</div>
              <div className="risk-suggestion">💡 {risk.suggestion}</div>
            </div>
          ))}
        </CollapsibleSection>
      )}

      {/* ── Metadata Warnings ──────────────────────────── */}
      {metadataWarnings.length > 0 && (
        <CollapsibleSection
          title="Metadata Warnings"
          icon="⚠️"
          count={metadataWarnings.length}
          defaultOpen={true}
        >
          {metadataWarnings.map((w, i) => (
            <div key={i} className="warning-item">
              <span className="warning-icon">⚠️</span>
              <span>{w}</span>
            </div>
          ))}
        </CollapsibleSection>
      )}
    </div>
  );
}

/* ── Selected Redaction Detail ──────────────────────────── */
function SelectedDetail({ redaction, onToggle }) {
  if (!redaction) {
    return (
      <div className="panel-section">
        <div className="no-selection">
          <div className="no-selection-icon">🔍</div>
          <div className="no-selection-text">Click a redaction to inspect it</div>
          <div className="no-selection-hint">
            Learn why each item was hidden or kept
          </div>
        </div>
      </div>
    );
  }

  const info = getTypeInfo(redaction.pii_type);
  const confPercent = Math.round(redaction.confidence * 100);
  const confColor =
    redaction.confidence >= 0.8
      ? 'var(--trust-safe)'
      : redaction.confidence >= 0.6
        ? 'var(--trust-review)'
        : 'var(--trust-danger)';

  return (
    <div className="panel-section selected-detail animate-slide-right">
      <div className="panel-section-header" style={{ cursor: 'default' }}>
        <span className="panel-section-title">
          {redaction.id.startsWith('manual-') ? '👤 Manually Flagged' : '🔍 Why This Was Flagged'}
        </span>
      </div>
      <div className="panel-section-body">
        {/* Type badge */}
        <div className="detail-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span
            className="detail-type-badge"
            style={{
              background: info.bg,
              color: info.color,
              border: `1px solid ${info.color}40`,
            }}
          >
            {info.icon} {info.label}
          </span>
          {redaction.user_override && (
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary-color)', background: 'var(--primary-color-transparent)', padding: '2px 6px', borderRadius: '4px' }}>
              User Override
            </span>
          )}
        </div>

        {/* Original text */}
        <div className="detail-row">
          <span className="detail-label">Detected Text</span>
          <div className="detail-original-text">{redaction.original_text}</div>
        </div>

        {/* Confidence */}
        <div className="detail-row">
          <span className="detail-label">Confidence</span>
          <div className="confidence-meter">
            <div className="confidence-bar">
              <div
                className="confidence-bar-fill"
                style={{
                  width: `${confPercent}%`,
                  background: confColor,
                }}
              />
            </div>
            <span className="confidence-label" style={{ color: confColor }}>
              {confPercent}%
            </span>
          </div>
        </div>

        {/* Explanation */}
        <div className="detail-row">
          <span className="detail-label">Reasoning</span>
          <div className="detail-value">
            {redaction.explanation || "No explanation provided."}
          </div>
        </div>

        {/* Context */}
        {redaction.context && (
          <div className="detail-row">
            <span className="detail-label">Context</span>
            <div className="detail-value" style={{ color: 'var(--text-secondary)' }}>
              {redaction.context}
            </div>
          </div>
        )}

        {/* Toggle action */}
        <div className="detail-actions">
          {redaction.is_redacted ? (
            <button
              className="btn btn-danger"
              onClick={() => onToggle(redaction.id, false)}
            >
              👁 Keep Visible
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={() => onToggle(redaction.id, true)}
            >
              🔒 Redact This
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Collapsible section wrapper ───────────────────────── */
function CollapsibleSection({ title, icon, count, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);

  // Need to import useState at the top — it's available via closure since
  // this file imports from React through the parent.  But we need it explicitly:
  return (
    <div className="panel-section">
      <div className="panel-section-header" onClick={() => setOpen((v) => !v)}>
        <span className="panel-section-title">
          {icon} {title}
          {count > 0 && <span className="panel-section-count">{count}</span>}
        </span>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
          {open ? '▲' : '▼'}
        </span>
      </div>
      {open && <div className="panel-section-body">{children}</div>}
    </div>
  );
}


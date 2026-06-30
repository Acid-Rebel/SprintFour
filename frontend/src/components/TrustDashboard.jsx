import { useState, useRef, useEffect } from 'react';
import { getTypeInfo } from '../utils/piiTypes';
import './TrustDashboard.css';

/**
 * Visual trust score gauge with category breakdown.
 */
export default function TrustDashboard({ trustScore, categoryBreakdown, totalRedactions, redactions, onToggleRedaction, onToggleCategoryRedaction, onToggleTextGroupRedaction }) {
  const [activeDropdown, setActiveDropdown] = useState(null);
  
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (trustScore / 100) * circumference;

  // Click outside to close dropdown
  const dashboardRef = useRef(null);
  useEffect(() => {
    function handleClickOutside(event) {
      if (dashboardRef.current && !dashboardRef.current.contains(event.target)) {
        setActiveDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const statusColor =
    trustScore >= 75 ? 'var(--trust-safe)' :
    trustScore >= 50 ? 'var(--trust-review)' :
    'var(--trust-danger)';

  const statusText =
    trustScore >= 75 ? 'Safe to Share' :
    trustScore >= 50 ? 'Review Recommended' :
    'Not Yet Safe';

  const statusDesc =
    trustScore >= 75
      ? 'Most PII has been identified with high confidence.'
      : trustScore >= 50
        ? 'Some items need your review before sharing.'
        : 'Several PII items need attention.';

  return (
    <div className="trust-dashboard" ref={dashboardRef}>
      <div className="trust-header">
        <span className="trust-title">Document Trust Score</span>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          {totalRedactions} PII item{totalRedactions !== 1 ? 's' : ''} detected
        </span>
      </div>

      <div className="trust-score-display">
        {/* Gauge */}
        <div className="trust-gauge">
          <svg viewBox="0 0 72 72">
            <circle className="trust-gauge-bg" cx="36" cy="36" r={radius} />
            <circle
              className="trust-gauge-fill"
              cx="36"
              cy="36"
              r={radius}
              stroke={statusColor}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="trust-gauge-text" style={{ color: statusColor }}>
            {Math.round(trustScore)}
          </div>
        </div>

        <div className="trust-info">
          <div className="trust-status" style={{ color: statusColor }}>
            {statusText}
          </div>
          <div className="trust-status-desc">{statusDesc}</div>
        </div>
      </div>

      {/* Category breakdown pills */}
      {Object.keys(categoryBreakdown).length > 0 && (
        <div className="category-breakdown">
          {Object.entries(categoryBreakdown).map(([type, count]) => {
            const info = getTypeInfo(type);
            return (
              <div key={type} className="category-pill-container">
                <span
                  className="category-pill"
                  onClick={() => setActiveDropdown(activeDropdown === type ? null : type)}
                  style={{
                    background: info.bg,
                    color: info.color,
                    borderColor: `${info.color}30`,
                  }}
                >
                  {info.icon} {info.label} <span className="category-count">{count}</span>
                  <span style={{ marginLeft: 4, opacity: 0.6, fontSize: '0.6rem' }}>▼</span>
                </span>
                
                {activeDropdown === type && (
                  <div className="category-dropdown">
                    <div className="category-dropdown-actions">
                      <button onClick={() => { onToggleCategoryRedaction(type, true); setActiveDropdown(null); }}>Redact All</button>
                      <button onClick={() => { onToggleCategoryRedaction(type, false); setActiveDropdown(null); }}>Unredact All</button>
                    </div>
                    <div className="dropdown-items">
                      {Object.entries(
                        redactions
                          .filter(r => r.pii_type === type)
                          .reduce((acc, r) => {
                            if (!acc[r.original_text]) {
                              acc[r.original_text] = { ...r, all_redacted: true, count: 0 };
                            }
                            acc[r.original_text].count++;
                            if (!r.is_redacted) {
                              acc[r.original_text].all_redacted = false;
                            }
                            return acc;
                          }, {})
                      ).map(([text, groupData]) => (
                        <div 
                          key={text} 
                          className="dropdown-item" 
                          onClick={() => onToggleTextGroupRedaction(text, !groupData.all_redacted)}
                        >
                          <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>
                            {groupData.all_redacted ? '🔒' : '👁️'}
                          </span>
                          <span style={{ 
                            textDecoration: !groupData.all_redacted ? 'none' : 'line-through',
                            opacity: !groupData.all_redacted ? 1 : 0.6
                          }}>
                            {text} {groupData.count > 1 && <span style={{ opacity: 0.5, fontSize: '0.65rem' }}>({groupData.count})</span>}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

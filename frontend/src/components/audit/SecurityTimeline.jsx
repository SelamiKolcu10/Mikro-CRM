import { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import TimelineEntry from './TimelineEntry';
import ChainBreakMarker from './ChainBreakMarker';

function groupByDay(logs, locale) {
  const groups = [];
  let currentKey = null;
  for (const log of logs) {
    const key = new Date(log.createdAt).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
    if (key !== currentKey) {
      groups.push({ key, logs: [] });
      currentKey = key;
    }
    groups[groups.length - 1].logs.push(log);
  }
  return groups;
}

/**
 * The vertical spine here IS the hash chain: a break in verification renders
 * as a literal rupture in the line via ChainBreakMarker, not just a flagged
 * row. `logs` must already be sorted by sequence (desc — newest first).
 */
const SecurityTimeline = ({
  logs,
  loading,
  brokenAtSequence,
  expected,
  found,
  hasMore,
  remainingCount,
  loadingMore,
  onLoadMore,
  jumpToBreakToken,
  onClearFilters,
}) => {
  const { t, lang } = useLanguage();
  const locale = lang === 'tr' ? 'tr-TR' : 'en-US';
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [flashBreak, setFlashBreak] = useState(false);
  const breakRef = useRef(null);

  const toggle = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    if (!jumpToBreakToken || !breakRef.current) return;
    breakRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setFlashBreak(true);
    const timeout = setTimeout(() => setFlashBreak(false), 700);
    return () => clearTimeout(timeout);
  }, [jumpToBreakToken]);

  if (loading) {
    return <div className="loading-spinner"><div className="spinner" /></div>;
  }

  if (logs.length === 0) {
    return (
      <div className="table-empty">
        <div className="table-empty-icon">🛡️</div>
        <p>{t('auditLog.noMatchingLogs')}</p>
        {onClearFilters && (
          <button className="btn btn-secondary btn-sm" onClick={onClearFilters} style={{ marginTop: 'var(--space-sm)' }}>
            {t('auditLog.clearFilters')}
          </button>
        )}
      </div>
    );
  }

  const groups = groupByDay(logs, locale);

  return (
    <div className="timeline">
      {groups.map((group) => (
        <div key={group.key}>
          <div className="timeline-day-divider">{group.key}</div>
          {group.logs.map((log) => {
            const isUnverifiable = brokenAtSequence != null && log.sequence >= brokenAtSequence;
            const isBreakBoundary = brokenAtSequence != null && log.sequence === brokenAtSequence;
            return (
              <div key={log._id}>
                <div className="timeline-entry-row">
                  <div className="timeline-gutter">
                    <div className={`timeline-spine ${isUnverifiable ? 'timeline-spine--broken' : ''}`} />
                    <div className={`timeline-node timeline-node--${log.severity} ${isUnverifiable ? 'timeline-node--unverifiable' : ''}`} />
                  </div>
                  <TimelineEntry
                    log={log}
                    expanded={expandedIds.has(log._id)}
                    onToggle={() => toggle(log._id)}
                    isUnverifiable={isUnverifiable}
                  />
                </div>
                {isBreakBoundary && (
                  <ChainBreakMarker
                    ref={breakRef}
                    brokenAtSequence={brokenAtSequence}
                    expected={expected}
                    found={found}
                    flash={flashBreak}
                  />
                )}
              </div>
            );
          })}
        </div>
      ))}

      {hasMore && (
        <div className="timeline-load-more">
          <button className="btn btn-secondary" onClick={onLoadMore} disabled={loadingMore}>
            {loadingMore ? t('common.loading') : t('auditLog.loadMore').replace('{count}', remainingCount ?? '')}
          </button>
        </div>
      )}
    </div>
  );
};

export default SecurityTimeline;

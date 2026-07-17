import toast from 'react-hot-toast';
import {
  HiOutlineInformationCircle, HiOutlineShieldExclamation, HiOutlineExclamationCircle,
  HiChevronDown, HiChevronUp, HiOutlineClipboard,
} from 'react-icons/hi';
import { useLanguage } from '../../context/LanguageContext';
import {
  ACTION_BADGE_CLASS, collectionLabel, fieldLabel, formatFieldValue, summarizeLog,
  actorDisplayName, SNAPSHOT_HIDDEN_KEYS,
} from '../../utils/auditFormat';

const SEVERITY_ICON = {
  info: HiOutlineInformationCircle,
  sensitive: HiOutlineShieldExclamation,
  critical: HiOutlineExclamationCircle,
};

const shortHash = (hash) => (hash ? `${hash.slice(0, 8)}…${hash.slice(-6)}` : '—');

const TimelineEntry = ({ log, expanded, onToggle, isUnverifiable, flash }) => {
  const { t, lang } = useLanguage();
  const locale = lang === 'tr' ? 'tr-TR' : 'en-US';
  const SeverityIcon = SEVERITY_ICON[log.severity] || HiOutlineInformationCircle;
  const severityLabelKey = `auditLog.severity${log.severity[0].toUpperCase()}${log.severity.slice(1)}`;
  const actionLabelKey = `auditLog.action${log.action[0].toUpperCase()}${log.action.slice(1)}`;

  const snapshotEntries = log.snapshot
    ? Object.entries(log.snapshot).filter(([key]) => !SNAPSHOT_HIDDEN_KEYS.has(key))
    : [];

  const copyHash = (value) => {
    if (!value) return;
    navigator.clipboard?.writeText(value);
    toast.success(t('auditLog.hashCopied'));
  };

  return (
    <div
      className={[
        'timeline-entry',
        expanded && 'timeline-entry--expanded',
        isUnverifiable && 'timeline-entry--unverifiable',
        flash && 'timeline-flash',
      ].filter(Boolean).join(' ')}
    >
      <button type="button" className="timeline-entry-header" aria-expanded={expanded} onClick={onToggle}>
        <span className={`severity-tag severity-tag--${log.severity}`}>
          <SeverityIcon /> {t(severityLabelKey)}
        </span>
        {isUnverifiable && (
          <span className="severity-tag severity-tag--unverifiable">{t('auditLog.unverifiable')}</span>
        )}
        <span className="timeline-entry-summary">
          {summarizeLog(log, t)}
          <span className="timeline-entry-meta">
            {actorDisplayName(log.actorEmail, t)} · {collectionLabel(log.collectionName, t)}{' '}
            <span className={`badge ${ACTION_BADGE_CLASS[log.action]}`}>{t(actionLabelKey)}</span>
          </span>
        </span>
        <span className="timeline-entry-time">
          {new Date(log.createdAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
        </span>
        <span className="timeline-entry-chevron">{expanded ? <HiChevronUp /> : <HiChevronDown />}</span>
      </button>

      {expanded && (
        <div className="timeline-entry-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
            <div><strong>{t('auditLog.collection')}:</strong> {collectionLabel(log.collectionName, t)}</div>
            <div><strong>{t('auditLog.action')}:</strong> {t(actionLabelKey)}</div>
            <div><strong>{t('auditLog.actor')}:</strong> {log.actorEmail || t('auditLog.actorSystem')}</div>
            <div><strong>{t('auditLog.date')}:</strong> {new Date(log.createdAt).toLocaleString(locale)}</div>
            <div><strong>{t('auditLog.ip')}:</strong> {log.ip || '—'}</div>
            <div style={{ wordBreak: 'break-all' }}><strong>{t('auditLog.userAgent')}:</strong> {log.userAgent || '—'}</div>
          </div>

          {log.changes?.length > 0 ? (
            <ul className="audit-change-list">
              {log.changes.map((c) => (
                <li key={c.field}>
                  <span className="audit-change-field">{fieldLabel(c.field, t)}</span>
                  <span className="audit-change-before">{formatFieldValue(log.collectionName, c.field, c.before, t)}</span>
                  <span className="audit-change-arrow">→</span>
                  <span className="audit-change-after">{formatFieldValue(log.collectionName, c.field, c.after, t)}</span>
                </li>
              ))}
            </ul>
          ) : log.action === 'update' ? (
            <p style={{ color: 'var(--text-secondary)' }}>{t('auditLog.noChanges')}</p>
          ) : null}

          {snapshotEntries.length > 0 && (
            <div style={{ marginTop: 'var(--space-md)' }}>
              <strong>{t('auditLog.snapshot')}</strong>
              <ul className="audit-change-list">
                {snapshotEntries.map(([key, value]) => (
                  <li key={key}>
                    <span className="audit-change-field">{fieldLabel(key, t)}</span>
                    <span className="audit-change-after">
                      {typeof value === 'object' && value !== null ? JSON.stringify(value) : formatFieldValue(log.collectionName, key, value, t)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="timeline-hash-line" onClick={() => copyHash(log.hash)} title={t('auditLog.hashLabel')}>
            <HiOutlineClipboard style={{ verticalAlign: 'middle' }} /> #{log.sequence} ⛓ {shortHash(log.hash)} ← {t('auditLog.prevHashLabel')}: {shortHash(log.prevHash)}
          </div>
        </div>
      )}
    </div>
  );
};

export default TimelineEntry;

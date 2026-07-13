import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext';
import auditService from '../services/auditService';
import Modal from '../components/common/Modal';
import toast from 'react-hot-toast';
import { HiOutlineEye } from 'react-icons/hi';
import { ROLE_LABELS, DEPARTMENT_LABELS } from '../config/permissions';

const COLLECTIONS = ['User', 'Customer', 'CustomerUser', 'Feedback'];
const ACTIONS = ['create', 'update', 'delete'];

const actionBadgeClass = {
  create: 'badge-resolved',
  update: 'badge-open',
  delete: 'badge-bug',
};

const COLLECTION_LABEL_KEYS = {
  User: 'auditLog.collections.user',
  Customer: 'auditLog.collections.customer',
  CustomerUser: 'auditLog.collections.customerUser',
  Feedback: 'auditLog.collections.feedback',
  PermissionOverride: 'auditLog.collections.permissionOverride',
};

const FIELD_LABEL_KEYS = {
  name: 'auditLog.fields.name',
  email: 'auditLog.fields.email',
  company: 'auditLog.fields.company',
  plan: 'auditLog.fields.plan',
  mrr: 'auditLog.fields.mrr',
  source: 'auditLog.fields.source',
  notes: 'auditLog.fields.notes',
  role: 'auditLog.fields.role',
  status: 'auditLog.fields.status',
  department: 'auditLog.fields.department',
  isDepartmentLead: 'auditLog.fields.isDepartmentLead',
  password: 'auditLog.fields.password',
  mustChangePassword: 'auditLog.fields.mustChangePassword',
  active: 'auditLog.fields.active',
  title: 'auditLog.fields.title',
  description: 'auditLog.fields.description',
  type: 'auditLog.fields.type',
  assignedTo: 'auditLog.fields.assignedTo',
};

// Internal/derived fields that show up in a create/delete snapshot but mean
// nothing to a human reader — filtered out of the snapshot view.
const SNAPSHOT_HIDDEN_KEYS = new Set(['_id', '__v', 'password', 'createdAt', 'updatedAt']);

const fieldLabel = (field, t) => {
  const key = FIELD_LABEL_KEYS[field];
  return key ? t(key) : field;
};

const collectionLabel = (collectionName, t) => {
  const key = COLLECTION_LABEL_KEYS[collectionName];
  return key ? t(key) : collectionName;
};

// Local-part of the actor's email, capitalized — the audit trail only
// denormalizes email (see backend/models/AuditLog.js), not a display name.
const actorDisplayName = (email, t) => {
  if (!email) return t('auditLog.actorSystem');
  const local = email.split('@')[0];
  return local.charAt(0).toUpperCase() + local.slice(1);
};

const truncate = (str, max = 80) => (str.length > max ? `${str.slice(0, max)}…` : str);

/** Renders a single field's value in a human-readable form for the given collection. */
function formatFieldValue(collectionName, field, value, t) {
  if (value === undefined || value === null || value === '') return t('auditLog.valueEmpty');
  if (field === 'password') return t('auditLog.valueMasked');
  if (typeof value === 'boolean') return value ? t('common.yes') : t('common.no');

  if (field === 'role') return ROLE_LABELS[value] ? t(ROLE_LABELS[value]) : value;
  if (field === 'department') return DEPARTMENT_LABELS[value] ? t(DEPARTMENT_LABELS[value]) : value;
  if (field === 'plan') return t(`customers.plans.${value}`);
  if (field === 'source') return t(`customers.sources.${value}`);
  if (field === 'type' && collectionName === 'Feedback') return t(`feedbacks.types.${value}`);
  if (field === 'status') {
    if (collectionName === 'Feedback') return t(`feedbacks.statuses.${value}`);
    if (collectionName === 'User') return t(`users.statuses.${value}`);
    return String(value);
  }
  if (field === 'mrr') return `$${Number(value).toLocaleString()}`;
  // A raw ObjectId reference isn't meaningful on its own — show it the same
  // shorthand way the rest of the app does (see TaskHistory's `_id.slice(-6)`).
  if (field === 'assignedTo') return `#${String(value).slice(-6)}`;

  return typeof value === 'string' ? truncate(value) : String(value);
}

/** One-line, human-readable summary for the list row (replaces "N fields changed"). */
function summarizeLog(log, t) {
  const actor = actorDisplayName(log.actorEmail, t);
  const collLabel = collectionLabel(log.collectionName, t);
  const identifier = log.snapshot?.name || log.snapshot?.title || log.snapshot?.email;
  const identifierSuffix = identifier ? ` "${truncate(String(identifier), 40)}"` : '';

  if (log.action === 'create') {
    return t('auditLog.summaryCreate').replace('{actor}', actor).replace('{collection}', collLabel).replace('{identifier}', identifierSuffix);
  }
  if (log.action === 'delete') {
    return t('auditLog.summaryDelete').replace('{actor}', actor).replace('{collection}', collLabel).replace('{identifier}', identifierSuffix);
  }

  const changes = log.changes || [];
  if (changes.length === 0) {
    return t('auditLog.summaryUpdateGeneric').replace('{actor}', actor).replace('{collection}', collLabel);
  }
  if (changes.length === 1) {
    const c = changes[0];
    return t('auditLog.summaryUpdateSingle')
      .replace('{actor}', actor)
      .replace('{field}', fieldLabel(c.field, t))
      .replace('{value}', formatFieldValue(log.collectionName, c.field, c.after, t));
  }
  const fieldNames = changes.map((c) => fieldLabel(c.field, t)).join(', ');
  return t('auditLog.summaryUpdateMultiple')
    .replace('{actor}', actor)
    .replace('{collection}', collLabel)
    .replace('{fields}', fieldNames);
}

const AuditLog = () => {
  const { t } = useLanguage();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const [collectionName, setCollectionName] = useState('');
  const [action, setAction] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  const fetchLogs = useCallback(async () => {
    try {
      const params = { page, limit: 25 };
      if (collectionName) params.collectionName = collectionName;
      if (action) params.action = action;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      const res = await auditService.getAll(params);
      setLogs(res.data.data);
      setPages(res.data.pagination.pages || 1);
    } catch (err) {
      toast.error(t('common.loadError'));
    } finally {
      setLoading(false);
    }
  }, [collectionName, action, dateFrom, dateTo, page]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Any filter change resets pagination back to the first page.
  useEffect(() => {
    setPage(1);
  }, [collectionName, action, dateFrom, dateTo]);

  if (loading && logs.length === 0) {
    return <div className="loading-spinner"><div className="spinner" /></div>;
  }

  const snapshotEntries = selected?.snapshot
    ? Object.entries(selected.snapshot).filter(([key]) => !SNAPSHOT_HIDDEN_KEYS.has(key))
    : [];

  return (
    <>
      <div className="page-header">
        <div>
          <h1>🛡️ {t('auditLog.title')}</h1>
          <p>{t('auditLog.subtitle')}</p>
        </div>
      </div>

      <div className="table-container">
        <div className="table-header">
          <div className="table-filters">
            <select className="form-input" value={collectionName} onChange={(e) => setCollectionName(e.target.value)}>
              <option value="">{t('auditLog.allCollections')}</option>
              {COLLECTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className="form-input" value={action} onChange={(e) => setAction(e.target.value)}>
              <option value="">{t('auditLog.allActions')}</option>
              {ACTIONS.map((a) => <option key={a} value={a}>{t(`auditLog.action${a[0].toUpperCase()}${a.slice(1)}`)}</option>)}
            </select>
            <input
              type="date"
              className="form-input"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              title={t('auditLog.dateFrom')}
            />
            <input
              type="date"
              className="form-input"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              title={t('auditLog.dateTo')}
            />
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>{t('auditLog.date')}</th>
              <th>{t('auditLog.collection')}</th>
              <th>{t('auditLog.action')}</th>
              <th>{t('auditLog.actor')}</th>
              <th>{t('auditLog.changes')}</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log._id}>
                <td data-label={t('auditLog.date')}>{new Date(log.createdAt).toLocaleString('tr-TR')}</td>
                <td data-label={t('auditLog.collection')}>{log.collectionName}</td>
                <td data-label={t('auditLog.action')}><span className={`badge ${actionBadgeClass[log.action]}`}>{t(`auditLog.action${log.action[0].toUpperCase()}${log.action.slice(1)}`)}</span></td>
                <td data-label={t('auditLog.actor')}>{log.actorEmail || t('auditLog.actorSystem')}</td>
                <td data-label={t('auditLog.changes')} className="audit-summary-cell">{summarizeLog(log, t)}</td>
                <td data-label={t('common.actions')}>
                  <button className="btn-icon" onClick={() => setSelected(log)} title={t('auditLog.detail')}>
                    <HiOutlineEye />
                  </button>
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan="6">
                  <div className="table-empty">
                    <div className="table-empty-icon">🛡️</div>
                    <p>{t('auditLog.noLogs')}</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {pages > 1 && (
          <div className="table-footer" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 'var(--space-sm)', padding: 'var(--space-md)' }}>
            <button className="btn btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              {t('auditLog.prev')}
            </button>
            <span>{t('auditLog.pageInfo').replace('{page}', page).replace('{pages}', pages)}</span>
            <button className="btn btn-secondary" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
              {t('auditLog.next')}
            </button>
          </div>
        )}
      </div>

      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title={t('auditLog.detailTitle')}>
        {selected && (
          <div>
            <p className="audit-detail-summary">{summarizeLog(selected, t)}</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
              <div><strong>{t('auditLog.collection')}:</strong> {collectionLabel(selected.collectionName, t)}</div>
              <div><strong>{t('auditLog.action')}:</strong> {t(`auditLog.action${selected.action[0].toUpperCase()}${selected.action.slice(1)}`)}</div>
              <div><strong>{t('auditLog.actor')}:</strong> {selected.actorEmail || t('auditLog.actorSystem')}</div>
              <div><strong>{t('auditLog.date')}:</strong> {new Date(selected.createdAt).toLocaleString('tr-TR')}</div>
              <div><strong>{t('auditLog.ip')}:</strong> {selected.ip || '—'}</div>
              <div style={{ wordBreak: 'break-all' }}><strong>{t('auditLog.userAgent')}:</strong> {selected.userAgent || '—'}</div>
            </div>

            {selected.changes?.length > 0 ? (
              <ul className="audit-change-list">
                {selected.changes.map((c) => (
                  <li key={c.field}>
                    <span className="audit-change-field">{fieldLabel(c.field, t)}</span>
                    <span className="audit-change-before">{formatFieldValue(selected.collectionName, c.field, c.before, t)}</span>
                    <span className="audit-change-arrow">→</span>
                    <span className="audit-change-after">{formatFieldValue(selected.collectionName, c.field, c.after, t)}</span>
                  </li>
                ))}
              </ul>
            ) : selected.action === 'update' ? (
              <p style={{ color: 'var(--text-secondary)' }}>{t('auditLog.noChanges')}</p>
            ) : null}

            {snapshotEntries.length > 0 && (
              <div style={{ marginTop: 'var(--space-md)' }}>
                <strong>{t('auditLog.snapshot')}</strong>
                <ul className="audit-change-list">
                  {snapshotEntries.map(([key, value]) => (
                    <li key={key}>
                      <span className="audit-change-field">{fieldLabel(key, t)}</span>
                      <span className="audit-change-after">{formatFieldValue(selected.collectionName, key, value, t)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
};

export default AuditLog;

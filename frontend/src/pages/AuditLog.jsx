import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext';
import auditService from '../services/auditService';
import Modal from '../components/common/Modal';
import toast from 'react-hot-toast';
import { HiOutlineEye } from 'react-icons/hi';

const COLLECTIONS = ['User', 'Customer', 'CustomerUser', 'Feedback'];
const ACTIONS = ['create', 'update', 'delete'];

const actionBadgeClass = {
  create: 'badge-resolved',
  update: 'badge-open',
  delete: 'badge-bug',
};

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
                <td>{new Date(log.createdAt).toLocaleString('tr-TR')}</td>
                <td>{log.collectionName}</td>
                <td><span className={`badge ${actionBadgeClass[log.action]}`}>{t(`auditLog.action${log.action[0].toUpperCase()}${log.action.slice(1)}`)}</span></td>
                <td>{log.actorEmail || t('auditLog.actorSystem')}</td>
                <td>{log.changes?.length ? t('auditLog.changesCount').replace('{count}', log.changes.length) : '—'}</td>
                <td>
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
              <div><strong>{t('auditLog.collection')}:</strong> {selected.collectionName}</div>
              <div><strong>{t('auditLog.action')}:</strong> {t(`auditLog.action${selected.action[0].toUpperCase()}${selected.action.slice(1)}`)}</div>
              <div><strong>{t('auditLog.actor')}:</strong> {selected.actorEmail || t('auditLog.actorSystem')}</div>
              <div><strong>{t('auditLog.date')}:</strong> {new Date(selected.createdAt).toLocaleString('tr-TR')}</div>
              <div><strong>{t('auditLog.ip')}:</strong> {selected.ip || '—'}</div>
              <div style={{ wordBreak: 'break-all' }}><strong>{t('auditLog.userAgent')}:</strong> {selected.userAgent || '—'}</div>
            </div>

            {selected.changes?.length > 0 ? (
              <table>
                <thead>
                  <tr>
                    <th>{t('auditLog.field')}</th>
                    <th>{t('auditLog.before')}</th>
                    <th>{t('auditLog.after')}</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.changes.map((c) => (
                    <tr key={c.field}>
                      <td>{c.field}</td>
                      <td style={{ color: 'var(--color-danger)' }}>{String(c.before ?? '—')}</td>
                      <td style={{ color: 'var(--color-success)' }}>{String(c.after ?? '—')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ color: 'var(--text-secondary)' }}>{t('auditLog.noChanges')}</p>
            )}

            {selected.snapshot && (
              <div style={{ marginTop: 'var(--space-md)' }}>
                <strong>{t('auditLog.snapshot')}:</strong>
                <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', background: 'var(--bg-secondary)', padding: 'var(--space-sm)', borderRadius: 'var(--radius-md)', marginTop: 'var(--space-xs)' }}>
                  {JSON.stringify(selected.snapshot, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
};

export default AuditLog;

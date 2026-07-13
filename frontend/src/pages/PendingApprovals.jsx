import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext';
import approvalService from '../services/approvalService';
import Modal from '../components/common/Modal';
import toast from 'react-hot-toast';
import { HiOutlineCheck, HiOutlineX, HiOutlineExclamation } from 'react-icons/hi';
import PermissionGate from '../components/auth/PermissionGate';

const STATUS_BADGE = {
  pending: 'badge-open',
  approved: 'badge-resolved',
  rejected: 'badge-bug',
  conflict: 'badge-high',
};

const RESOURCE_LABEL_KEYS = {
  customers: 'accessControl.resourceCustomers',
  feedbacks: 'accessControl.resourceFeedbacks',
};

const ACTION_LABEL_KEYS = {
  create: 'approvals.actionCreate',
  update: 'approvals.actionUpdate',
  delete: 'approvals.actionDelete',
};

const PendingApprovals = () => {
  const { t } = useLanguage();
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [busyId, setBusyId] = useState(null);

  const fetchApprovals = useCallback(async () => {
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      const res = await approvalService.getAll(params);
      setApprovals(res.data.data);
    } catch (err) {
      toast.error(t('common.loadError'));
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  const handleApprove = async (id) => {
    setBusyId(id);
    try {
      const res = await approvalService.approve(id);
      toast.success(res.data.data.status === 'conflict' ? t('approvals.conflictHint') : t('approvals.approveSuccess'));
      fetchApprovals();
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.error'));
    } finally {
      setBusyId(null);
    }
  };

  const openReject = (id) => {
    setRejectReason('');
    setRejectTarget(id);
  };

  const confirmReject = async () => {
    setBusyId(rejectTarget);
    try {
      await approvalService.reject(rejectTarget, rejectReason);
      toast.success(t('approvals.rejectSuccess'));
      setRejectTarget(null);
      fetchApprovals();
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.error'));
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <div className="loading-spinner"><div className="spinner" /></div>;
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>🗂️ {t('approvals.title')}</h1>
          <p>{t('approvals.subtitle')}</p>
        </div>
      </div>

      <div className="table-container">
        <div className="table-header">
          <div className="table-filters">
            {['pending', 'approved', 'rejected', 'conflict', ''].map((status) => (
              <button
                key={status || 'all'}
                className={`filter-chip ${statusFilter === status ? 'active' : ''}`}
                onClick={() => setStatusFilter(status)}
              >
                {status ? t(`approvals.status${status[0].toUpperCase()}${status.slice(1)}`) : t('common.all')}
              </button>
            ))}
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>{t('approvals.resource')}</th>
              <th>{t('approvals.action')}</th>
              <th>{t('approvals.requestedBy')}</th>
              <th>{t('approvals.payload')}</th>
              <th>{t('approvals.status')}</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {approvals.map((a) => (
              <tr key={a._id}>
                <td data-label={t('approvals.resource')}>{t(RESOURCE_LABEL_KEYS[a.resource]) || a.resource}</td>
                <td data-label={t('approvals.action')}>{t(ACTION_LABEL_KEYS[a.action]) || a.action}</td>
                <td data-label={t('approvals.requestedBy')}>
                  <div className="cell-name">{a.requestedBy?.name}</div>
                  <div className="cell-email">{a.requestedBy?.email}</div>
                </td>
                <td data-label={t('approvals.payload')} style={{ maxWidth: 260 }}>
                  <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: '11px', margin: 0, color: 'var(--text-secondary)' }}>
                    {JSON.stringify(a.payload, null, 0)}
                  </pre>
                  {a.status === 'conflict' && a.rejectionReason && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, color: 'var(--color-warning)', fontSize: '11px' }}>
                      <HiOutlineExclamation /> {a.rejectionReason}
                    </div>
                  )}
                  {a.status === 'rejected' && a.rejectionReason && (
                    <div style={{ marginTop: 4, color: 'var(--text-tertiary)', fontSize: '11px' }}>
                      {a.rejectionReason}
                    </div>
                  )}
                </td>
                <td data-label={t('approvals.status')}>
                  <span className={`badge ${STATUS_BADGE[a.status]}`}>{t(`approvals.status${a.status[0].toUpperCase()}${a.status.slice(1)}`)}</span>
                </td>
                <td data-label={t('common.actions')}>
                  {a.status === 'pending' && (
                    <PermissionGate resource="approvals" action="review">
                      <div className="cell-actions">
                        <button
                          className="btn-icon"
                          onClick={() => handleApprove(a._id)}
                          disabled={busyId === a._id}
                          title={t('approvals.approve')}
                          style={{ color: 'var(--color-success)' }}
                        >
                          <HiOutlineCheck />
                        </button>
                        <button
                          className="btn-icon"
                          onClick={() => openReject(a._id)}
                          disabled={busyId === a._id}
                          title={t('approvals.reject')}
                          style={{ color: 'var(--color-danger)' }}
                        >
                          <HiOutlineX />
                        </button>
                      </div>
                    </PermissionGate>
                  )}
                </td>
              </tr>
            ))}
            {approvals.length === 0 && (
              <tr>
                <td colSpan="6">
                  <div className="table-empty">
                    <div className="table-empty-icon">🗂️</div>
                    <p>{t('approvals.noApprovals')}</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        title={t('approvals.reject')}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setRejectTarget(null)}>
              {t('common.cancel')}
            </button>
            <button className="btn btn-danger" onClick={confirmReject} disabled={busyId === rejectTarget}>
              {t('approvals.reject')}
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">{t('approvals.rejectReasonPrompt')}</label>
          <textarea
            className="form-input"
            rows={3}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
        </div>
      </Modal>
    </>
  );
};

export default PendingApprovals;

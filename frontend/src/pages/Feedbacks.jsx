import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext';
import feedbackService from '../services/feedbackService';
import customerService from '../services/customerService';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import toast from 'react-hot-toast';
import {
  HiOutlinePlus,
  HiOutlinePencil,
  HiOutlineTrash,
  HiOutlineSearch,
  HiOutlineChatAlt2,
} from 'react-icons/hi';

const Feedbacks = () => {
  const { t } = useLanguage();
  const [feedbacks, setFeedbacks] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ type: '', status: '', priority: '' });
  const [search, setSearch] = useState('');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    title: '', description: '', type: 'bug', customer: '', status: 'open',
  });
  const [saving, setSaving] = useState(false);

  // Delete confirm
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchFeedbacks = useCallback(async () => {
    try {
      const params = { limit: 100, sort: '-revenueImpact' };
      if (filters.type) params.type = filters.type;
      if (filters.status) params.status = filters.status;
      if (filters.priority) params.priority = filters.priority;
      if (search) params.search = search;
      const res = await feedbackService.getAll(params);
      setFeedbacks(res.data.data);
    } catch {
      toast.error(t('common.loadError'));
    } finally {
      setLoading(false);
    }
  }, [filters, search]);

  useEffect(() => {
    fetchFeedbacks();
  }, [fetchFeedbacks]);

  useEffect(() => {
    const loadCustomers = async () => {
      try {
        const res = await customerService.getAll({ limit: 200 });
        setCustomers(res.data.data);
      } catch { /* silently fail */ }
    };
    loadCustomers();
  }, []);

  const openCreateModal = (prefilledCustomerId = '') => {
    setEditingId(null);
    setForm({ title: '', description: '', type: 'bug', customer: typeof prefilledCustomerId === 'string' ? prefilledCustomerId : '', status: 'open' });
    setModalOpen(true);
  };

  const openEditModal = (fb) => {
    setEditingId(fb._id);
    setForm({
      title: fb.title,
      description: fb.description || '',
      type: fb.type,
      customer: fb.customer?._id || '',
      status: fb.status,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingId) {
        await feedbackService.update(editingId, {
          title: form.title,
          description: form.description,
          type: form.type,
          status: form.status,
        });
        toast.success(t('common.update') + ' ✓');
      } else {
        await feedbackService.create(form);
        toast.success(t('common.create') + ' ✓');
      }
      setModalOpen(false);
      fetchFeedbacks();
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await feedbackService.delete(deleteId);
      toast.success(t('common.delete') + ' ✓');
      setDeleteId(null);
      fetchFeedbacks();
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.error'));
    } finally {
      setDeleting(false);
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await feedbackService.update(id, { status: newStatus });
      fetchFeedbacks();
    } catch {
      toast.error(t('common.error'));
    }
  };

  const formatCurrency = (val) => `$${Number(val).toLocaleString()}`;

  if (loading) {
    return <div className="loading-spinner"><div className="spinner" /></div>;
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{t('feedbacks.title')}</h1>
          <p>{t('feedbacks.subtitle')}</p>
        </div>
        <button className="btn btn-primary" onClick={() => openCreateModal()}>
          <HiOutlinePlus /> {t('feedbacks.addFeedback')}
        </button>
      </div>

      {/* Table */}
      <div className="table-container">
        <div className="table-header">
          <div className="table-filters">
            {/* Type filter */}
            <select
              className="filter-chip"
              value={filters.type}
              onChange={(e) => setFilters({ ...filters, type: e.target.value })}
              style={{ cursor: 'pointer', minWidth: '120px' }}
            >
              <option value="">{t('feedbacks.allTypes')}</option>
              {['bug', 'feature', 'improvement'].map((type) => (
                <option key={type} value={type}>{t(`feedbacks.types.${type}`)}</option>
              ))}
            </select>

            {/* Status filter */}
            <select
              className="filter-chip"
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              style={{ cursor: 'pointer', minWidth: '130px' }}
            >
              <option value="">{t('feedbacks.allStatuses')}</option>
              {['open', 'in-progress', 'resolved', 'closed'].map((s) => (
                <option key={s} value={s}>{t(`feedbacks.statuses.${s}`)}</option>
              ))}
            </select>

            {/* Priority filter */}
            <select
              className="filter-chip"
              value={filters.priority}
              onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
              style={{ cursor: 'pointer', minWidth: '130px' }}
            >
              <option value="">{t('feedbacks.allPriorities')}</option>
              {['critical', 'high', 'medium', 'low'].map((p) => (
                <option key={p} value={p}>{t(`feedbacks.priorities.${p}`)}</option>
              ))}
            </select>
          </div>

          <div className="search-bar">
            <HiOutlineSearch className="search-icon" />
            <input
              type="text"
              placeholder={t('common.search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style={{ width: '30%' }}>{t('feedbacks.feedbackTitle')}</th>
              <th>{t('feedbacks.customer')}</th>
              <th>{t('feedbacks.type')}</th>
              <th>{t('feedbacks.priority')}</th>
              <th>{t('feedbacks.status')}</th>
              <th>{t('feedbacks.revenueImpact')}</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {feedbacks.map((fb) => (
              <tr key={fb._id}>
                <td>
                  <div className="cell-name">{fb.title}</div>
                  {fb.description && (
                    <div className="cell-email" style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {fb.description}
                    </div>
                  )}
                </td>
                <td>
                  {fb.customer ? (
                    <>
                      <div className="cell-name">{fb.customer.name}</div>
                      <span className={`badge badge-${fb.customer.plan}`} style={{ marginTop: '4px' }}>
                        {t(`customers.plans.${fb.customer.plan}`).toUpperCase()}
                      </span>
                    </>
                  ) : '—'}
                </td>
                <td>
                  <span className={`badge badge-${fb.type}`}>
                    {t(`feedbacks.types.${fb.type}`)}
                  </span>
                </td>
                <td>
                  <span className={`badge badge-${fb.priority}`}>
                    {t(`feedbacks.priorities.${fb.priority}`)}
                  </span>
                </td>
                <td>
                  <select
                    className="form-select"
                    value={fb.status}
                    onChange={(e) => handleStatusChange(fb._id, e.target.value)}
                    style={{ padding: '4px 28px 4px 8px', fontSize: 'var(--font-size-xs)', minWidth: '120px' }}
                  >
                    {['open', 'in-progress', 'resolved', 'closed'].map((s) => (
                      <option key={s} value={s}>{t(`feedbacks.statuses.${s}`)}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <span className={`revenue-impact ${fb.revenueImpact >= 200 ? 'high' : fb.revenueImpact > 0 ? 'medium' : 'low'}`}>
                    {formatCurrency(fb.revenueImpact)}{t('common.perMonth')}
                  </span>
                </td>
                <td>
                  <div className="cell-actions">
                    {fb.customer && (
                      <button
                        className="btn-icon feedback-quick-btn"
                        onClick={() => openCreateModal(fb.customer._id)}
                        title={t('feedbacks.addFeedback')}
                      >
                        <HiOutlineChatAlt2 />
                      </button>
                    )}
                    <button className="btn-icon" onClick={() => openEditModal(fb)} title={t('common.edit')}>
                      <HiOutlinePencil />
                    </button>
                    <button className="btn-icon" onClick={() => setDeleteId(fb._id)} title={t('common.delete')} style={{ color: 'var(--color-danger)' }}>
                      <HiOutlineTrash />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {feedbacks.length === 0 && (
              <tr>
                <td colSpan="7">
                  <div className="table-empty">
                    <div className="table-empty-icon">📋</div>
                    <p>{t('common.noData')}</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? t('feedbacks.editFeedback') : t('feedbacks.addFeedback')}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>
              {t('common.cancel')}
            </button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
              {saving ? t('common.loading') : editingId ? t('common.update') : t('common.create')}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">{t('feedbacks.feedbackTitle')} *</label>
            <input
              type="text"
              className="form-input"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">{t('feedbacks.description')}</label>
            <textarea
              className="form-textarea"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows="3"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{t('feedbacks.type')} *</label>
              <select
                className="form-select"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                {['bug', 'feature', 'improvement'].map((type) => (
                  <option key={type} value={type}>{t(`feedbacks.types.${type}`)}</option>
                ))}
              </select>
            </div>

            {editingId && (
              <div className="form-group">
                <label className="form-label">{t('feedbacks.status')}</label>
                <select
                  className="form-select"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  {['open', 'in-progress', 'resolved', 'closed'].map((s) => (
                    <option key={s} value={s}>{t(`feedbacks.statuses.${s}`)}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {!editingId && (
            <div className="form-group">
              <label className="form-label">{t('feedbacks.customer')} *</label>
              
              {form.customer ? (
                <div className="feedback-customer-info" style={{ marginTop: 'var(--space-xs)', marginBottom: 'var(--space-sm)', position: 'relative' }}>
                  <button 
                    type="button"
                    className="btn-icon" 
                    onClick={() => setForm({ ...form, customer: '' })}
                    style={{ position: 'absolute', top: 'var(--space-sm)', right: 'var(--space-sm)' }}
                    title="Müşteriyi Değiştir"
                  >
                    ✕
                  </button>
                  <div className="feedback-customer-avatar">
                    {customers.find(c => c._id === form.customer)?.name.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div>
                    <div className="cell-name">{customers.find(c => c._id === form.customer)?.name}</div>
                    <div className="cell-email">{customers.find(c => c._id === form.customer)?.email}</div>
                    <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className={`badge badge-${customers.find(c => c._id === form.customer)?.plan}`}>
                        {t(`customers.plans.${customers.find(c => c._id === form.customer)?.plan || 'free'}`).toUpperCase()}
                      </span>
                      <span className={`revenue-impact ${customers.find(c => c._id === form.customer)?.mrr >= 200 ? 'high' : customers.find(c => c._id === form.customer)?.mrr > 0 ? 'medium' : 'low'}`}>
                        ${customers.find(c => c._id === form.customer)?.mrr}{t('common.perMonth')}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <select
                  className="form-select"
                  value={form.customer}
                  onChange={(e) => setForm({ ...form, customer: e.target.value })}
                  required
                >
                  <option value="">{t('feedbacks.selectCustomer')}</option>
                  {customers.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name} — {t(`customers.plans.${c.plan}`).toUpperCase()} (${c.mrr}{t('common.perMonth')})
                    </option>
                  ))}
                </select>
              )}
              <span className="form-hint">
                💡 {t('feedbacks.autoCalculated')}
              </span>
            </div>
          )}
        </form>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title={t('common.confirm')}
        message={t('feedbacks.deleteWarning')}
        loading={deleting}
      />
    </>
  );
};

export default Feedbacks;

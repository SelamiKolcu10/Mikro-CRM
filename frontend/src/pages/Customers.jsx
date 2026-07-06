import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext';
import customerService from '../services/customerService';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineSearch } from 'react-icons/hi';

const initialForm = {
  name: '', email: '', company: '', plan: 'free', mrr: 0, source: 'email', notes: '',
};

const Customers = () => {
  const { t } = useLanguage();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);

  // Delete confirm
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCustomers = useCallback(async () => {
    try {
      const params = { limit: 100 };
      if (filter) params.plan = filter;
      if (search) params.search = search;
      const res = await customerService.getAll(params);
      setCustomers(res.data.data);
    } catch (err) {
      toast.error(t('common.loadError'));
    } finally {
      setLoading(false);
    }
  }, [filter, search]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const mrrByPlan = {
    free: 0,
    starter: 29,
    premium: 99,
    vip: 299,
  };

  const handlePlanChange = (e) => {
    const plan = e.target.value;
    setForm((prev) => ({
      ...prev,
      plan,
      mrr: mrrByPlan[plan] ?? prev.mrr,
    }));
  };

  const openCreateModal = () => {
    setEditingId(null);
    setForm(initialForm);
    setModalOpen(true);
  };

  const openEditModal = (customer) => {
    setEditingId(customer._id);
    setForm({
      name: customer.name,
      email: customer.email,
      company: customer.company || '',
      plan: customer.plan,
      mrr: customer.mrr,
      source: customer.source,
      notes: customer.notes || '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingId) {
        await customerService.update(editingId, form);
        toast.success(t('common.update') + ' ✓');
      } else {
        await customerService.create(form);
        toast.success(t('common.create') + ' ✓');
      }
      setModalOpen(false);
      fetchCustomers();
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await customerService.delete(deleteId);
      toast.success(t('common.delete') + ' ✓');
      setDeleteId(null);
      fetchCustomers();
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.error'));
    } finally {
      setDeleting(false);
    }
  };

  const getPlanBadge = (plan) => `badge badge-${plan}`;

  const formatCurrency = (val) => `$${Number(val).toLocaleString()}`;

  if (loading) {
    return <div className="loading-spinner"><div className="spinner" /></div>;
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{t('customers.title')}</h1>
          <p>{t('customers.subtitle')}</p>
        </div>
        <button className="btn btn-primary" onClick={openCreateModal}>
          <HiOutlinePlus /> {t('customers.addCustomer')}
        </button>
      </div>

      {/* Table */}
      <div className="table-container">
        <div className="table-header">
          <div className="table-filters">
            {['', 'free', 'starter', 'premium', 'vip'].map((plan) => (
              <button
                key={plan}
                className={`filter-chip ${filter === plan ? 'active' : ''}`}
                onClick={() => setFilter(plan)}
              >
                {plan === '' ? t('customers.allPlans') : t(`customers.plans.${plan}`)}
              </button>
            ))}
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
              <th>{t('customers.name')}</th>
              <th>{t('customers.company')}</th>
              <th>{t('customers.plan')}</th>
              <th>{t('customers.mrrShort')}</th>
              <th>{t('customers.source')}</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c._id}>
                <td>
                  <div className="cell-name">{c.name}</div>
                  <div className="cell-email">{c.email}</div>
                </td>
                <td className="cell-company">{c.company || '—'}</td>
                <td><span className={getPlanBadge(c.plan)}>{c.plan.toUpperCase()}</span></td>
                <td>
                  <span className={`revenue-impact ${c.mrr >= 200 ? 'high' : c.mrr > 0 ? 'medium' : 'low'}`}>
                    {formatCurrency(c.mrr)}
                  </span>
                </td>
                <td>{t(`customers.sources.${c.source}`)}</td>
                <td>
                  <div className="cell-actions">
                    <button className="btn-icon" onClick={() => openEditModal(c)} title={t('common.edit')}>
                      <HiOutlinePencil />
                    </button>
                    <button className="btn-icon" onClick={() => setDeleteId(c._id)} title={t('common.delete')} style={{ color: 'var(--color-danger)' }}>
                      <HiOutlineTrash />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr>
                <td colSpan="6">
                  <div className="table-empty">
                    <div className="table-empty-icon">👥</div>
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
        title={editingId ? t('customers.editCustomer') : t('customers.addCustomer')}
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
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{t('customers.name')} *</label>
              <input
                type="text"
                className="form-input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">{t('customers.email')} *</label>
              <input
                type="email"
                className="form-input"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{t('customers.company')}</label>
              <input
                type="text"
                className="form-input"
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">{t('customers.source')}</label>
              <select
                className="form-select"
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value })}
              >
                {['twitter', 'discord', 'email', 'in-app', 'other'].map((s) => (
                  <option key={s} value={s}>{t(`customers.sources.${s}`)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{t('customers.plan')} *</label>
              <select
                className="form-select"
                value={form.plan}
                onChange={handlePlanChange}
              >
                {['free', 'starter', 'premium', 'vip'].map((p) => (
                  <option key={p} value={p}>{t(`customers.plans.${p}`)}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{t('customers.mrr')} ($)</label>
              <input
                type="number"
                className="form-input"
                value={form.mrr}
                onChange={(e) => setForm({ ...form, mrr: Number(e.target.value) })}
                min="0"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">{t('customers.notes')}</label>
            <textarea
              className="form-textarea"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows="3"
            />
          </div>
        </form>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title={t('common.confirm')}
        message={t('customers.deleteWarning')}
        loading={deleting}
      />
    </>
  );
};

export default Customers;

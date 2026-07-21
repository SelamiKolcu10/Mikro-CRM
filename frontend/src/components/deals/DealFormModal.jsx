import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import Modal from '../common/Modal';
import { useLanguage } from '../../context/LanguageContext';
import { DEAL_CURRENCIES } from '../../config/deals';
import customerService from '../../services/customerService';

/**
 * Bağımsız fırsat oluşturma — Deals sayfasından "Yeni Fırsat". Lead dönüşümünden
 * farkı: mevcut bir Customer seçilir (yeni oluşturmaz). Aşama initial_contact,
 * olasılık backend'de o aşamanın default'undan gelir.
 */
const DealFormModal = ({ isOpen, onClose, onCreate }) => {
  const { t } = useLanguage();
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({ title: '', customerId: '', value: '', currency: 'TRY', expectedCloseDate: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setForm({ title: '', customerId: '', value: '', currency: 'TRY', expectedCloseDate: '' });
    customerService.getAll().then((res) => setCustomers(res.data.data)).catch(() => setCustomers([]));
  }, [isOpen]);

  const setField = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.customerId) { toast.error(t('deals.form.customerRequired')); return; }
    if (form.value === '' || Number(form.value) < 0) { toast.error(t('deals.convert.valueRequired')); return; }
    setSubmitting(true);
    try {
      await onCreate({
        title: form.title,
        customerId: form.customerId,
        value: Number(form.value),
        currency: form.currency,
        expectedCloseDate: form.expectedCloseDate || undefined,
      });
      toast.success(t('deals.form.success'));
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('deals.form.title')}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
          <button type="submit" form="deal-form" className="btn btn-primary" disabled={submitting}>
            {t('deals.form.submit')}
          </button>
        </>
      }
    >
      <form id="deal-form" className="deal-edit-form" onSubmit={handleSubmit}>
        <label className="deal-edit-field">
          <span>{t('deals.detail.title')}</span>
          <input className="form-input" type="text" value={form.title} onChange={setField('title')} maxLength={150} required />
        </label>
        <label className="deal-edit-field">
          <span>{t('deals.form.customer')}</span>
          <select className="form-select" value={form.customerId} onChange={setField('customerId')} required>
            <option value="">{t('deals.form.selectCustomer')}</option>
            {customers.map((c) => (
              <option key={c._id} value={c._id}>{c.name}{c.company ? ` · ${c.company}` : ''}</option>
            ))}
          </select>
        </label>
        <div className="deal-edit-row">
          <label className="deal-edit-field">
            <span>{t('deals.detail.value')}</span>
            <input className="form-input" type="number" min="0" value={form.value} onChange={setField('value')} required />
          </label>
          <label className="deal-edit-field">
            <span>{t('deals.detail.currency')}</span>
            <select className="form-select" value={form.currency} onChange={setField('currency')}>
              {DEAL_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        </div>
        <label className="deal-edit-field">
          <span>{t('deals.detail.expectedClose')}</span>
          <input className="form-input" type="date" value={form.expectedCloseDate} onChange={setField('expectedCloseDate')} />
        </label>
      </form>
    </Modal>
  );
};

export default DealFormModal;

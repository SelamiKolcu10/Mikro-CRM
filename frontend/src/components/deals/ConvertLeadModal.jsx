import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import Modal from '../common/Modal';
import { useLanguage } from '../../context/LanguageContext';
import { DEAL_CURRENCIES } from '../../config/deals';
import dealService from '../../services/dealService';

// budgetRange → önerilen başlangıç değeri (yalnız ön-doldurma; gerçek tutar
// kullanıcının girdiğidir). config/leads.js BUDGET_OPTIONS ile hizalı.
const BUDGET_SUGGESTION = {
  '<50k': 25000,
  '50k-150k': 100000,
  '150k-500k': 325000,
  '500k+': 500000,
};

/**
 * Lead → Deal dönüştürme modalı — LeadDetailDrawer'dan açılır. Backend tek
 * aksiyonla Customer'ı (yoksa) oluşturur + Deal açar (bkz. convertLead). Bu
 * modal sadece tutar/tarih/başlığı toplar; müşteri seçimi YOK (lead'den türer).
 */
const ConvertLeadModal = ({ lead, isOpen, onClose, onConverted }) => {
  const { t } = useLanguage();
  const [form, setForm] = useState({ value: '', title: '', currency: 'TRY', expectedCloseDate: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!lead) return;
    setForm({
      value: BUDGET_SUGGESTION[lead.budgetRange] ?? '',
      title: `${lead.company || lead.name} — ${t('deals.convert.defaultTitleSuffix')}`,
      currency: 'TRY',
      expectedCloseDate: '',
    });
  }, [lead, t]);

  if (!lead) return null;

  const setField = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.value === '' || Number(form.value) < 0) {
      toast.error(t('deals.convert.valueRequired'));
      return;
    }
    setSubmitting(true);
    try {
      const res = await dealService.convertLead(lead._id, {
        value: Number(form.value),
        title: form.title || undefined,
        currency: form.currency,
        expectedCloseDate: form.expectedCloseDate || undefined,
      });
      toast.success(t('deals.convert.success'));
      onConverted?.(res.data.data);
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
      title={t('deals.convert.title')}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
          <button type="submit" form="convert-lead-form" className="btn btn-primary" disabled={submitting}>
            {t('deals.convert.submit')}
          </button>
        </>
      }
    >
      <p className="deal-convert-hint">{t('deals.convert.hint')}</p>
      <form id="convert-lead-form" className="deal-edit-form" onSubmit={handleSubmit}>
        <label className="deal-edit-field">
          <span>{t('deals.detail.title')}</span>
          <input className="form-input" type="text" value={form.title} onChange={setField('title')} maxLength={150} />
        </label>
        <div className="deal-edit-row">
          <label className="deal-edit-field">
            <span>{t('deals.detail.value')}</span>
            <input className="form-input" type="number" min="0" value={form.value} onChange={setField('value')} autoFocus />
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

export default ConvertLeadModal;

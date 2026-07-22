import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { HiOutlineX, HiOutlinePlus, HiOutlineTrash } from 'react-icons/hi';
import { useLanguage } from '../../context/LanguageContext';
import { useCatalog } from '../../hooks/useCatalog';
import { CATALOG_CURRENCIES, DEFAULT_TAX_RATE, CURRENCY_SYMBOL } from '../../config/catalog';
import { withComputedTotals } from '../../utils/quoteTotals';
import QuoteLineItems from './QuoteLineItems';
import toast from 'react-hot-toast';

/**
 * Teklif oluştur/düzenle — müşteri seçici, deal seçici, QuoteLineItems editörü,
 * canlı toplam (withComputedTotals). Portal'lı büyük modal.
 */
const QuoteBuilder = ({ quote, onSave, onClose }) => {
  const { t, lang } = useLanguage();
  const { products } = useCatalog();
  const isEdit = !!quote;
  const [saving, setSaving] = useState(false);

  const [customers, setCustomers] = useState([]);
  const [deals, setDeals] = useState([]);

  const [form, setForm] = useState({
    customerId: '',
    dealId: '',
    currency: 'TRY',
    validUntil: '',
    notes: '',
  });
  const [items, setItems] = useState([
    { name: '', description: '', quantity: 1, unitPrice: 0, taxRate: DEFAULT_TAX_RATE, discountRate: 0, productId: null },
  ]);

  // Müşteri ve deal listelerini çek
  useEffect(() => {
    const fetchData = async () => {
      try {
        const api = (await import('../../services/api')).default;
        const [custRes, dealRes] = await Promise.all([
          api.get('/customers', { params: { limit: 500 } }),
          api.get('/deals'),
        ]);
        setCustomers(custRes.data.data || custRes.data.customers || []);
        setDeals(dealRes.data.data || []);
      } catch {
        // sessiz — bu modal'da hata göstermek UX bozar
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (quote) {
      setForm({
        customerId: quote.customer?._id || quote.customer || '',
        dealId: quote.deal?._id || quote.deal || '',
        currency: quote.currency || 'TRY',
        validUntil: quote.validUntil ? new Date(quote.validUntil).toISOString().slice(0, 10) : '',
        notes: quote.notes || '',
      });
      setItems(
        (quote.items || []).map((it) => ({
          name: it.name,
          description: it.description || '',
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          taxRate: it.taxRate ?? DEFAULT_TAX_RATE,
          discountRate: it.discountRate || 0,
          productId: it.product?._id || it.product || null,
        }))
      );
    }
  }, [quote]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const setField = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // Canlı toplam hesaplama
  const computed = withComputedTotals({ items, currency: form.currency });
  const sym = CURRENCY_SYMBOL[form.currency] || form.currency;

  const formatMoney = (val) =>
    `${sym}${Number(val || 0).toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US', { minimumFractionDigits: 2 })}`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.customerId) {
      toast.error(t('quotes.customerRequired'));
      return;
    }
    if (items.length === 0 || !items.some((it) => it.name.trim())) {
      toast.error(t('quotes.itemsRequired'));
      return;
    }
    setSaving(true);
    try {
      await onSave({
        customerId: form.customerId,
        dealId: form.dealId || undefined,
        currency: form.currency,
        validUntil: form.validUntil || undefined,
        notes: form.notes,
        items: items.map((it) => ({
          productId: it.productId || undefined,
          name: it.name,
          description: it.description,
          quantity: Number(it.quantity),
          unitPrice: Number(it.unitPrice),
          taxRate: Number(it.taxRate),
          discountRate: Number(it.discountRate),
        })),
      });
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="quote-builder-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? t('quotes.editQuote') : t('quotes.newQuote')}</h2>
          <button type="button" className="btn-icon" onClick={onClose}><HiOutlineX /></button>
        </div>
        <form className="quote-builder-body" onSubmit={handleSubmit}>
          <div className="quote-builder-top">
            <div className="form-row">
              <label className="form-group">
                <span className="form-label">{t('quotes.customer')} *</span>
                <select className="form-select" value={form.customerId} onChange={setField('customerId')} required>
                  <option value="">{t('quotes.selectCustomer')}</option>
                  {customers.map((c) => (
                    <option key={c._id} value={c._id}>{c.name} {c.company ? `(${c.company})` : ''}</option>
                  ))}
                </select>
              </label>
              <label className="form-group">
                <span className="form-label">{t('quotes.deal')}</span>
                <select className="form-select" value={form.dealId} onChange={setField('dealId')}>
                  <option value="">{t('quotes.noDeal')}</option>
                  {deals.map((d) => (
                    <option key={d._id} value={d._id}>{d.title}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="form-row">
              <label className="form-group">
                <span className="form-label">{t('quotes.currency')}</span>
                <select className="form-select" value={form.currency} onChange={setField('currency')}>
                  {CATALOG_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label className="form-group">
                <span className="form-label">{t('quotes.validUntil')}</span>
                <input className="form-input" type="date" value={form.validUntil} onChange={setField('validUntil')} />
              </label>
            </div>
          </div>

          <QuoteLineItems
            items={items}
            setItems={setItems}
            products={products}
            currency={form.currency}
            t={t}
            lang={lang}
          />

          <div className="quote-builder-totals">
            <div className="quote-total-row">
              <span>{t('quotes.subtotal')}</span>
              <span>{formatMoney(computed.subtotal)}</span>
            </div>
            <div className="quote-total-row">
              <span>{t('quotes.tax')}</span>
              <span>{formatMoney(computed.totalTax)}</span>
            </div>
            <div className="quote-total-row quote-grand-total">
              <span>{t('quotes.grandTotal')}</span>
              <span>{formatMoney(computed.grandTotal)}</span>
            </div>
          </div>

          <label className="form-group">
            <span className="form-label">{t('quotes.notes')}</span>
            <textarea className="form-textarea" value={form.notes} onChange={setField('notes')} maxLength={2000} rows={3} />
          </label>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {isEdit ? t('common.save') : t('quotes.createDraft')}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default QuoteBuilder;

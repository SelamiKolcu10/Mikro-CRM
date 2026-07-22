import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { HiOutlineX } from 'react-icons/hi';
import { useLanguage } from '../../context/LanguageContext';
import { PRODUCT_UNITS, CATALOG_CURRENCIES, DEFAULT_TAX_RATE } from '../../config/catalog';

/**
 * Ürün oluştur/düzenle modal — DealFormModal deseni (portal'lı).
 */
const CatalogForm = ({ product, onSave, onClose }) => {
  const { t } = useLanguage();
  const isEdit = !!product;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    sku: '',
    unitPrice: '',
    currency: 'TRY',
    taxRate: DEFAULT_TAX_RATE,
    unit: 'piece',
    category: '',
  });

  useEffect(() => {
    if (product) {
      setForm({
        name: product.name || '',
        description: product.description || '',
        sku: product.sku || '',
        unitPrice: product.unitPrice ?? '',
        currency: product.currency || 'TRY',
        taxRate: product.taxRate ?? DEFAULT_TAX_RATE,
        unit: product.unit || 'piece',
        category: product.category || '',
      });
    }
  }, [product]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const setField = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || form.unitPrice === '') return;
    setSaving(true);
    try {
      await onSave({
        name: form.name.trim(),
        description: form.description.trim(),
        sku: form.sku.trim(),
        unitPrice: Number(form.unitPrice),
        currency: form.currency,
        taxRate: Number(form.taxRate),
        unit: form.unit,
        category: form.category.trim(),
      });
    } catch (err) {
      // parent handles toast
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="modal-container catalog-form-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? t('catalog.editProduct') : t('catalog.newProduct')}</h2>
          <button type="button" className="btn-icon" onClick={onClose}>
            <HiOutlineX />
          </button>
        </div>
        <form className="modal-body" onSubmit={handleSubmit}>
          <label className="form-group">
            <span className="form-label">{t('catalog.productName')} *</span>
            <input className="form-input" type="text" value={form.name} onChange={setField('name')} maxLength={150} required />
          </label>
          <label className="form-group">
            <span className="form-label">{t('catalog.description')}</span>
            <textarea className="form-textarea" value={form.description} onChange={setField('description')} maxLength={1000} rows={2} />
          </label>
          <div className="form-row">
            <label className="form-group">
              <span className="form-label">{t('catalog.unitPrice')} *</span>
              <input className="form-input" type="number" min="0" step="0.01" value={form.unitPrice} onChange={setField('unitPrice')} required />
            </label>
            <label className="form-group">
              <span className="form-label">{t('catalog.currency')}</span>
              <select className="form-select" value={form.currency} onChange={setField('currency')}>
                {CATALOG_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          </div>
          <div className="form-row">
            <label className="form-group">
              <span className="form-label">{t('catalog.taxRate')} (%)</span>
              <input className="form-input" type="number" min="0" max="100" value={form.taxRate} onChange={setField('taxRate')} />
            </label>
            <label className="form-group">
              <span className="form-label">{t('catalog.unit')}</span>
              <select className="form-select" value={form.unit} onChange={setField('unit')}>
                {PRODUCT_UNITS.map((u) => <option key={u} value={u}>{t(`catalog.unit.${u}`)}</option>)}
              </select>
            </label>
          </div>
          <div className="form-row">
            <label className="form-group">
              <span className="form-label">{t('catalog.sku')}</span>
              <input className="form-input" type="text" value={form.sku} onChange={setField('sku')} maxLength={50} />
            </label>
            <label className="form-group">
              <span className="form-label">{t('catalog.category')}</span>
              <input className="form-input" type="text" value={form.category} onChange={setField('category')} maxLength={100} />
            </label>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {isEdit ? t('common.save') : t('common.create')}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default CatalogForm;

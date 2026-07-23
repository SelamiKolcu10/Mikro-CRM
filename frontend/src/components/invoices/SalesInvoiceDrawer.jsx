import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  HiOutlineX, HiOutlineDocumentDownload, HiOutlinePencil, HiOutlineCheck, HiOutlineRefresh,
} from 'react-icons/hi';
import { useLanguage } from '../../context/LanguageContext';
import { useCatalog } from '../../hooks/useCatalog';
import { CATALOG_CURRENCIES, CURRENCY_SYMBOL } from '../../config/catalog';
import { withComputedTotals } from '../../utils/quoteTotals';
import invoiceService from '../../services/invoiceService';
import QuoteLineItems from '../quotes/QuoteLineItems';
import toast from 'react-hot-toast';

const STATUS_LABEL = {
  draft: 'Taslak',
  issued: 'Kesildi',
  paid: 'Ödendi',
  overdue: 'Vadesi Geçti',
  cancelled: 'İptal',
};
const STATUS_OPTIONS = ['draft', 'issued', 'paid', 'overdue', 'cancelled'];
const LOCKED = ['paid', 'cancelled']; // düzenlemeye kapalı (salt görünüm)

// Resmî e-Fatura (GİB) durum etiketleri — CRM ödeme durumundan AYRI eksen.
const EINVOICE_STATUS_LABEL = {
  NONE: 'Kesilmedi', SENDING: 'Gönderiliyor…', ISSUED: 'Kesildi (GİB)', FAILED: 'Hata',
};

const toDateInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

/**
 * Satış faturası detay + manuel düzenleme çekmecesi. QuoteDetailDrawer deseni;
 * düzenlemede QuoteLineItems editörünü ve canlı toplam hesabını yeniden kullanır.
 * 'Ödendi'/'İptal' faturalar kilitli — sadece görüntülenir (bkz. updateInvoice).
 */
const SalesInvoiceDrawer = ({ invoice, canWrite, onClose, onSaved }) => {
  const { t, lang } = useLanguage();
  const { products } = useCatalog();
  const drawerRef = useRef(null);

  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ currency: 'TRY', issueDate: '', dueDate: '', notes: '', paymentNotes: '' });
  const [items, setItems] = useState([]);

  // Resmî e-Fatura durumu (backend eInvoice alt-dökümanı yansıması)
  const [ei, setEi] = useState(invoice?.eInvoice || { status: 'NONE' });
  const [showEiForm, setShowEiForm] = useState(false);
  const [eiBusy, setEiBusy] = useState(false);
  const [eiForm, setEiForm] = useState({ taxNumber: '', taxOffice: '', address: '', city: '', district: '' });
  const setEiField = (k) => (e) => setEiForm((f) => ({ ...f, [k]: e.target.value }));

  // Fatura değişince (farklı satır) e-fatura durumunu tazele.
  useEffect(() => {
    setEi(invoice?.eInvoice || { status: 'NONE' });
    setShowEiForm(false);
  }, [invoice?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!invoice) return;
    drawerRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') { if (editMode) setEditMode(false); else onClose(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [invoice, editMode, onClose]);

  if (!invoice) return null;

  const locked = LOCKED.includes(invoice.status);
  const sym = CURRENCY_SYMBOL[invoice.currency] || invoice.currency;
  const formatMoney = (val, s = sym) =>
    `${s}${Number(val || 0).toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US', { minimumFractionDigits: 2 })}`;
  const formatDate = (d) => (d ? new Date(d).toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US') : '-');

  const startEdit = () => {
    setForm({
      currency: invoice.currency || 'TRY',
      issueDate: toDateInput(invoice.issueDate),
      dueDate: toDateInput(invoice.dueDate),
      notes: invoice.notes || '',
      paymentNotes: invoice.paymentNotes || '',
    });
    setItems((invoice.items || []).map((it) => ({
      name: it.name || '',
      description: it.description || '',
      quantity: it.quantity ?? 1,
      unitPrice: it.unitPrice ?? 0,
      taxRate: it.taxRate ?? 20,
      discountRate: it.discountRate ?? 0,
      productId: it.product?._id || it.product || null,
    })));
    setEditMode(true);
  };

  const setField = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleDownloadPdf = async () => {
    try {
      const res = await invoiceService.getSalesPdf(invoice._id);
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${invoice.invoiceNumber}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error(t('common.error'));
    }
  };

  const handleStatusChange = async (status) => {
    if (status === invoice.status) return;
    try {
      const res = await invoiceService.updateSalesStatus(invoice._id, status);
      toast.success('Fatura durumu güncellendi.');
      onSaved(res.data.data);
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.error'));
    }
  };

  const handleSave = async () => {
    if (items.length === 0 || items.some((it) => !it.name.trim())) {
      toast.error('Her kalemin adı olmalı ve en az bir kalem bulunmalı.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        currency: form.currency,
        issueDate: form.issueDate || null,
        dueDate: form.dueDate || null,
        notes: form.notes,
        paymentNotes: form.paymentNotes,
        items: items.map((it) => ({
          productId: it.productId || null,
          name: it.name.trim(),
          description: it.description || '',
          quantity: Number(it.quantity),
          unitPrice: Number(it.unitPrice),
          taxRate: Number(it.taxRate),
          discountRate: Number(it.discountRate) || 0,
        })),
      };
      const res = await invoiceService.updateSalesInvoice(invoice._id, payload);
      toast.success('Fatura güncellendi.');
      onSaved(res.data.data);
      setEditMode(false);
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  // ---- Resmî e-Fatura akışı ----
  const eiHasPdf = ei.hasPdf ?? !!ei.pdfBase64;

  const startEInvoice = () => {
    const c = invoice.customer || {};
    const snap = invoice.eInvoice?.recipientSnapshot || {};
    setEiForm({
      taxNumber: c.taxNumber || snap.taxNumber || '',
      taxOffice: c.taxOffice || snap.taxOffice || '',
      address: c.address || snap.address || '',
      city: c.city || snap.city || '',
      district: c.district || snap.district || '',
    });
    setShowEiForm(true);
  };

  const syncEi = (newEi) => {
    setEi(newEi);
    // Liste rozetini de tazele (drawer'ı bozmadan): merged invoice ile onSaved.
    onSaved?.({ ...invoice, eInvoice: { ...(invoice.eInvoice || {}), ...newEi } });
  };

  const submitEInvoice = async () => {
    setEiBusy(true);
    try {
      const res = await invoiceService.issueEInvoice(invoice._id, eiForm);
      syncEi(res.data.data.eInvoice);
      setShowEiForm(false);
      toast.success('Resmî fatura gönderildi (durum: Gönderiliyor).');
      // Onay POLL ile kesinleşir — bir kez otomatik dene (mock'ta hemen ISSUED).
      refreshEi(true);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Resmî kesim başarısız.');
    } finally {
      setEiBusy(false);
    }
  };

  const refreshEi = async (silent = false) => {
    setEiBusy(true);
    try {
      const res = await invoiceService.refreshEInvoice(invoice._id);
      syncEi(res.data.data.eInvoice);
      if (!silent) toast.success('Durum güncellendi.');
    } catch (err) {
      if (!silent) toast.error(err.response?.data?.error || 'Durum güncellenemedi.');
    } finally {
      setEiBusy(false);
    }
  };

  const downloadEiPdf = async () => {
    try {
      const res = await invoiceService.getEInvoicePdf(invoice._id);
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url; a.download = `efatura-${invoice.invoiceNumber}.pdf`; a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('E-Fatura PDF bulunamadı.');
    }
  };

  const editTotals = editMode ? withComputedTotals({ items }) : null;

  return createPortal(
    <div className="drawer-backdrop" onClick={onClose}>
      <div
        className="project-drawer quote-detail-drawer"
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        ref={drawerRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="project-drawer-header">
          <div className="quote-drawer-heading">
            <h2>{invoice.invoiceNumber}</h2>
            <div className="quote-drawer-meta">
              <span className="quote-status-badge">{STATUS_LABEL[invoice.status] || invoice.status}</span>
              {invoice.quote?.quoteNumber && (
                <span className="quote-version-badge">{invoice.quote.quoteNumber}</span>
              )}
            </div>
          </div>
          <button type="button" className="btn-icon" onClick={onClose} aria-label={t('common.close')}>
            <HiOutlineX />
          </button>
        </div>

        <div className="project-drawer-body">
          {/* Üst bilgi ızgarası */}
          <section className="project-drawer-section">
            <div className="quote-detail-grid">
              <div className="quote-detail-item">
                <span className="quote-detail-label">Müşteri</span>
                <span>{invoice.customer?.name || invoice.customer?.company || '-'}</span>
              </div>
              <div className="quote-detail-item">
                <span className="quote-detail-label">İlişkili Teklif</span>
                <span>{invoice.quote?.quoteNumber || '-'}</span>
              </div>
              <div className="quote-detail-item">
                <span className="quote-detail-label">Sorumlu</span>
                <span>{invoice.owner?.name || '-'}</span>
              </div>
              {!editMode ? (
                <>
                  <div className="quote-detail-item">
                    <span className="quote-detail-label">Fatura Tarihi</span>
                    <span>{formatDate(invoice.issueDate)}</span>
                  </div>
                  <div className="quote-detail-item">
                    <span className="quote-detail-label">Vade Tarihi</span>
                    <span>{formatDate(invoice.dueDate)}</span>
                  </div>
                  {invoice.paidAt && (
                    <div className="quote-detail-item">
                      <span className="quote-detail-label">Ödeme Tarihi</span>
                      <span>{formatDate(invoice.paidAt)}</span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <label className="quote-detail-item">
                    <span className="quote-detail-label">Fatura Tarihi</span>
                    <input className="form-input" type="date" value={form.issueDate} onChange={setField('issueDate')} />
                  </label>
                  <label className="quote-detail-item">
                    <span className="quote-detail-label">Vade Tarihi</span>
                    <input className="form-input" type="date" value={form.dueDate} onChange={setField('dueDate')} />
                  </label>
                  <label className="quote-detail-item">
                    <span className="quote-detail-label">Para Birimi</span>
                    <select className="form-select" value={form.currency} onChange={setField('currency')}>
                      {CATALOG_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>
                </>
              )}
            </div>
          </section>

          {/* Kalemler */}
          <section className="project-drawer-section">
            <span className="form-label">Kalemler</span>
            {!editMode ? (
              <>
                <table className="quote-detail-items-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Ürün / Hizmet</th>
                      <th className="right">Miktar</th>
                      <th className="right">Birim Fiyat</th>
                      <th className="right">İndirim</th>
                      <th className="right">KDV</th>
                      <th className="right">Toplam</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(invoice.items || []).map((item, i) => (
                      <tr key={item._id || i}>
                        <td>{i + 1}</td>
                        <td>
                          {item.name}
                          {item.description && <br />}
                          {item.description && <small>{item.description}</small>}
                        </td>
                        <td className="right">{item.quantity}</td>
                        <td className="right">{formatMoney(item.unitPrice)}</td>
                        <td className="right">{item.discountRate ? `%${item.discountRate}` : '-'}</td>
                        <td className="right">%{item.taxRate}</td>
                        <td className="right">{formatMoney(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="quote-drawer-totals">
                  <div className="quote-total-row">
                    <span>Ara Toplam</span>
                    <span>{formatMoney(invoice.subtotal)}</span>
                  </div>
                  <div className="quote-total-row">
                    <span>KDV</span>
                    <span>{formatMoney(invoice.totalTax)}</span>
                  </div>
                  <div className="quote-total-row quote-grand-total">
                    <span>Genel Toplam</span>
                    <span>{formatMoney(invoice.grandTotal)}</span>
                  </div>
                </div>
              </>
            ) : (
              <>
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
                    <span>Ara Toplam</span>
                    <span>{formatMoney(editTotals.subtotal, CURRENCY_SYMBOL[form.currency] || form.currency)}</span>
                  </div>
                  <div className="quote-total-row">
                    <span>KDV</span>
                    <span>{formatMoney(editTotals.totalTax, CURRENCY_SYMBOL[form.currency] || form.currency)}</span>
                  </div>
                  <div className="quote-total-row quote-grand-total">
                    <span>Genel Toplam</span>
                    <span>{formatMoney(editTotals.grandTotal, CURRENCY_SYMBOL[form.currency] || form.currency)}</span>
                  </div>
                </div>
              </>
            )}
          </section>

          {/* Notlar */}
          <section className="project-drawer-section">
            <span className="form-label">Notlar</span>
            {!editMode ? (
              <p className="quote-notes-text">{invoice.notes || '-'}</p>
            ) : (
              <textarea className="form-textarea" value={form.notes} onChange={setField('notes')} maxLength={2000} rows={2} />
            )}
          </section>

          {/* Resmî e-Fatura (GİB) — CRM ödeme durumundan ayrı eksen */}
          {!editMode && (
            <section className="project-drawer-section einvoice-section">
              <span className="form-label">Resmî e-Fatura (GİB)</span>
              <div className="einvoice-status-row">
                <span className={`einvoice-badge einvoice-badge--${(ei.status || 'NONE').toLowerCase()}`}>
                  {EINVOICE_STATUS_LABEL[ei.status || 'NONE'] || ei.status}
                </span>
                {ei.officialNumber && <span className="einvoice-official">No: {ei.officialNumber}</span>}
                {ei.status === 'SENDING' && <span className="einvoice-hint">onay için durumu yenileyin</span>}
              </div>
              {ei.status === 'FAILED' && ei.error && <p className="einvoice-error">{ei.error}</p>}

              {canWrite && !showEiForm && (
                <div className="einvoice-actions">
                  {(ei.status === 'NONE' || ei.status === 'FAILED') && (
                    <button type="button" className="btn btn-einvoice" onClick={startEInvoice} disabled={eiBusy}>
                      📄 {ei.status === 'FAILED' ? 'Tekrar Kes (E-Fatura)' : 'Resmî Fatura Kes (E-Fatura)'}
                    </button>
                  )}
                  {ei.status === 'SENDING' && (
                    <button type="button" className="btn btn-secondary" onClick={() => refreshEi()} disabled={eiBusy}>
                      <HiOutlineRefresh /> Durumu Yenile
                    </button>
                  )}
                  {eiHasPdf && (
                    <button type="button" className="btn btn-secondary" onClick={downloadEiPdf}>
                      <HiOutlineDocumentDownload /> E-Fatura PDF
                    </button>
                  )}
                </div>
              )}

              {canWrite && showEiForm && (
                <div className="einvoice-form">
                  <p className="einvoice-hint">Alıcı vergi bilgileri (resmî fatura için zorunlu):</p>
                  <div className="form-row">
                    <label className="form-group">
                      <span className="form-label">VKN / TCKN *</span>
                      <input className="form-input" value={eiForm.taxNumber} onChange={setEiField('taxNumber')} maxLength={11} placeholder="10 (VKN) veya 11 (TCKN) hane" />
                    </label>
                    <label className="form-group">
                      <span className="form-label">Vergi Dairesi</span>
                      <input className="form-input" value={eiForm.taxOffice} onChange={setEiField('taxOffice')} />
                    </label>
                  </div>
                  <label className="form-group">
                    <span className="form-label">Adres *</span>
                    <input className="form-input" value={eiForm.address} onChange={setEiField('address')} />
                  </label>
                  <div className="form-row">
                    <label className="form-group">
                      <span className="form-label">İl</span>
                      <input className="form-input" value={eiForm.city} onChange={setEiField('city')} />
                    </label>
                    <label className="form-group">
                      <span className="form-label">İlçe</span>
                      <input className="form-input" value={eiForm.district} onChange={setEiField('district')} />
                    </label>
                  </div>
                  <div className="einvoice-form-actions">
                    <button type="button" className="btn btn-einvoice" onClick={submitEInvoice} disabled={eiBusy}>
                      Kes ve Gönder
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => setShowEiForm(false)} disabled={eiBusy}>
                      Vazgeç
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Aksiyonlar */}
          {canWrite && (
            <section className="project-drawer-section quote-drawer-actions">
              {!editMode ? (
                <>
                  <button type="button" className="btn btn-secondary" onClick={handleDownloadPdf}>
                    <HiOutlineDocumentDownload /> PDF İndir
                  </button>
                  {!locked && (
                    <>
                      <button type="button" className="btn btn-secondary" onClick={startEdit}>
                        <HiOutlinePencil /> Düzenle
                      </button>
                      <label className="sales-invoice-status-select">
                        <span>Durum:</span>
                        <select
                          className="form-select"
                          value={invoice.status}
                          onChange={(e) => handleStatusChange(e.target.value)}
                        >
                          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                        </select>
                      </label>
                    </>
                  )}
                  {locked && (
                    <span className="sales-invoice-lock-note">
                      Bu fatura {STATUS_LABEL[invoice.status].toLowerCase()} durumunda — salt görünüm.
                    </span>
                  )}
                </>
              ) : (
                <>
                  <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
                    <HiOutlineCheck /> Kaydet
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => setEditMode(false)} disabled={saving}>
                    Vazgeç
                  </button>
                </>
              )}
            </section>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default SalesInvoiceDrawer;

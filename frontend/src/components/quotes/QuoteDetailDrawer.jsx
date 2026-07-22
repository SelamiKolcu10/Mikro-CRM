import { useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { HiOutlineX, HiOutlineDocumentDownload, HiOutlinePaperAirplane, HiOutlinePencil, HiOutlineTrash, HiOutlineRefresh } from 'react-icons/hi';
import { useLanguage } from '../../context/LanguageContext';
import { QUOTE_STATUS_CLASS } from '../../config/quotes';
import { CURRENCY_SYMBOL } from '../../config/catalog';
import quoteService from '../../services/quoteService';
import toast from 'react-hot-toast';

/**
 * Teklif detay drawer — salt-görünüm + Gönder/Revize/PDF İndir aksiyonları.
 * Portal'lı DealDetailDrawer deseni.
 */
const QuoteDetailDrawer = ({ quote, canWrite, onClose, onSend, onRevise, onDelete, onEdit, onRefresh }) => {
  const { t, lang } = useLanguage();
  const drawerRef = useRef(null);

  useEffect(() => {
    if (!quote) return;
    drawerRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [quote, onClose]);

  if (!quote) return null;

  const sym = CURRENCY_SYMBOL[quote.currency] || quote.currency;
  const formatMoney = (val) =>
    `${sym}${Number(val || 0).toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US', { minimumFractionDigits: 2 })}`;
  const formatDate = (d) => d ? new Date(d).toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US') : '-';

  const handleDownloadPdf = async () => {
    try {
      const res = await quoteService.getPdf(quote._id);
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${quote.quoteNumber}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.error'));
    }
  };

  const handleSend = async () => {
    try {
      await onSend(quote._id);
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.error'));
    }
  };

  const handleRevise = async () => {
    try {
      await onRevise(quote._id);
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.error'));
    }
  };

  const handleDelete = async () => {
    try {
      await onDelete(quote._id);
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.error'));
    }
  };

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
            <h2>{quote.quoteNumber}</h2>
            <div className="quote-drawer-meta">
              <span className={`quote-status-badge ${QUOTE_STATUS_CLASS[quote.status]}`}>
                {t(`quotes.statusLabel.${quote.status}`)}
              </span>
              {quote.version > 1 && (
                <span className="quote-version-badge">v{quote.version}</span>
              )}
            </div>
          </div>
          <button type="button" className="btn-icon" onClick={onClose} aria-label={t('common.close')}>
            <HiOutlineX />
          </button>
        </div>

        <div className="project-drawer-body">
          <section className="project-drawer-section">
            <div className="quote-detail-grid">
              <div className="quote-detail-item">
                <span className="quote-detail-label">{t('quotes.customer')}</span>
                <span>{quote.customer?.name || '-'}</span>
              </div>
              <div className="quote-detail-item">
                <span className="quote-detail-label">{t('quotes.deal')}</span>
                <span>{quote.deal?.title || '-'}</span>
              </div>
              <div className="quote-detail-item">
                <span className="quote-detail-label">{t('quotes.owner')}</span>
                <span>{quote.owner?.name || '-'}</span>
              </div>
              <div className="quote-detail-item">
                <span className="quote-detail-label">{t('quotes.date')}</span>
                <span>{formatDate(quote.createdAt)}</span>
              </div>
              <div className="quote-detail-item">
                <span className="quote-detail-label">{t('quotes.validUntil')}</span>
                <span>{formatDate(quote.validUntil)}</span>
              </div>
              {quote.sentAt && (
                <div className="quote-detail-item">
                  <span className="quote-detail-label">{t('quotes.sentAt')}</span>
                  <span>{formatDate(quote.sentAt)}</span>
                </div>
              )}
            </div>
          </section>

          <section className="project-drawer-section">
            <span className="form-label">{t('quotes.items')}</span>
            <table className="quote-detail-items-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t('quotes.itemName')}</th>
                  <th className="right">{t('quotes.qty')}</th>
                  <th className="right">{t('quotes.price')}</th>
                  <th className="right">{t('quotes.discount')}</th>
                  <th className="right">{t('quotes.taxRate')}</th>
                  <th className="right">{t('quotes.lineTotal')}</th>
                </tr>
              </thead>
              <tbody>
                {(quote.items || []).map((item, i) => (
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
                <span>{t('quotes.subtotal')}</span>
                <span>{formatMoney(quote.subtotal)}</span>
              </div>
              <div className="quote-total-row">
                <span>{t('quotes.tax')}</span>
                <span>{formatMoney(quote.totalTax)}</span>
              </div>
              <div className="quote-total-row quote-grand-total">
                <span>{t('quotes.grandTotal')}</span>
                <span>{formatMoney(quote.grandTotal)}</span>
              </div>
            </div>
          </section>

          {quote.notes && (
            <section className="project-drawer-section">
              <span className="form-label">{t('quotes.notes')}</span>
              <p className="quote-notes-text">{quote.notes}</p>
            </section>
          )}

          {canWrite && (
            <section className="project-drawer-section quote-drawer-actions">
              <button type="button" className="btn btn-secondary" onClick={handleDownloadPdf}>
                <HiOutlineDocumentDownload /> {t('quotes.downloadPdf')}
              </button>
              {quote.status === 'draft' && (
                <>
                  <button type="button" className="btn btn-primary" onClick={handleSend}>
                    <HiOutlinePaperAirplane /> {t('quotes.send')}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => onEdit(quote)}>
                    <HiOutlinePencil /> {t('common.edit')}
                  </button>
                  <button type="button" className="btn btn-ghost btn-danger" onClick={handleDelete}>
                    <HiOutlineTrash /> {t('common.delete')}
                  </button>
                </>
              )}
              {quote.status === 'sent' && (
                <button type="button" className="btn btn-secondary" onClick={handleRevise}>
                  <HiOutlineRefresh /> {t('quotes.revise')}
                </button>
              )}
              {quote.status === 'accepted' && !quote.invoice && (
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={async () => {
                    try {
                      const invoiceService = (await import('../../services/invoiceService')).default;
                      const res = await invoiceService.generateFromQuote(quote._id);
                      toast.success(`Fatura oluşturuldu: ${res.data.data.invoiceNumber}`);
                      if (onRefresh) onRefresh();
                      onClose();
                    } catch (err) {
                      toast.error(err.response?.data?.error || t('common.error'));
                    }
                  }}
                >
                  Faturaya Dönüştür
                </button>
              )}
            </section>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default QuoteDetailDrawer;

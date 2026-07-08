import { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import Modal from '../common/Modal';

const InvoiceDetailModal = ({ invoice, isOpen, onClose, onSave }) => {
  const { t } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});

  if (!invoice) return null;

  const formatCurrency = (value) => {
    return `₺${Number(value || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('tr-TR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  };

  const handleEditStart = () => {
    setEditForm({
      vendorName: invoice.vendorName || '',
      vendorTaxNumber: invoice.vendorTaxNumber || '',
      invoiceNumber: invoice.invoiceNumber || '',
      invoiceDate: invoice.invoiceDate ? new Date(invoice.invoiceDate).toISOString().split('T')[0] : '',
      lineItems: invoice.lineItems?.map((item) => ({ ...item })) || [],
      grandTotal: invoice.grandTotal || 0,
    });
    setEditing(true);
  };

  const handleFieldChange = (field, value) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleLineItemChange = (index, field, value) => {
    setEditForm((prev) => {
      const items = [...prev.lineItems];
      items[index] = { ...items[index], [field]: field === 'description' ? value : Number(value) || 0 };
      return { ...prev, lineItems: items };
    });
  };

  const handleSave = () => {
    if (onSave) {
      onSave(invoice._id, editForm);
    }
    setEditing(false);
  };

  const statusColors = {
    verified: 'var(--color-success)',
    mismatch: 'var(--color-warning)',
    pending: 'var(--color-info)',
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => { setEditing(false); onClose(); }}
      title={
        <>
          🧾 {invoice.vendorName || t('invoices.lineItems')}
          <span
            className="modal-status-dot"
            style={{ backgroundColor: statusColors[invoice.validationStatus] }}
          />
        </>
      }
      footer={
        <div className="modal-actions">
          {!editing && (
            <button className="btn btn-secondary" onClick={handleEditStart} id="start-correction-btn">
              {t('invoices.manualCorrection')}
            </button>
          )}
          {editing && (
            <>
              <button className="btn btn-ghost" onClick={() => setEditing(false)}>
                {t('common.cancel')}
              </button>
              <button className="btn btn-primary" onClick={handleSave} id="save-correction-btn">
                {t('common.save')}
              </button>
            </>
          )}
          {!editing && (
            <button className="btn btn-ghost" onClick={onClose}>
              {t('common.close')}
            </button>
          )}
        </div>
      }
    >
      {/* Warning banner for mismatch */}
      {invoice.validationStatus === 'mismatch' && (
        <div className="alert alert-warning" id="mismatch-alert">
          ⚠️ {invoice.validationMessage || t('invoices.correctionHint')}
        </div>
      )}

      {/* Vendor Info */}
      <div className="detail-section">
        <div className="detail-grid">
          <div className="detail-item">
            <label>{t('invoices.vendor')}</label>
            {editing ? (
              <input
                type="text"
                className="form-input compact"
                value={editForm.vendorName}
                onChange={(e) => handleFieldChange('vendorName', e.target.value)}
              />
            ) : (
              <span>{invoice.vendorName || '—'}</span>
            )}
          </div>
          <div className="detail-item">
            <label>{t('invoices.vendorTax')}</label>
            {editing ? (
              <input
                type="text"
                className="form-input compact"
                value={editForm.vendorTaxNumber}
                onChange={(e) => handleFieldChange('vendorTaxNumber', e.target.value)}
              />
            ) : (
              <span>{invoice.vendorTaxNumber || '—'}</span>
            )}
          </div>
          <div className="detail-item">
            <label>{t('invoices.invoiceNo')}</label>
            {editing ? (
              <input
                type="text"
                className="form-input compact"
                value={editForm.invoiceNumber}
                onChange={(e) => handleFieldChange('invoiceNumber', e.target.value)}
              />
            ) : (
              <span>{invoice.invoiceNumber || '—'}</span>
            )}
          </div>
          <div className="detail-item">
            <label>{t('invoices.invoiceDate')}</label>
            {editing ? (
              <input
                type="date"
                className="form-input compact"
                value={editForm.invoiceDate}
                onChange={(e) => handleFieldChange('invoiceDate', e.target.value)}
              />
            ) : (
              <span>{formatDate(invoice.invoiceDate)}</span>
            )}
          </div>
        </div>
      </div>

      {/* Line Items Table */}
      <div className="detail-section">
        <h4>{t('invoices.lineItems')}</h4>
        <div className="table-responsive">
          <table className="data-table compact">
            <thead>
              <tr>
                <th>{t('invoices.description')}</th>
                <th className="text-right">{t('invoices.baseAmount')}</th>
                <th className="text-center">{t('invoices.vatRate')}</th>
                <th className="text-right">{t('invoices.vatAmount')}</th>
                <th className="text-right">{t('invoices.totalAmount')}</th>
              </tr>
            </thead>
            <tbody>
              {(editing ? editForm.lineItems : invoice.lineItems)?.map((item, idx) => (
                <tr key={idx}>
                  <td>
                    {editing ? (
                      <input
                        type="text"
                        className="form-input compact"
                        value={item.description}
                        onChange={(e) => handleLineItemChange(idx, 'description', e.target.value)}
                      />
                    ) : (
                      item.description || `Kalem ${idx + 1}`
                    )}
                  </td>
                  <td className="text-right">
                    {editing ? (
                      <input
                        type="number"
                        className="form-input compact text-right"
                        value={item.baseAmount}
                        onChange={(e) => handleLineItemChange(idx, 'baseAmount', e.target.value)}
                      />
                    ) : (
                      formatCurrency(item.baseAmount)
                    )}
                  </td>
                  <td className="text-center">
                    {editing ? (
                      <select
                        className="form-select compact"
                        value={item.vatRate}
                        onChange={(e) => handleLineItemChange(idx, 'vatRate', e.target.value)}
                      >
                        <option value={1}>%1</option>
                        <option value={10}>%10</option>
                        <option value={20}>%20</option>
                      </select>
                    ) : (
                      `%${item.vatRate}`
                    )}
                  </td>
                  <td className="text-right">{formatCurrency(item.vatAmount)}</td>
                  <td className="text-right font-semibold">{formatCurrency(item.totalAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* VAT Breakdown Summary */}
      {invoice.vatSummary && invoice.vatSummary.length > 0 && (
        <div className="detail-section">
          <h4>{t('invoices.vatBreakdown')}</h4>
          <div className="vat-summary-grid">
            {invoice.vatSummary.map((group, idx) => (
              <div className="vat-summary-card" key={idx}>
                <div className="vat-rate-badge">%{group.vatRate}</div>
                <div className="vat-summary-details">
                  <div className="vat-detail-row">
                    <span>{t('invoices.baseAmount')}</span>
                    <span>{formatCurrency(group.totalBase)}</span>
                  </div>
                  <div className="vat-detail-row">
                    <span>{t('invoices.vatAmount')}</span>
                    <span className="vat-highlight">{formatCurrency(group.totalVat)}</span>
                  </div>
                  <div className="vat-detail-row total">
                    <span>{t('invoices.totalAmount')}</span>
                    <span>{formatCurrency(group.totalWithVat)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grand Totals */}
      <div className="invoice-totals">
        <div className="totals-row">
          <span>{t('invoices.totalBase')}</span>
          <span>{formatCurrency(invoice.totalBase)}</span>
        </div>
        <div className="totals-row">
          <span>{t('invoices.totalVat')}</span>
          <span className="vat-highlight">{formatCurrency(invoice.totalVat)}</span>
        </div>
        <div className="totals-row grand">
          <span>{t('invoices.grandTotal')}</span>
          <span>{formatCurrency(invoice.grandTotal)}</span>
        </div>
      </div>
    </Modal>
  );
};

export default InvoiceDetailModal;

import { useLanguage } from '../../context/LanguageContext';
import { HiOutlineEye, HiOutlineTrash } from 'react-icons/hi';

const InvoiceTable = ({ invoices, onView, onDelete, loading }) => {
  const { t } = useLanguage();

  const getStatusBadge = (status) => {
    const classMap = {
      verified: 'badge badge-verified',
      mismatch: 'badge badge-mismatch',
      pending: 'badge badge-pending',
    };
    return classMap[status] || 'badge';
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatCurrency = (value) => {
    return `₺${Number(value || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`;
  };

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="spinner" />
      </div>
    );
  }

  if (!invoices || invoices.length === 0) {
    return (
      <div className="table-empty">
        <div className="table-empty-icon">🧾</div>
        <p>{t('invoices.noInvoices')}</p>
        <p className="text-secondary">{t('invoices.uploadFirst')}</p>
      </div>
    );
  }

  return (
    <div className="table-responsive">
      <table className="data-table" id="invoice-table">
        <thead>
          <tr>
            <th>{t('invoices.vendor')}</th>
            <th>{t('invoices.invoiceNo')}</th>
            <th>{t('invoices.invoiceDate')}</th>
            <th>{t('invoices.totalBase')}</th>
            <th>{t('invoices.totalVat')}</th>
            <th>{t('invoices.grandTotal')}</th>
            <th>{t('invoices.status')}</th>
            <th>{t('invoices.confidence')}</th>
            <th>{t('common.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => (
            <tr key={inv._id} className={inv.validationStatus === 'mismatch' ? 'row-warning' : ''}>
              <td>
                <div className="vendor-cell">
                  <span className="vendor-name">{inv.vendorName || '—'}</span>
                  {inv.vendorTaxNumber && (
                    <span className="vendor-tax">{inv.vendorTaxNumber}</span>
                  )}
                </div>
              </td>
              <td>{inv.invoiceNumber || '—'}</td>
              <td>{formatDate(inv.invoiceDate)}</td>
              <td className="text-right">{formatCurrency(inv.totalBase)}</td>
              <td className="text-right">{formatCurrency(inv.totalVat)}</td>
              <td className="text-right font-semibold">{formatCurrency(inv.grandTotal)}</td>
              <td>
                <span className={getStatusBadge(inv.validationStatus)}>
                  {t(`invoices.statuses.${inv.validationStatus}`)}
                </span>
              </td>
              <td>
                <div className="confidence-bar">
                  <div
                    className="confidence-fill"
                    style={{ width: `${inv.confidenceScore || 0}%` }}
                  />
                  <span className="confidence-value">{inv.confidenceScore || 0}%</span>
                </div>
              </td>
              <td>
                <div className="action-buttons">
                  <button
                    className="btn-icon"
                    onClick={() => onView(inv)}
                    title={t('common.edit')}
                    id={`view-invoice-${inv._id}`}
                  >
                    <HiOutlineEye />
                  </button>
                  <button
                    className="btn-icon danger"
                    onClick={() => onDelete(inv._id)}
                    title={t('common.delete')}
                    id={`delete-invoice-${inv._id}`}
                  >
                    <HiOutlineTrash />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default InvoiceTable;

import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext';
import invoiceService from '../services/invoiceService';
import InvoiceUploader from '../components/invoices/InvoiceUploader';
import InvoiceTable from '../components/invoices/InvoiceTable';
import InvoiceDetailModal from '../components/invoices/InvoiceDetailModal';
import InvoiceStats from '../components/invoices/InvoiceStats';
import ConfirmDialog from '../components/common/ConfirmDialog';
import toast from 'react-hot-toast';
import { HiOutlineSearch } from 'react-icons/hi';

const Invoices = () => {
  const { t } = useLanguage();
  const [invoices, setInvoices] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modal state
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  // Upload results
  const [uploadResults, setUploadResults] = useState(null);

  const fetchInvoices = useCallback(async () => {
    try {
      const params = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;

      const [invoicesRes, statsRes] = await Promise.all([
        invoiceService.getAll(params),
        invoiceService.getStats(),
      ]);

      setInvoices(invoicesRes.data.data);
      setStats(statsRes.data.data);
    } catch (err) {
      console.error('Invoice fetch error:', err);
      // Silently handle when service is not running
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // Handle file upload
  const handleUpload = async (files) => {
    setUploading(true);
    setUploadResults(null);

    try {
      let response;
      if (files.length === 1) {
        response = await invoiceService.upload(files[0]);
        toast.success(t('invoices.processComplete'));
      } else {
        response = await invoiceService.bulkUpload(files);
        const summary = response.data.summary;
        toast.success(
          `${t('invoices.processComplete')}: ${summary.verified} ✅ ${summary.mismatch} ⚠️ ${summary.errors} ❌`
        );
        setUploadResults(response.data);
      }

      // Refresh list
      await fetchInvoices();
      return true;
    } catch (err) {
      const message = err.response?.data?.error || err.message || t('common.error');
      toast.error(message);
      return false;
    } finally {
      setUploading(false);
    }
  };

  // View invoice detail
  const handleView = (invoice) => {
    setSelectedInvoice(invoice);
    setDetailOpen(true);
  };

  // Save manual correction
  const handleSaveCorrection = async (id, data) => {
    try {
      await invoiceService.update(id, data);
      toast.success(t('common.update') + ' ✅');
      setDetailOpen(false);
      await fetchInvoices();
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.error'));
    }
  };

  // Delete invoice
  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await invoiceService.delete(deleteId);
      toast.success(t('common.delete') + ' ✅');
      setDeleteId(null);
      await fetchInvoices();
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.error'));
    }
  };

  return (
    <>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1>🧾 {t('invoices.title')}</h1>
          <p>{t('invoices.subtitle')}</p>
        </div>
      </div>

      {/* Stats Cards */}
      <InvoiceStats stats={stats} />

      {/* Upload Section */}
      <div className="table-container" style={{ marginBottom: 'var(--space-xl)' }}>
        <InvoiceUploader onUpload={handleUpload} uploading={uploading} />

        {/* Upload Results Banner */}
        {uploadResults && uploadResults.summary && (
          <div className="upload-results">
            <div className="upload-results-grid">
              <div className="upload-result-item success">
                <span className="upload-result-value">{uploadResults.summary.verified}</span>
                <span className="upload-result-label">{t('invoices.statuses.verified')}</span>
              </div>
              <div className="upload-result-item warning">
                <span className="upload-result-value">{uploadResults.summary.mismatch}</span>
                <span className="upload-result-label">{t('invoices.statuses.mismatch')}</span>
              </div>
              <div className="upload-result-item info">
                <span className="upload-result-value">{uploadResults.summary.pending}</span>
                <span className="upload-result-label">{t('invoices.statuses.pending')}</span>
              </div>
              <div className="upload-result-item danger">
                <span className="upload-result-value">{uploadResults.summary.errors}</span>
                <span className="upload-result-label">Hata</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filters & Search */}
      <div className="table-container">
        <div className="table-header">
          <div className="search-box">
            <HiOutlineSearch />
            <input
              type="text"
              placeholder={t('common.search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              id="invoice-search"
            />
          </div>
          <div className="filter-group">
            <select
              className="form-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              id="invoice-status-filter"
            >
              <option value="">{t('invoices.allStatuses')}</option>
              <option value="verified">{t('invoices.statuses.verified')}</option>
              <option value="mismatch">{t('invoices.statuses.mismatch')}</option>
              <option value="pending">{t('invoices.statuses.pending')}</option>
            </select>
          </div>
        </div>

        {/* Invoice Table */}
        <InvoiceTable
          invoices={invoices}
          onView={handleView}
          onDelete={(id) => setDeleteId(id)}
          loading={loading}
        />
      </div>

      {/* Invoice Detail Modal */}
      <InvoiceDetailModal
        invoice={selectedInvoice}
        isOpen={detailOpen}
        onClose={() => { setDetailOpen(false); setSelectedInvoice(null); }}
        onSave={handleSaveCorrection}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title={t('invoices.deleteConfirm')}
        message={t('invoices.deleteWarning')}
      />
    </>
  );
};

export default Invoices;

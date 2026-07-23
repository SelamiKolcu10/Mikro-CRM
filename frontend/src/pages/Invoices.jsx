import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext';
import invoiceService from '../services/invoiceService';
import invoiceV2Service from '../services/invoiceV2Service';
import SalesInvoiceDrawer from '../components/invoices/SalesInvoiceDrawer';
import InvoiceUploader from '../components/invoices/InvoiceUploader';
import InvoiceTable from '../components/invoices/InvoiceTable';
import InvoiceDetailModal from '../components/invoices/InvoiceDetailModal';
import InvoiceStats from '../components/invoices/InvoiceStats';
import ConfirmDialog from '../components/common/ConfirmDialog';
import toast from 'react-hot-toast';
import { HiOutlineSearch } from 'react-icons/hi';

const SALES_STATUS_LABEL = {
  draft: 'Taslak', issued: 'Kesildi', paid: 'Ödendi', overdue: 'Vadesi Geçti', cancelled: 'İptal',
};

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
        invoiceV2Service.getAll(params),
        invoiceV2Service.getStats(),
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
        response = await invoiceV2Service.upload(files[0]);
        toast.success(t('invoices.processComplete'));
      } else {
        response = await invoiceV2Service.bulkUpload(files);
        const summary = response.data.summary;
        toast.success(
          `${t('invoices.processComplete')}: ${summary.verified} ${t('invoices.statuses.verified')} · ${summary.mismatch} ${t('invoices.statuses.mismatch')} · ${summary.errors} ${t('invoices.errorCount')}`
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
      await invoiceV2Service.update(id, data);
      toast.success(t('common.update'));
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
      await invoiceV2Service.delete(deleteId);
      toast.success(t('common.delete'));
      setDeleteId(null);
      await fetchInvoices();
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.error'));
    }
  };

  // Tab state: 'sales' (CRM Satış Faturaları) veya 'ocr' (Gelen Alış Faturaları)
  const [activeTab, setActiveTab] = useState('sales');

  // Satış Faturaları State
  const [selectedSalesInvoice, setSelectedSalesInvoice] = useState(null);
  const [salesInvoices, setSalesInvoices] = useState([]);
  const [salesLoading, setSalesLoading] = useState(false);
  const [salesStatusFilter, setSalesStatusFilter] = useState('');

  const fetchSalesInvoices = async () => {
    try {
      setSalesLoading(true);
      const res = await invoiceService.getSalesInvoices({ status: salesStatusFilter || undefined });
      setSalesInvoices(res.data.data?.items || []);
    } catch {
      // sessiz
    } finally {
      setSalesLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'sales') {
      fetchSalesInvoices();
    }
  }, [activeTab, salesStatusFilter]);

  const handleDownloadSalesPdf = async (inv) => {
    try {
      const res = await invoiceService.getSalesPdf(inv._id);
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${inv.invoiceNumber}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error(t('common.error'));
    }
  };

  const handleMarkPaid = async (inv) => {
    if (!window.confirm(`${inv.invoiceNumber} faturasını 'Ödendi' olarak işaretlemek istiyor musunuz?`)) return;
    try {
      await invoiceService.updateSalesStatus(inv._id, 'paid');
      toast.success('Fatura ödendi olarak işaretlendi.');
      fetchSalesInvoices();
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.error'));
    }
  };

  return (
    <>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1>{t('invoices.title')}</h1>
          <p>{t('invoices.subtitle')}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="invoice-tabs" style={{ display: 'flex', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
        <button
          type="button"
          className={`btn ${activeTab === 'sales' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('sales')}
        >
          Satış Faturaları (CRM)
        </button>
        <button
          type="button"
          className={`btn ${activeTab === 'ocr' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('ocr')}
        >
          Gelen Faturalar (Yerli OCR)
        </button>
      </div>

      {activeTab === 'sales' ? (
        <>
        <div className="table-container">
          <div className="table-header">
            <h3>Kesilen Satış Faturaları</h3>
            <select
              className="form-select"
              value={salesStatusFilter}
              onChange={(e) => setSalesStatusFilter(e.target.value)}
            >
              <option value="">Tüm Durumlar</option>
              <option value="draft">Taslak</option>
              <option value="issued">Kesildi</option>
              <option value="paid">Ödendi</option>
              <option value="overdue">Vadesi Geçti</option>
              <option value="cancelled">İptal</option>
            </select>
          </div>

          {salesLoading ? (
            <div className="loading-spinner"><div className="spinner" /></div>
          ) : salesInvoices.length === 0 ? (
            <p className="task-comment-empty">Henüz satış faturası yok. Onaylanmış bir teklifi faturaya dönüştürebilirsiniz.</p>
          ) : (
            <table className="catalog-table">
              <thead>
                <tr>
                  <th>Fatura No</th>
                  <th>Müşteri</th>
                  <th>İlişkili Teklif</th>
                  <th>Durum</th>
                  <th className="right">Genel Toplam</th>
                  <th>Fatura Tarihi</th>
                  <th>Vade Tarihi</th>
                  <th className="center">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {salesInvoices.map((inv) => (
                  <tr key={inv._id}>
                    <td><strong>{inv.invoiceNumber}</strong></td>
                    <td>{inv.customer?.name || inv.customer?.company || '-'}</td>
                    <td>{inv.quote?.quoteNumber || '-'}</td>
                    <td>
                      <span className="quote-status-badge">
                        {SALES_STATUS_LABEL[inv.status] || inv.status}
                      </span>
                    </td>
                    <td className="right">{inv.currency} {Number(inv.grandTotal || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                    <td>{inv.issueDate ? new Date(inv.issueDate).toLocaleDateString('tr-TR') : '-'}</td>
                    <td>{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('tr-TR') : '-'}</td>
                    <td className="center">
                      <div className="catalog-actions" style={{ justifyContent: 'center' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setSelectedSalesInvoice(inv)}
                        >
                          İncele
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleDownloadSalesPdf(inv)}
                        >
                          PDF
                        </button>
                        {inv.status === 'issued' && (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => handleMarkPaid(inv)}
                          >
                            Ödendi
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <SalesInvoiceDrawer
          invoice={selectedSalesInvoice}
          canWrite
          onClose={() => setSelectedSalesInvoice(null)}
          onSaved={(updated) => { setSelectedSalesInvoice(updated); fetchSalesInvoices(); }}
        />
        </>
      ) : (
        <>
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
      )}
    </>
  );
};

export default Invoices;

import { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import reportService from '../services/reportService';
import toast from 'react-hot-toast';
import { HiOutlineCurrencyDollar, HiOutlineReceiptTax, HiOutlineDocumentText, HiOutlineDownload } from 'react-icons/hi';

const MONTH_LABELS = {
  '01': 'Oca', '02': 'Şub', '03': 'Mar', '04': 'Nis', '05': 'May', '06': 'Haz',
  '07': 'Tem', '08': 'Ağu', '09': 'Eyl', '10': 'Eki', '11': 'Kas', '12': 'Ara',
};

const formatMonth = (monthKey) => {
  const [year, month] = monthKey.split('-');
  return `${MONTH_LABELS[month] || month} ${year}`;
};

const formatCurrency = (value) =>
  `₺${Number(value || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`;

// Stat cards have fixed width and clip overflow — large aggregate totals
// (₺millions) need compact notation ("₺49,4 Mn") to fit; bar chart labels
// have room for the full precise figure via formatCurrency above.
const formatCompactCurrency = (value) =>
  `₺${new Intl.NumberFormat('tr-TR', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value || 0))}`;

const SpendingDashboard = () => {
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const res = await reportService.getSpendingSummary();
        setData(res.data.data);
      } catch (err) {
        toast.error(t('common.loadError'));
      } finally {
        setLoading(false);
      }
    };
    fetchSummary();
  }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await reportService.exportSpendingCsv();
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `fatura-raporu-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(t('reports.exportSuccess'));
    } catch (err) {
      toast.error(t('common.error'));
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return <div className="loading-spinner"><div className="spinner" /></div>;
  }

  if (!data) return null;

  const maxMonthSpend = Math.max(...data.byMonth.map((m) => m.totalSpend), 1);
  const maxServiceSpend = Math.max(...data.byService.map((s) => s.totalSpend), 1);
  const serviceColors = { v1: 'blue', v2: 'purple' };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>📊 {t('reports.title')}</h1>
          <p>{t('reports.subtitle')}</p>
        </div>
        <button className="btn btn-primary" onClick={handleExport} disabled={exporting}>
          <HiOutlineDownload /> {exporting ? t('common.loading') : t('reports.export')}
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-card purple">
          <div className="stat-icon purple"><HiOutlineCurrencyDollar /></div>
          <div className="stat-info">
            <div className="stat-label">{t('reports.totalSpend')}</div>
            <div className="stat-value" title={formatCurrency(data.overall.totalSpend)}>{formatCompactCurrency(data.overall.totalSpend)}</div>
          </div>
        </div>
        <div className="stat-card cyan">
          <div className="stat-icon cyan"><HiOutlineReceiptTax /></div>
          <div className="stat-info">
            <div className="stat-label">{t('reports.totalVat')}</div>
            <div className="stat-value" title={formatCurrency(data.overall.totalVat)}>{formatCompactCurrency(data.overall.totalVat)}</div>
          </div>
        </div>
        <div className="stat-card green">
          <div className="stat-icon green"><HiOutlineDocumentText /></div>
          <div className="stat-info">
            <div className="stat-label">{t('reports.totalBase')}</div>
            <div className="stat-value" title={formatCurrency(data.overall.totalBase)}>{formatCompactCurrency(data.overall.totalBase)}</div>
          </div>
        </div>
        <div className="stat-card yellow">
          <div className="stat-icon yellow"><HiOutlineDocumentText /></div>
          <div className="stat-info">
            <div className="stat-label">{t('reports.invoiceCount')}</div>
            <div className="stat-value">{data.overall.count}</div>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="chart-card">
          <h3>📅 {t('reports.byMonth')}</h3>
          <div className="bar-chart">
            {data.byMonth.length === 0 ? (
              <p>{t('common.noData')}</p>
            ) : (
              data.byMonth.map((m) => (
                <div className="bar-row" key={m.month}>
                  <span className="bar-label">{formatMonth(m.month)}</span>
                  <div className="bar-track">
                    <div
                      className="bar-fill purple"
                      style={{ width: `${Math.max((m.totalSpend / maxMonthSpend) * 100, 8)}%` }}
                    >
                      {formatCurrency(m.totalSpend)}
                    </div>
                  </div>
                  <span className="bar-value">{m.count}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="chart-card">
          <h3>🧾 {t('reports.byService')}</h3>
          <div className="bar-chart">
            {data.byService.map((s) => (
              <div className="bar-row" key={s.service}>
                <span className="bar-label">{s.label}</span>
                <div className="bar-track">
                  <div
                    className={`bar-fill ${serviceColors[s.service] || 'gray'}`}
                    style={{ width: `${Math.max((s.totalSpend / maxServiceSpend) * 100, 8)}%` }}
                  >
                    {formatCurrency(s.totalSpend)}
                  </div>
                </div>
                <span className="bar-value">{s.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default SpendingDashboard;

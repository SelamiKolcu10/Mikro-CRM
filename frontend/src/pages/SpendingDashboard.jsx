import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext';
import reportService from '../services/reportService';
import AreaChart from '../components/charts/AreaChart';
import { SkeletonDashboard } from '../components/common/Skeleton';
import toast from 'react-hot-toast';
import { HiOutlineCurrencyDollar, HiOutlineReceiptTax, HiOutlineDocumentText, HiOutlineDownload, HiOutlineTrendingUp, HiOutlineTrendingDown, HiOutlineOfficeBuilding } from 'react-icons/hi';

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
  const [refetching, setRefetching] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Only the very first load shows the full-page spinner. Subsequent loads
  // (date filter changes) must not unmount the filter inputs themselves —
  // that would drop focus/mid-interaction state on every keystroke/pick.
  const fetchSummary = useCallback(async () => {
    setRefetching(true);
    try {
      const params = {};
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      const res = await reportService.getSpendingSummary(params);
      setData(res.data.data);
    } catch (err) {
      toast.error(t('common.loadError'));
    } finally {
      setLoading(false);
      setRefetching(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = {};
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      const res = await reportService.exportSpendingCsv(params);
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
    return <SkeletonDashboard />;
  }

  if (!data) return null;

  const maxMonthSpend = Math.max(...data.byMonth.map((m) => m.totalSpend), 1);
  const maxServiceSpend = Math.max(...data.byService.map((s) => s.totalSpend), 1);
  const maxVendorSpend = Math.max(...data.byVendor.map((v) => v.totalSpend), 1);
  const maxVatAmount = Math.max(...data.byVat.map((v) => v.totalVat), 1);
  const serviceColors = { v1: 'blue', v2: 'purple' };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{t('reports.title')}</h1>
          <p>{t('reports.subtitle')}</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
          <input
            type="date"
            className="form-input"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(e) => setDateFrom(e.target.value)}
            title={t('reports.dateFrom')}
          />
          <input
            type="date"
            className="form-input"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(e) => setDateTo(e.target.value)}
            title={t('reports.dateTo')}
          />
          {(dateFrom || dateTo) && (
            <button className="btn btn-secondary" onClick={() => { setDateFrom(''); setDateTo(''); }}>
              {t('reports.clearDateFilter')}
            </button>
          )}
          <button className="btn btn-primary" onClick={handleExport} disabled={exporting}>
            <HiOutlineDownload /> {exporting ? t('common.loading') : t('reports.export')}
          </button>
        </div>
      </div>

      <div style={{ opacity: refetching ? 0.6 : 1, transition: 'opacity 0.15s' }}>

      <div className="stats-grid">
        <div className="stat-card purple">
          <div className="stat-icon purple"><HiOutlineCurrencyDollar /></div>
          <div className="stat-info">
            <div className="stat-label">{t('reports.totalSpend')}</div>
            <div className="stat-value" title={formatCurrency(data.overall.totalSpend)}>{formatCompactCurrency(data.overall.totalSpend)}</div>
            {data.trend && (
              <div
                className="stat-trend"
                style={{
                  display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: '12px',
                  color: data.trend.changePercent === null ? 'var(--text-tertiary)' : data.trend.changeAbsolute >= 0 ? 'var(--color-danger)' : 'var(--color-success)',
                }}
                title={t('reports.trendVsPrevious')}
              >
                {data.trend.changePercent === null ? (
                  <span>{t('reports.trendNoPrevious')}</span>
                ) : (
                  <>
                    {data.trend.changeAbsolute >= 0 ? <HiOutlineTrendingUp /> : <HiOutlineTrendingDown />}
                    <span>{data.trend.changePercent >= 0 ? '+' : ''}{data.trend.changePercent}%</span>
                    <span style={{ color: 'var(--text-tertiary)' }}>{t('reports.trendVsPrevious')}</span>
                  </>
                )}
              </div>
            )}
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
          <h3>{t('reports.byMonth')}</h3>
          {/* ≥2 ay varsa trend alan grafiği (crosshair+tooltip); tek ay bar olarak kalır */}
          {data.byMonth.length >= 2 ? (
            <AreaChart
              points={data.byMonth.map((m) => ({ label: formatMonth(m.month), value: m.totalSpend }))}
              formatValue={formatCompactCurrency}
              ariaLabel={t('reports.byMonth')}
            />
          ) : (
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
          )}
        </div>

        <div className="chart-card">
          <h3>{t('reports.byService')}</h3>
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

        <div className="chart-card">
          <h3><HiOutlineOfficeBuilding /> {t('reports.byVendor')}</h3>
          <div className="bar-chart">
            {data.byVendor.length === 0 ? (
              <p>{t('reports.noVendorData')}</p>
            ) : (
              data.byVendor.map((v) => (
                <div className="bar-row" key={v.vendor}>
                  <span className="bar-label" title={v.vendor}>{v.vendor}</span>
                  <div className="bar-track">
                    <div
                      className="bar-fill cyan"
                      style={{ width: `${Math.max((v.totalSpend / maxVendorSpend) * 100, 8)}%` }}
                    >
                      {formatCurrency(v.totalSpend)}
                    </div>
                  </div>
                  <span className="bar-value">{v.count}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="chart-card">
          <h3>{t('reports.byVat')}</h3>
          <div className="bar-chart">
            {data.byVat.length === 0 ? (
              <p>{t('reports.noVatData')}</p>
            ) : (
              data.byVat.map((v) => (
                <div className="bar-row" key={v.vatRate}>
                  <span className="bar-label">%{v.vatRate}</span>
                  <div className="bar-track">
                    <div
                      className="bar-fill green"
                      style={{ width: `${Math.max((v.totalVat / maxVatAmount) * 100, 8)}%` }}
                    >
                      {formatCurrency(v.totalVat)}
                    </div>
                  </div>
                  <span className="bar-value">{formatCurrency(v.totalBase)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      </div>
    </>
  );
};

export default SpendingDashboard;

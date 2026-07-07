import { useLanguage } from '../../context/LanguageContext';
import { HiOutlineDocumentText, HiOutlineCheckCircle, HiOutlineExclamation, HiOutlineChartBar } from 'react-icons/hi';

const InvoiceStats = ({ stats }) => {
  const { t } = useLanguage();

  if (!stats) return null;

  const formatCurrency = (value) => {
    return `₺${Number(value || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`;
  };

  return (
    <div className="stats-grid" id="invoice-stats">
      <div className="stat-card purple">
        <div className="stat-icon purple">
          <HiOutlineDocumentText />
        </div>
        <div className="stat-info">
          <div className="stat-label">{t('invoices.stats.totalProcessed')}</div>
          <div className="stat-value">{stats.counts?.total || 0}</div>
        </div>
      </div>

      <div className="stat-card green">
        <div className="stat-icon green">
          <HiOutlineCheckCircle />
        </div>
        <div className="stat-info">
          <div className="stat-label">{t('invoices.stats.verified')}</div>
          <div className="stat-value">{stats.counts?.verified || 0}</div>
          <div className="stat-sub">{stats.accuracy || 0}% {t('invoices.stats.accuracy').toLowerCase()}</div>
        </div>
      </div>

      <div className="stat-card yellow">
        <div className="stat-icon yellow">
          <HiOutlineExclamation />
        </div>
        <div className="stat-info">
          <div className="stat-label">{t('invoices.stats.mismatch')}</div>
          <div className="stat-value">{stats.counts?.mismatch || 0}</div>
          <div className="stat-sub">{stats.counts?.pending || 0} {t('invoices.statuses.pending').toLowerCase()}</div>
        </div>
      </div>

      <div className="stat-card cyan">
        <div className="stat-icon cyan">
          <HiOutlineChartBar />
        </div>
        <div className="stat-info">
          <div className="stat-label">{t('invoices.stats.totalVat')}</div>
          <div className="stat-value">{formatCurrency(stats.financials?.totalVat)}</div>
          <div className="stat-sub">{stats.avgConfidence || 0}% {t('invoices.stats.avgConfidence').toLowerCase()}</div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceStats;

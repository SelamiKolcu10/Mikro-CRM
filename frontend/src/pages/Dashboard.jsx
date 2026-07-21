import { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import feedbackService from '../services/feedbackService';
import DonutChart from '../components/charts/DonutChart';
import BarList from '../components/charts/BarList';
import { SkeletonDashboard } from '../components/common/Skeleton';
import { HiOutlineUsers, HiOutlineCurrencyDollar, HiOutlineExclamationCircle, HiOutlineExclamation } from 'react-icons/hi';

/*
 * Grafik renkleri tasarım.md §5'e göre varlığı izler (Premium her grafikte
 * aynı mavi) — slotlar CSS token'ı, tema değişince kendiliğinden adımlanır.
 */
const PLAN_COLORS = {
  free: 'var(--text-tertiary)',
  starter: 'var(--viz-5)',
  premium: 'var(--viz-1)',
  vip: 'var(--viz-4)',
};
const TYPE_COLORS = {
  bug: 'var(--color-danger)',
  feature: 'var(--accent-primary)',
  improvement: 'var(--viz-5)',
};
const PRIORITY_COLORS = {
  critical: 'var(--color-danger)',
  high: 'var(--color-warning)',
  medium: 'var(--accent-primary)',
  low: 'var(--text-tertiary)',
};
const STATUS_COLORS = {
  open: 'var(--accent-primary)',
  'in-progress': 'var(--color-warning)',
  resolved: 'var(--color-success)',
  closed: 'var(--text-tertiary)',
};

const Dashboard = () => {
  const { t } = useLanguage();
  const [stats, setStats] = useState(null);
  const [topFeedbacks, setTopFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, feedbacksRes] = await Promise.all([
          feedbackService.getStats(),
          feedbackService.getAll({ sort: '-revenueImpact', limit: 5 }),
        ]);
        setStats(statsRes.data.data);
        setTopFeedbacks(feedbacksRes.data.data);
      } catch (err) {
        console.error('Dashboard fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return <SkeletonDashboard />;
  }

  if (!stats) return null;

  const formatCurrency = (value) => `$${Number(value).toLocaleString()}`;

  // { key: count } → BarList item'ları, sabit slot sırasıyla
  const toBars = (group, colorMap, labelFor, order) =>
    (order || Object.keys(group || {}))
      .filter((key) => group?.[key] !== undefined)
      .map((key) => ({ label: labelFor(key), value: group[key], color: colorMap[key] || 'var(--text-tertiary)' }));

  const getPriorityBadgeClass = (priority) => `badge badge-${priority}`;
  const getTypeBadgeClass = (type) => `badge badge-${type}`;
  const getPlanBadgeClass = (plan) => `badge badge-${plan}`;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{t('dashboard.title')}</h1>
          <p>{t('dashboard.subtitle')}</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card purple">
          <div className="stat-icon purple">
            <HiOutlineUsers />
          </div>
          <div className="stat-info">
            <div className="stat-label">{t('dashboard.totalCustomers')}</div>
            <div className="stat-value tabular">{stats.totalCustomers}</div>
          </div>
        </div>

        <div className="stat-card green">
          <div className="stat-icon green">
            <HiOutlineCurrencyDollar />
          </div>
          <div className="stat-info">
            <div className="stat-label">{t('dashboard.totalMRR')}</div>
            <div className="stat-value tabular">{formatCurrency(stats.totalMRR)}</div>
            <div className="stat-sub">{t('common.perMonth')}</div>
          </div>
        </div>

        <div className="stat-card red">
          <div className="stat-icon red">
            <HiOutlineExclamationCircle />
          </div>
          <div className="stat-info">
            <div className="stat-label">{t('dashboard.openBugs')}</div>
            <div className="stat-value tabular">{stats.openBugs}</div>
            <div className="stat-sub">{stats.inProgressCount} {t('dashboard.activeIssues')}</div>
          </div>
        </div>

        <div className="stat-card yellow">
          <div className="stat-icon yellow">
            <HiOutlineExclamation />
          </div>
          <div className="stat-info">
            <div className="stat-label">{t('dashboard.revenueAtRisk')}</div>
            <div className="stat-value tabular">{formatCurrency(stats.revenueAtRisk)}</div>
            <div className="stat-sub">{t('dashboard.fromPremium')}</div>
          </div>
        </div>
      </div>

      {/* Top Feedbacks */}
      <div className="table-container" style={{ marginBottom: 'var(--space-xl)' }}>
        <div className="table-header">
          <h3>{t('dashboard.topFeedbacks')}</h3>
        </div>
        <div className="top-feedback-list">
          {topFeedbacks.map((fb, idx) => (
            <div className="top-feedback-item" key={fb._id}>
              <div className={`top-feedback-rank rank-${idx + 1}`}>
                {idx + 1}
              </div>
              <div className="top-feedback-info">
                <div className="top-feedback-title">{t('mockData', { returnObjects: true })?.[fb.title] || fb.title}</div>
                <div className="top-feedback-meta">
                  <span className={getTypeBadgeClass(fb.type)}>
                    {t(`feedbacks.types.${fb.type}`)}
                  </span>
                  {fb.customer && (
                    <span className={getPlanBadgeClass(fb.customer.plan)}>
                      {fb.customer.plan.toUpperCase()}
                    </span>
                  )}
                  <span className={getPriorityBadgeClass(fb.priority)}>
                    {t(`feedbacks.priorities.${fb.priority}`)}
                  </span>
                </div>
              </div>
              <div className="top-feedback-revenue tabular">
                {formatCurrency(fb.revenueImpact)}{t('common.perMonth')}
              </div>
            </div>
          ))}
          {topFeedbacks.length === 0 && (
            <div className="table-empty">
              <p>{t('common.noData')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Charts Grid */}
      <div className="dashboard-grid">
        <div className="chart-card">
          <h3>{t('dashboard.planDistribution')}</h3>
          <DonutChart
            caption={t('dashboard.totalCustomers')}
            data={['free', 'starter', 'premium', 'vip'].map((plan) => ({
              label: t(`customers.plans.${plan}`),
              value: stats.customersByPlan?.[plan] || 0,
              color: PLAN_COLORS[plan],
            }))}
          />
        </div>

        <div className="chart-card">
          <h3>{t('dashboard.typeDistribution')}</h3>
          <BarList
            items={toBars(stats.byType, TYPE_COLORS, (k) => t(`feedbacks.types.${k}`), ['bug', 'feature', 'improvement'])}
          />
        </div>

        <div className="chart-card">
          <h3>{t('dashboard.priorityDistribution')}</h3>
          <BarList
            items={toBars(stats.byPriority, PRIORITY_COLORS, (k) => t(`feedbacks.priorities.${k}`), ['critical', 'high', 'medium', 'low'])}
          />
        </div>

        <div className="chart-card">
          <h3>{t('dashboard.statusDistribution')}</h3>
          <BarList
            items={toBars(stats.byStatus, STATUS_COLORS, (k) => t(`feedbacks.statuses.${k}`), ['open', 'in-progress', 'resolved', 'closed'])}
          />
        </div>
      </div>
    </>
  );
};

export default Dashboard;

import { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import feedbackService from '../services/feedbackService';
import { HiOutlineUsers, HiOutlineCurrencyDollar, HiOutlineExclamationCircle, HiOutlineExclamation } from 'react-icons/hi';

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
    return (
      <div className="loading-spinner">
        <div className="spinner" />
      </div>
    );
  }

  if (!stats) return null;

  const formatCurrency = (value) => {
    return `$${Number(value).toLocaleString()}`;
  };

  const planColors = { free: 'gray', starter: 'blue', premium: 'purple', vip: 'yellow' };
  const typeColors = { bug: 'red', feature: 'purple', improvement: 'cyan' };
  const priorityColors = { low: 'gray', medium: 'blue', high: 'yellow', critical: 'red' };
  const statusColors = { open: 'blue', 'in-progress': 'yellow', resolved: 'green', closed: 'gray' };

  const totalByGroup = (group) => Object.values(group || {}).reduce((a, b) => a + b, 0) || 1;

  const renderBarChart = (data, colorMap, labelMap) => {
    const total = totalByGroup(data);
    const entries = Object.entries(data || {}).sort((a, b) => b[1] - a[1]);

    return (
      <div className="bar-chart">
        {entries.map(([key, value]) => (
          <div className="bar-row" key={key}>
            <span className="bar-label">{labelMap?.[key] || key}</span>
            <div className="bar-track">
              <div
                className={`bar-fill ${colorMap[key] || 'gray'}`}
                style={{ width: `${Math.max((value / total) * 100, 8)}%` }}
              >
                {value}
              </div>
            </div>
            <span className="bar-value">{Math.round((value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    );
  };

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
            <div className="stat-value">{stats.totalCustomers}</div>
          </div>
        </div>

        <div className="stat-card green">
          <div className="stat-icon green">
            <HiOutlineCurrencyDollar />
          </div>
          <div className="stat-info">
            <div className="stat-label">{t('dashboard.totalMRR')}</div>
            <div className="stat-value">{formatCurrency(stats.totalMRR)}</div>
            <div className="stat-sub">{t('common.perMonth')}</div>
          </div>
        </div>

        <div className="stat-card red">
          <div className="stat-icon red">
            <HiOutlineExclamationCircle />
          </div>
          <div className="stat-info">
            <div className="stat-label">{t('dashboard.openBugs')}</div>
            <div className="stat-value">{stats.openBugs}</div>
            <div className="stat-sub">{stats.inProgressCount} {t('dashboard.activeIssues')}</div>
          </div>
        </div>

        <div className="stat-card yellow">
          <div className="stat-icon yellow">
            <HiOutlineExclamation />
          </div>
          <div className="stat-info">
            <div className="stat-label">{t('dashboard.revenueAtRisk')}</div>
            <div className="stat-value">{formatCurrency(stats.revenueAtRisk)}</div>
            <div className="stat-sub">{t('dashboard.fromPremium')}</div>
          </div>
        </div>
      </div>

      {/* Top Feedbacks */}
      <div className="table-container" style={{ marginBottom: 'var(--space-xl)' }}>
        <div className="table-header">
          <h3>🔥 {t('dashboard.topFeedbacks')}</h3>
        </div>
        <div className="top-feedback-list">
          {topFeedbacks.map((fb, idx) => (
            <div className="top-feedback-item" key={fb._id}>
              <div className={`top-feedback-rank rank-${idx + 1}`}>
                {idx + 1}
              </div>
              <div className="top-feedback-info">
                <div className="top-feedback-title">{fb.title}</div>
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
              <div className="top-feedback-revenue">
                {formatCurrency(fb.revenueImpact)}{t('common.perMonth')}
              </div>
            </div>
          ))}
          {topFeedbacks.length === 0 && (
            <div className="table-empty">
              <div className="table-empty-icon">📋</div>
              <p>{t('common.noData')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Charts Grid */}
      <div className="dashboard-grid">
        <div className="chart-card">
          <h3>👥 {t('dashboard.planDistribution')}</h3>
          {renderBarChart(stats.customersByPlan, planColors, {
            free: t('customers.plans.free'), 
            starter: t('customers.plans.starter'), 
            premium: t('customers.plans.premium'), 
            vip: t('customers.plans.vip')
          })}
        </div>

        <div className="chart-card">
          <h3>📋 {t('dashboard.typeDistribution')}</h3>
          {renderBarChart(stats.byType, typeColors, {
            bug: t('feedbacks.types.bug'),
            feature: t('feedbacks.types.feature'),
            improvement: t('feedbacks.types.improvement'),
          })}
        </div>

        <div className="chart-card">
          <h3>🚦 {t('dashboard.priorityDistribution')}</h3>
          {renderBarChart(stats.byPriority, priorityColors, {
            critical: t('feedbacks.priorities.critical'),
            high: t('feedbacks.priorities.high'),
            medium: t('feedbacks.priorities.medium'),
            low: t('feedbacks.priorities.low'),
          })}
        </div>

        <div className="chart-card">
          <h3>📊 {t('dashboard.statusDistribution')}</h3>
          {renderBarChart(stats.byStatus, statusColors, {
            open: t('feedbacks.statuses.open'),
            'in-progress': t('feedbacks.statuses.in-progress'),
            resolved: t('feedbacks.statuses.resolved'),
            closed: t('feedbacks.statuses.closed'),
          })}
        </div>
      </div>
    </>
  );
};

export default Dashboard;

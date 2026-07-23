import { useState } from 'react';
import { HiOutlineInbox } from 'react-icons/hi';
import { useLeads } from '../hooks/useLeads';
import { useLanguage } from '../context/LanguageContext';
import { LEAD_STATUSES, LEAD_STATUS_CLASS, LEAD_TEMPERATURE_CLASS } from '../config/leads';
import { summarizeLead } from '../utils/leadSummary';
import LeadDetailDrawer from '../components/leads/LeadDetailDrawer';

/**
 * Formlar paneli — durum sekmeleri + skorlanmış liste. hooks/useLeads.js
 * veri/optimistic-update mantığını taşır, bu sayfa sadece render eder
 * (bkz. Tasks.jsx/TaskBoard ile aynı ayrım, mobil port hedefi).
 */
const Leads = () => {
  const { t, lang } = useLanguage();
  const { leads, loading, error, updateStatus, assignTo } = useLeads();
  const [activeStatus, setActiveStatus] = useState('all');
  const [selectedLead, setSelectedLead] = useState(null);

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;
  if (error) return <p className="error-text">{error}</p>;

  const counts = { all: leads.length };
  LEAD_STATUSES.forEach((s) => { counts[s] = leads.filter((l) => l.status === s).length; });

  const visibleLeads = activeStatus === 'all' ? leads : leads.filter((l) => l.status === activeStatus);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>{t('leads.panel.title')}</h1>
          <p>{t('leads.panel.subtitle')}</p>
        </div>
      </div>

      <div className="task-tabs">
        <button
          type="button"
          className={`filter-chip ${activeStatus === 'all' ? 'active' : ''}`}
          onClick={() => setActiveStatus('all')}
        >
          {t('leads.panel.tabs.all')} ({counts.all})
        </button>
        {LEAD_STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            className={`filter-chip ${activeStatus === status ? 'active' : ''}`}
            onClick={() => setActiveStatus(status)}
          >
            {t(`leads.status.${status}`)} ({counts[status]})
          </button>
        ))}
      </div>

      {visibleLeads.length === 0 ? (
        <div className="lead-empty-state">
          <HiOutlineInbox />
          <p>{t('leads.panel.empty')}</p>
        </div>
      ) : (
        <div className="lead-list">
          {visibleLeads.map((lead) => (
            <div
              key={lead._id}
              className="lead-row is-clickable"
              role="button"
              tabIndex={0}
              onClick={() => setSelectedLead(lead)}
            >
              <div className="lead-row-main">
                <div className="lead-row-title">
                  <span className="lead-row-name">{lead.name}</span>
                  {lead.company && <span className="lead-row-company">· {lead.company}</span>}
                </div>
                <div className="lead-row-summary">{summarizeLead(lead, t)}</div>
              </div>
              <div className="lead-row-meta">
                <span className={`lead-status-badge ${LEAD_STATUS_CLASS[lead.status]}`}>
                  {t(`leads.status.${lead.status}`)}
                </span>
                <span className={`lead-temp-badge ${LEAD_TEMPERATURE_CLASS[lead.temperature]}`}>
                  <span className="lead-temp-dot" />
                  {t(`leads.temperature.${lead.temperature}`)} · {lead.score}
                </span>
                <span className="lead-row-time">
                  {new Date(lead.createdAt).toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US')}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <LeadDetailDrawer
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
        onStatusChange={async (id, status) => {
          const updated = await updateStatus(id, status);
          setSelectedLead(updated);
        }}
        onAssign={async (id, assigneeId) => {
          const updated = await assignTo(id, assigneeId);
          setSelectedLead(updated);
        }}
      />
    </div>
  );
};

export default Leads;

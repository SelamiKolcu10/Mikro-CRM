import { useLanguage } from '../../context/LanguageContext';
import { describeEvent, groupByDay } from '../../utils/customerTimeline';
import { DEAL_STAGE_CLASS } from '../../config/deals';
import { LEAD_STATUS_CLASS } from '../../config/leads';
import { formatCurrency } from '../../utils/dealForecast';

/**
 * Bir öğenin sağındaki bağlam rozetleri — kaynağın kendi renk/etiket
 * sistemini yeniden kullanır (deal aşaması, lead durumu, plan, tutar,
 * destek talebi durumu). Yeni bir tasarım dili İCAT ETMEZ (bkz. tasarım
 * spec'i §4.4).
 */
function EventChips({ item, meta, t, lang }) {
  const { data } = item;
  switch (meta.chipKind) {
    case 'stage':
      return (
        <span className="customer-timeline-chips">
          {data.fromStage && (
            <>
              <span className={`deal-stage-chip ${DEAL_STAGE_CLASS[data.fromStage]}`}>{t(`deals.stage.${data.fromStage}`)}</span>
              <span className="customer-timeline-arrow">→</span>
            </>
          )}
          {data.toStage && <span className={`deal-stage-chip ${DEAL_STAGE_CLASS[data.toStage]}`}>{t(`deals.stage.${data.toStage}`)}</span>}
        </span>
      );
    case 'status':
      return (
        <span className="customer-timeline-chips">
          {data.fromStatus && (
            <>
              <span className={`lead-status-chip ${LEAD_STATUS_CLASS[data.fromStatus]}`}>{t(`leads.status.${data.fromStatus}`)}</span>
              <span className="customer-timeline-arrow">→</span>
            </>
          )}
          {data.toStatus && <span className={`lead-status-chip ${LEAD_STATUS_CLASS[data.toStatus]}`}>{t(`leads.status.${data.toStatus}`)}</span>}
        </span>
      );
    case 'plan':
      return (
        <span className="customer-timeline-chips">
          {data.fromPlan && (
            <>
              <span className={`badge badge-${data.fromPlan}`}>{t(`customers.plans.${data.fromPlan}`)}</span>
              <span className="customer-timeline-arrow">→</span>
            </>
          )}
          {data.toPlan && <span className={`badge badge-${data.toPlan}`}>{t(`customers.plans.${data.toPlan}`)}</span>}
        </span>
      );
    case 'value':
      return (
        <span className="customer-timeline-chips">
          {formatCurrency(data.fromValue, data.dealCurrency, lang)}
          <span className="customer-timeline-arrow">→</span>
          {formatCurrency(data.toValue, data.dealCurrency, lang)}
        </span>
      );
    case 'feedbackStatus':
      return (
        <span className="customer-timeline-chips">
          <span className={`badge badge-${data.feedbackType}`}>{t(`feedbacks.types.${data.feedbackType}`)}</span>
          <span className={`badge badge-${data.status}`}>{t(`feedbacks.statuses.${data.status}`)}</span>
        </span>
      );
    default:
      return null;
  }
}

function dayLabel(group, t, lang) {
  if (group.isToday) return t('customers.timeline.today');
  if (group.isYesterday) return t('customers.timeline.yesterday');
  return group.date.toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Müşteri detay drawer'ının kalbi — DealEvent+LeadEvent+Feedback+CustomerEvent
 * kaynaklarından harmanlanmış tek kronolojik akışı, güne göre gruplu render
 * eder. Görsel iskelet LeadDetailDrawer/DealDetailDrawer'ın `.lead-timeline`
 * desenini yeniden kullanır (bkz. tasarım spec'i §4.3-4.4).
 */
const CustomerTimeline = ({ items, loading, hasMore, onLoadMore, loadingMore }) => {
  const { t, lang } = useLanguage();

  if (loading) {
    return <div className="loading-spinner"><div className="spinner" /></div>;
  }

  if (items.length === 0) {
    return <p className="task-comment-empty">{t('customers.detail.noActivity')}</p>;
  }

  const groups = groupByDay(items);

  return (
    <div className="customer-timeline">
      {groups.map((group) => (
        <div key={group.dateKey} className="customer-timeline-day-group">
          <div className="customer-timeline-day-label">{dayLabel(group, t, lang)}</div>
          <ul className="lead-timeline">
            {group.items.map((item) => {
              const meta = describeEvent(item);
              return (
                <li key={item.key} className={`lead-timeline-item customer-timeline--${meta.dotClass}`}>
                  <span className="lead-timeline-dot" aria-hidden="true" />
                  <div className="lead-timeline-content">
                    <div className="lead-timeline-top">
                      <strong>{item.actorName || t('customers.timeline.system')}</strong>
                      <time className="lead-timeline-time">
                        {new Date(item.at).toLocaleTimeString(lang === 'tr' ? 'tr-TR' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                      </time>
                    </div>
                    <div className="lead-timeline-text">
                      <span>{t(meta.labelKey)}</span>
                      {item.data?.dealTitle && <span className="customer-timeline-subject">{item.data.dealTitle}</span>}
                      {item.data?.feedbackId && item.data?.title && <span className="customer-timeline-subject">{item.data.title}</span>}
                      <EventChips item={item} meta={meta} t={t} lang={lang} />
                    </div>
                    {item.note && <div className="lead-timeline-note">{item.note}</div>}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {hasMore && (
        <button type="button" className="btn btn-secondary btn-sm customer-timeline-load-more" onClick={onLoadMore} disabled={loadingMore}>
          {loadingMore ? t('common.loading') : t('customers.timeline.loadMore')}
        </button>
      )}
    </div>
  );
};

export default CustomerTimeline;

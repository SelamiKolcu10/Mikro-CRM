import { useLanguage } from '../../context/LanguageContext';
import { DEAL_STAGE_CLASS } from '../../config/deals';
import { formatCurrency } from '../../utils/dealForecast';
import TaskAvatar from '../tasks/TaskAvatar';

/**
 * Pipeline kartı — TaskCard görsel dilinin satış varyantı. Değer öne çıkar;
 * olasılık kompakt rozet (dolu halka drawer'da, kartlar sıkışmasın). Kart
 * sürüklenebilir (native HTML5 DnD — bağımlılıksız, .task-column-over deseni).
 */
const DealCard = ({ deal, onClick, onDragStart, onDragEnd, isDragging }) => {
  const { t, lang } = useLanguage();

  const isOpen = deal.isOpen ?? true;
  const overdue = isOpen && deal.expectedCloseDate && new Date(deal.expectedCloseDate) < new Date();

  return (
    <div
      className={`deal-card ${DEAL_STAGE_CLASS[deal.stage]} ${isDragging ? 'deal-card--dragging' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      draggable
      onDragStart={(e) => onDragStart(e, deal)}
      onDragEnd={onDragEnd}
    >
      <div className="deal-card-top">
        <span className={`deal-stage-badge ${DEAL_STAGE_CLASS[deal.stage]}`}>
          {t(`deals.stage.${deal.stage}`)}
        </span>
        <span className="deal-prob-chip" title={t('deals.card.probability')}>
          {deal.probability}%
        </span>
      </div>

      <h4 className="deal-card-title">{deal.title}</h4>
      {deal.customer?.name && (
        <div className="deal-card-customer">{deal.customer.name}</div>
      )}

      <div className="deal-card-value">{formatCurrency(deal.value, deal.currency, lang)}</div>

      <div className="deal-card-footer">
        <span className="deal-card-owner">
          <TaskAvatar user={deal.owner} />
          <span className="deal-card-owner-name">{deal.owner?.name}</span>
        </span>
        {deal.expectedCloseDate && (
          <span className={`deal-card-date ${overdue ? 'deal-card-date--overdue' : ''}`}>
            {new Date(deal.expectedCloseDate).toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US')}
          </span>
        )}
      </div>
    </div>
  );
};

export default DealCard;

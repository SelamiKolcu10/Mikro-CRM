import { useLanguage } from '../../context/LanguageContext';
import { DEAL_STAGE_CLASS } from '../../config/deals';
import { formatCurrency, weightedValueOf } from '../../utils/dealForecast';
import DealCard from './DealCard';

/**
 * Bir aşama kolonu — TaskColumn deseni + satış başlığı: adet, Σ değer ve
 * (açık aşamalarda) Σ ağırlıklı forecast. Sürükle-bırak hedefi: kart bu kolona
 * bırakılınca onDropStage(dealId, stage) tetiklenir (.task-column-over vurgusu).
 */
const DealColumn = ({ stage, deals, mobileActive, isOver, currency, onCardClick, onDragOver, onDragLeave, onDrop, dragProps }) => {
  const { t, lang } = useLanguage();

  const total = deals.reduce((sum, d) => sum + d.value, 0);
  const weighted = deals.reduce((sum, d) => sum + weightedValueOf(d), 0);
  const isClosed = stage === 'won' || stage === 'lost';

  return (
    <div
      className={`deal-column ${DEAL_STAGE_CLASS[stage]} ${mobileActive ? 'deal-column-mobile-active' : ''} ${isOver ? 'task-column-over' : ''}`}
      onDragOver={(e) => onDragOver(e, stage)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, stage)}
    >
      <div className="deal-column-head">
        <h3>
          <span className="deal-column-dot" aria-hidden="true" />
          {t(`deals.stage.${stage}`)}
          <span className="task-column-count">{deals.length}</span>
        </h3>
        <div className="deal-column-totals">
          <span className="deal-column-total">{formatCurrency(total, currency, lang)}</span>
          {!isClosed && weighted > 0 && (
            <span className="deal-column-weighted" title={t('deals.forecast.weighted')}>
              ~{formatCurrency(weighted, currency, lang)}
            </span>
          )}
        </div>
      </div>

      <div className="deal-column-body">
        {deals.map((deal) => (
          <DealCard
            key={deal._id}
            deal={deal}
            onClick={() => onCardClick(deal)}
            isDragging={dragProps.draggingId === deal._id}
            onDragStart={dragProps.onDragStart}
            onDragEnd={dragProps.onDragEnd}
          />
        ))}
      </div>
    </div>
  );
};

export default DealColumn;

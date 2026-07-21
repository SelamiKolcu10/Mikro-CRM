import { useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useLanguage } from '../../context/LanguageContext';
import { DEAL_STAGES } from '../../config/deals';
import { computeForecast } from '../../utils/dealForecast';
import DealColumn from './DealColumn';
import DealDetailDrawer from './DealDetailDrawer';
import ForecastSummaryBar from './ForecastSummaryBar';

/** Board toplamları tek para biriminde gösterilir (v1 tek-currency); karışık
 * listede en yaygın currency'yi baz al. */
function dominantCurrency(deals) {
  const counts = {};
  for (const d of deals) counts[d.currency] = (counts[d.currency] || 0) + 1;
  return Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || 'TRY';
}

/**
 * Satış Pipeline board'u — TaskBoard deseni + native HTML5 sürükle-bırak.
 * Veri/mutation (useDeals) bu bileşenin DIŞINDA (Deals.jsx'te), board sadece
 * etkileşim + optimistic tetikleme yapar (mobil port hedefi). Sürüklemeyle
 * aşama değişince onStageChange çağrılır; 409/hata gelirse hook zaten eski
 * hale döndürür, burada sadece toast + refresh.
 */
const DealBoard = ({ deals, onStageChange, onUpdateDeal, onRefresh, canWrite }) => {
  const { t } = useLanguage();
  const [mobileColumn, setMobileColumn] = useState('initial_contact');
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [draggingId, setDraggingId] = useState(null);
  const [overStage, setOverStage] = useState(null);

  const boardCurrency = useMemo(() => dominantCurrency(deals), [deals]);
  const forecast = useMemo(() => computeForecast(deals), [deals]);

  const dealsByStage = DEAL_STAGES.reduce((acc, stage) => {
    acc[stage] = deals.filter((d) => d.stage === stage);
    return acc;
  }, {});

  const dragProps = {
    draggingId,
    onDragStart: (e, deal) => {
      if (!canWrite) return;
      setDraggingId(deal._id);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', deal._id);
    },
    onDragEnd: () => {
      setDraggingId(null);
      setOverStage(null);
    },
  };

  const handleDragOver = (e, stage) => {
    if (!canWrite || !draggingId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (overStage !== stage) setOverStage(stage);
  };

  const handleDrop = async (e, stage) => {
    e.preventDefault();
    setOverStage(null);
    const id = draggingId || e.dataTransfer.getData('text/plain');
    setDraggingId(null);
    if (!id) return;
    const deal = deals.find((d) => d._id === id);
    if (!deal || deal.stage === stage) return;

    try {
      const updated = await onStageChange(id, stage);
      // Drawer açıksa aynı deal'i tazele.
      setSelectedDeal((cur) => (cur && cur._id === id ? updated : cur));
    } catch (err) {
      const msg = err.response?.status === 409
        ? err.response?.data?.error
        : err.response?.data?.error || t('common.error');
      toast.error(msg);
      if (err.response?.status === 409) onRefresh?.();
    }
  };

  return (
    <>
      <ForecastSummaryBar forecast={forecast} currency={boardCurrency} />

      <div className="deal-board-mobile-tabs">
        {DEAL_STAGES.map((stage) => (
          <button
            key={stage}
            type="button"
            className={`filter-chip ${mobileColumn === stage ? 'active' : ''}`}
            onClick={() => setMobileColumn(stage)}
          >
            {t(`deals.stage.${stage}`)} ({dealsByStage[stage].length})
          </button>
        ))}
      </div>

      <div className="deal-board">
        {DEAL_STAGES.map((stage) => (
          <DealColumn
            key={stage}
            stage={stage}
            deals={dealsByStage[stage]}
            currency={boardCurrency}
            mobileActive={stage === mobileColumn}
            isOver={overStage === stage}
            onCardClick={setSelectedDeal}
            onDragOver={handleDragOver}
            onDragLeave={() => setOverStage(null)}
            onDrop={handleDrop}
            dragProps={dragProps}
          />
        ))}
      </div>

      <DealDetailDrawer
        deal={selectedDeal}
        canWrite={canWrite}
        onClose={() => setSelectedDeal(null)}
        onStageChange={async (id, stage, lostReason) => {
          const updated = await onStageChange(id, stage, lostReason);
          setSelectedDeal(updated);
          return updated;
        }}
        onUpdateDeal={async (id, payload) => {
          const updated = await onUpdateDeal(id, payload);
          setSelectedDeal(updated);
          return updated;
        }}
      />
    </>
  );
};

export default DealBoard;

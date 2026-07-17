import { useLanguage } from '../../context/LanguageContext';

/**
 * Header strip counts, next to ConnectionStatus. Renders nothing when there's
 * nothing at risk. Clicking either chip enables the "SLA riski" filter.
 */
const SlaSummary = ({ criticalCount, warningCount, onFilterClick }) => {
  const { t } = useLanguage();
  if (criticalCount === 0 && warningCount === 0) return null;

  return (
    <div className="sla-summary">
      {criticalCount > 0 && (
        <button type="button" className="sla-summary-chip sla-summary-chip--critical" onClick={onFilterClick}>
          {criticalCount} {t('chat.sla.critical')}
        </button>
      )}
      {warningCount > 0 && (
        <button type="button" className="sla-summary-chip sla-summary-chip--warning" onClick={onFilterClick}>
          {warningCount} {t('chat.sla.warning')}
        </button>
      )}
    </div>
  );
};

export default SlaSummary;

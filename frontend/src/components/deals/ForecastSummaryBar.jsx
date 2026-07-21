import { HiOutlineTrendingUp, HiOutlineScale, HiOutlineCalendar, HiOutlineCheckCircle } from 'react-icons/hi';
import { useLanguage } from '../../context/LanguageContext';
import { formatCurrency } from '../../utils/dealForecast';

/**
 * Board üstü satış özeti — Dashboard stat-kartı dili. 4 metrik: açık pipeline,
 * ağırlıklı forecast (asıl "bu ay ne bekliyoruz" cevabı), bu ay beklenen, bu ay
 * kazanılan. Metrikler saf computeForecast'ten (utils/dealForecast) gelir.
 */
const ForecastSummaryBar = ({ forecast, currency }) => {
  const { t, lang } = useLanguage();
  const f = forecast;

  const cards = [
    { key: 'open', icon: HiOutlineTrendingUp, label: t('deals.forecast.openPipeline'), value: formatCurrency(f.openValue, currency, lang), sub: t('deals.forecast.openCount', ).replace('{n}', f.openCount), variant: 'open' },
    { key: 'weighted', icon: HiOutlineScale, label: t('deals.forecast.weighted'), value: formatCurrency(f.weightedForecast, currency, lang), sub: t('deals.forecast.weightedSub'), variant: 'weighted' },
    { key: 'expected', icon: HiOutlineCalendar, label: t('deals.forecast.expectedThisMonth'), value: formatCurrency(f.expectedThisMonth, currency, lang), sub: t('deals.forecast.expectedSub'), variant: 'expected' },
    { key: 'won', icon: HiOutlineCheckCircle, label: t('deals.forecast.wonThisMonth'), value: formatCurrency(f.wonThisMonth, currency, lang), sub: t('deals.forecast.wonSub'), variant: 'won' },
  ];

  return (
    <div className="forecast-bar">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div key={c.key} className={`forecast-card forecast-card--${c.variant}`}>
            <span className="forecast-card-icon"><Icon /></span>
            <div className="forecast-card-body">
              <span className="forecast-card-label">{c.label}</span>
              <span className="forecast-card-value">{c.value}</span>
              <span className="forecast-card-sub">{c.sub}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ForecastSummaryBar;

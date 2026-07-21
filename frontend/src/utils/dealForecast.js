/**
 * Satış forecast'ının SAF hesap katmanı — DOM/window/localStorage yok, RN'de
 * aynen kullanılabilir (mobil port hedefi; global mimari kuralı). Sunucu-taraf
 * aggregation P4 işi; v1'de metrikler client-side /api/deals listesinden
 * hesaplanır (getDeals/getLeads deseni).
 */
import { OPEN_STAGES } from '../config/deals';

/** value * probability / 100 — backend withComputedFields ile aynı; deal
 * populate'ten weightedValue gelmezse (örn. optimistic ara durum) fallback. */
export function weightedValueOf(deal) {
  if (typeof deal.weightedValue === 'number') return deal.weightedValue;
  return (deal.value * deal.probability) / 100;
}

function isSameMonth(dateLike, ref = new Date()) {
  if (!dateLike) return false;
  const d = new Date(dateLike);
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
}

/**
 * Board üstü özet bandının 4 metriği. Tek geçişte hesaplanır.
 * - openValue:        açık deal'lerin ham toplam değeri
 * - weightedForecast: açık deal'lerin ağırlıklı (olasılıkla çarpılmış) toplamı
 * - expectedThisMonth: bu ay kapanması BEKLENEN açık deal'lerin değeri
 * - wonThisMonth:     bu ay KAZANILAN deal'lerin değeri (closedAt bu ay)
 */
export function computeForecast(deals, ref = new Date()) {
  let openValue = 0;
  let weightedForecast = 0;
  let expectedThisMonth = 0;
  let wonThisMonth = 0;
  let openCount = 0;

  for (const deal of deals) {
    const isOpen = OPEN_STAGES.includes(deal.stage);
    if (isOpen) {
      openValue += deal.value;
      weightedForecast += weightedValueOf(deal);
      openCount += 1;
      if (isSameMonth(deal.expectedCloseDate, ref)) expectedThisMonth += deal.value;
    } else if (deal.stage === 'won' && isSameMonth(deal.closedAt, ref)) {
      wonThisMonth += deal.value;
    }
  }

  return { openValue, weightedForecast, expectedThisMonth, wonThisMonth, openCount };
}

/**
 * Para biçimlendirme — çoğu deal tek para biriminde (v1 TRY), ama karışık
 * listede toplamlar için ana currency verilir. Intl locale'i uygulamanın
 * dil ayarını takip eder (tr/en).
 */
export function formatCurrency(value, currency = 'TRY', lang = 'tr') {
  const locale = lang === 'tr' ? 'tr-TR' : 'en-US';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value || 0);
  } catch {
    // Bilinmeyen currency kodu → sayı + kod
    return `${Math.round(value || 0).toLocaleString(locale)} ${currency}`;
  }
}

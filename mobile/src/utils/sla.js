// Web'deki utils/sla.js'in birebir kopyası (saf fonksiyonlar, DOM bağımsız) —
// o da backend/services/slaEscalationService.js'i yansıtıyor. Üçü senkron
// tutulmalı.
export const SLA_THRESHOLD_MINUTES = {
  vip: 120,
  premium: 240,
  starter: 480,
  free: 1440,
};

export const getSlaThresholdMinutes = (plan) =>
  SLA_THRESHOLD_MINUTES[plan] ?? SLA_THRESHOLD_MINUTES.free;

/**
 * Bir sohbetin o andaki SLA durumu — `status` alanından değil, geçen süre ile
 * eşik karşılaştırmasından türetilir. `status:'escalated'` backend daemon'ının
 * 5 dakikalık periyodik teyidi; bağımsız hesaplayınca arayüz süre dolduğu anda
 * 'breached' gösterir, sonraki taramayı beklemez.
 *
 * Yalnız müşteri yanıt beklerken işler (lastMessageSenderType === 'customer');
 * personel yanıt verince saat durur.
 *
 * Bantlar: >%50 kalan = ok, ≤%50 = warning, ≤%15 = critical, süre geçmiş =
 * breached.
 */
export function getSlaState(conversation, now = Date.now()) {
  if (conversation.lastMessageSenderType !== 'customer' || !conversation.lastMessageAt) {
    return { state: 'ok', minutesRemaining: null, thresholdMinutes: null };
  }

  const thresholdMinutes = getSlaThresholdMinutes(conversation.customer?.plan);
  const elapsedMinutes = (now - new Date(conversation.lastMessageAt).getTime()) / 60000;
  const remainingMinutes = thresholdMinutes - elapsedMinutes;
  const remainingRatio = remainingMinutes / thresholdMinutes;

  if (remainingMinutes <= 0) return { state: 'breached', minutesRemaining: remainingMinutes, thresholdMinutes };
  if (remainingRatio <= 0.15) return { state: 'critical', minutesRemaining: remainingMinutes, thresholdMinutes };
  if (remainingRatio <= 0.5) return { state: 'warning', minutesRemaining: remainingMinutes, thresholdMinutes };
  return { state: 'ok', minutesRemaining: remainingMinutes, thresholdMinutes };
}

/** "1s 42dk" / "12dk" / "<1dk" — saniye yok, 30sn'lik tık temposuna uygun. */
export function formatSlaDuration(minutes) {
  const abs = Math.abs(minutes);
  if (abs < 1) return '<1dk';
  const hours = Math.floor(abs / 60);
  const mins = Math.round(abs % 60);
  if (hours > 0) return mins > 0 ? `${hours}s ${mins}dk` : `${hours}s`;
  return `${mins}dk`;
}

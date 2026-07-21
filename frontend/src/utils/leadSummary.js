import { budgetLabelKey, timeframeLabelKey } from '../config/leads';

/**
 * Panelde tek satır otomatik özet — bkz. spec §5: "Fiyat teklifi · 50k–150k ·
 * 1 ay içinde · kurumsal e-posta". Saf fonksiyon (DOM/state bağımsız), sadece
 * `t()` çeviri fonksiyonunu dışarıdan alır — mobil port hedefiyle tutarlı.
 * `isCorporateEmail` backend'de hesaplanıp yanıta eklenir (bkz.
 * leadController.js withComputedFields — tek kaynak, aynı domain listesi
 * frontend'de tekrar tanımlanmaz).
 */
export function summarizeLead(lead, t) {
  const parts = [t(`leads.form.types.${lead.type}`)];

  if (lead.type === 'quote') {
    const budgetKey = budgetLabelKey(lead.budgetRange);
    if (budgetKey) parts.push(t(budgetKey));
    const timeframeKey = timeframeLabelKey(lead.timeframe);
    if (timeframeKey) parts.push(t(timeframeKey));
  }

  if (lead.isCorporateEmail) parts.push(t('leads.panel.corporateEmail'));

  return parts.join(' · ');
}

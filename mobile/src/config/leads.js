import { colors } from '../theme';
import { DEPARTMENTS, DEPARTMENT_LABEL } from './departments';

// Formlar (Lead) sabitleri — backend/config/leads.js enum'ları ve web'deki
// i18n etiketleriyle senkron. Mobilde i18n katmanı yok, etiketler Türkçe.
export const LEAD_STATUSES = ['new', 'in_review', 'contacted', 'quoted', 'won', 'lost'];

export const STATUS = {
  new: { label: 'Yeni', bg: colors.primarySoft, fg: colors.primary },
  in_review: { label: 'İncelemede', bg: colors.warnSoft, fg: '#B45309' },
  contacted: { label: 'İletişime Geçildi', bg: '#E0F2FE', fg: '#0369A1' },
  quoted: { label: 'Teklif Verildi', bg: '#EDE9FE', fg: '#6D28D9' },
  won: { label: 'Kazanıldı', bg: colors.successSoft, fg: colors.success },
  lost: { label: 'Kaybedildi', bg: colors.dangerSoft, fg: colors.danger },
};

export const TEMPERATURE = {
  hot: { label: 'Sıcak', bg: colors.dangerSoft, fg: colors.hot },
  warm: { label: 'Ilık', bg: colors.warnSoft, fg: '#B45309' },
  cold: { label: 'Soğuk', bg: '#E0F2FE', fg: colors.cold },
};

export const TYPE_LABEL = {
  quote: 'Fiyat teklifi',
  idea: 'Proje fikri',
  question: 'Genel soru',
};

export const BUDGET_LABEL = {
  '<50k': '50.000 ₺ altı',
  '50k-150k': '50.000 – 150.000 ₺',
  '150k-500k': '150.000 – 500.000 ₺',
  '500k+': '500.000 ₺ üstü',
  belirtilmemis: 'Belirtmek istemiyor',
};

export const TIMEFRAME_LABEL = {
  hemen: 'Hemen',
  '1_ay_icinde': '1 ay içinde',
  '1_3_ay': '1-3 ay içinde',
  belirsiz: 'Henüz belirsiz',
};

// Departmanlar tek kaynaktan — Görevler modülü de aynı listeyi kullanıyor.
// Aşağıdaki yardımcılar da kullandığı için sadece re-export değil, import da
// ediyoruz (`export ... from` değerleri modül kapsamına getirmez).
export { DEPARTMENTS, DEPARTMENT_LABEL };

// Zaman çizelgesi olay metinleri (LeadEvent.action).
export const EVENT_LABEL = {
  created: 'talebi oluşturdu',
  status_changed: 'durumu değiştirdi:',
  assigned: 'atadı',
  converted: 'fırsata dönüştürdü',
};

export const statusMeta = (s) => STATUS[s] || STATUS.new;
export const tempMeta = (t) => TEMPERATURE[t] || TEMPERATURE.cold;

export const STATUS_OPTIONS = LEAD_STATUSES.map((s) => ({ value: s, label: STATUS[s].label }));
export const DEPARTMENT_OPTIONS = DEPARTMENTS.map((d) => ({ value: d, label: DEPARTMENT_LABEL[d] }));

/**
 * Tek satır özet — "Fiyat teklifi · 50.000 – 150.000 ₺ · 1 ay içinde ·
 * kurumsal e-posta". Web'deki utils/leadSummary.js'in birebir karşılığı; orada
 * `t()` dışarıdan geliyordu, burada etiketler yerel. Saf fonksiyon.
 * `isCorporateEmail` backend'de hesaplanıp yanıta ekleniyor.
 */
export function summarizeLead(lead) {
  if (!lead) return '';
  const parts = [TYPE_LABEL[lead.type] || lead.type];

  if (lead.type === 'quote') {
    if (BUDGET_LABEL[lead.budgetRange]) parts.push(BUDGET_LABEL[lead.budgetRange]);
    if (TIMEFRAME_LABEL[lead.timeframe]) parts.push(TIMEFRAME_LABEL[lead.timeframe]);
  }
  if (lead.isCorporateEmail) parts.push('kurumsal e-posta');

  return parts.join(' · ');
}

// Yetkiler — backend config/permissions.js `leads` bloğu ile birebir.
// Okuma herkese açık (intern'de e-posta/telefon maskeli gelir), yazma
// super_admin + staff.
export const canWriteLead = (role) => ['super_admin', 'staff'].includes(role);

/**
 * Hangi departmanlara atama yapılabilir — web utils/leadScope.js'in aynası
 * (o da backend/utils/leadScope.js'in aynası). Gerçek yetki her zaman
 * backend'de zorlanır; burası sadece "hangi seçenekler gösterilsin" kararı.
 */
export function assignableDepartmentsFor(user) {
  if (!user) return [];
  if (user.role === 'super_admin') return DEPARTMENTS;
  if (user.isDepartmentLead && user.department) return [user.department];
  return [];
}

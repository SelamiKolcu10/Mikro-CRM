import { colors } from '../theme';

// Geri Bildirim sabitleri — backend/models/Feedback.js enum'ları ve web'deki
// i18n etiketleriyle senkron. Mobilde i18n katmanı yok, etiketler Türkçe.
export const FEEDBACK_TYPES = ['bug', 'feature', 'improvement'];
export const FEEDBACK_STATUSES = ['open', 'in-progress', 'resolved', 'closed'];
export const FEEDBACK_PRIORITIES = ['critical', 'high', 'medium', 'low'];

// Aktif/Çözülen sekmelerinin hangi durumları kapsadığı — web Feedbacks.jsx
// ile aynı ayrım.
export const ACTIVE_STATUSES = ['open', 'in-progress'];
export const RESOLVED_STATUSES = ['resolved', 'closed'];

export const TYPE = {
  bug: { label: 'Hata', bg: colors.dangerSoft, fg: colors.danger },
  feature: { label: 'Özellik İsteği', bg: colors.primarySoft, fg: colors.primary },
  improvement: { label: 'İyileştirme', bg: colors.warnSoft, fg: '#B45309' },
};

export const STATUS = {
  open: { label: 'Açık', bg: colors.primarySoft, fg: colors.primary },
  'in-progress': { label: 'Devam Ediyor', bg: colors.warnSoft, fg: '#B45309' },
  resolved: { label: 'Çözüldü', bg: colors.successSoft, fg: colors.success },
  closed: { label: 'Kapatıldı', bg: '#EEF1F4', fg: colors.textMuted },
};

export const PRIORITY = {
  critical: { label: 'Kritik', bg: colors.dangerSoft, fg: colors.danger },
  high: { label: 'Yüksek', bg: colors.warnSoft, fg: '#B45309' },
  medium: { label: 'Orta', bg: '#E0F2FE', fg: '#0369A1' },
  low: { label: 'Düşük', bg: '#EEF1F4', fg: colors.textMuted },
};

// Müşteri plan rozeti (kartlarda müşteri adının yanında).
export const PLAN_LABEL = {
  free: 'Ücretsiz',
  starter: 'Başlangıç',
  premium: 'Premium',
  vip: 'VIP',
};

export const typeMeta = (t) => TYPE[t] || TYPE.improvement;
export const statusMeta = (s) => STATUS[s] || STATUS.open;
export const priorityMeta = (p) => PRIORITY[p] || PRIORITY.low;

const opts = (map, keys) => keys.map((k) => ({ value: k, label: map[k].label }));

// SelectField / filtre listeleri için hazır seçenekler.
export const TYPE_OPTIONS = opts(TYPE, FEEDBACK_TYPES);
export const STATUS_OPTIONS = opts(STATUS, FEEDBACK_STATUSES);
export const TYPE_FILTERS = [{ value: '', label: 'Tüm Türler' }, ...TYPE_OPTIONS];
export const STATUS_FILTERS = [{ value: '', label: 'Tüm Durumlar' }, ...STATUS_OPTIONS];
export const PRIORITY_FILTERS = [
  { value: '', label: 'Tüm Öncelikler' },
  ...opts(PRIORITY, FEEDBACK_PRIORITIES),
];

// Yetkiler — backend config/permissions.js `feedbacks` bloğu ile birebir.
// Oluşturma/düzenleme/silme staff+super_admin; durum değiştirmeye support da
// dahil (günlük ticket akışını o yürütüyor).
export const canWriteFeedback = (role) => ['super_admin', 'staff'].includes(role);
export const canUpdateFeedbackStatus = (role) =>
  ['super_admin', 'staff', 'support'].includes(role);

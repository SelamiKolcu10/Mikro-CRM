import { colors } from '../theme';

// MailLog.status enum'ının aynası.
// 'mocked' bilerek "Taslak" diye adlandırıldı: kayıt üretildi ama posta
// gerçekten gönderilmedi — kullanıcı gitmiş sanmasın.
export const MAIL_STATUS = {
  mocked: { label: 'Taslak', bg: colors.primarySoft, fg: colors.primary },
  sent: { label: 'Gönderildi', bg: colors.successSoft, fg: colors.success },
  failed: { label: 'Hata', bg: colors.dangerSoft, fg: colors.danger },
  skipped: { label: 'Atlandı', bg: colors.warnSoft, fg: '#B45309' },
};

export const mailStatusMeta = (s) => MAIL_STATUS[s] || MAIL_STATUS.skipped;

export const MAIL_STATUS_FILTERS = [
  { value: '', label: 'Tümü' },
  { value: 'mocked', label: 'Taslak' },
  { value: 'sent', label: 'Gönderildi' },
  { value: 'failed', label: 'Hata' },
  { value: 'skipped', label: 'Atlandı' },
];

// Bildirim türlerinin okunabilir karşılığı (config/notifications.js ile aynı sözlük).
export const MAIL_KIND_LABEL = {
  TASK_ASSIGNED: 'Görev atandı',
  TASK_STATUS_CHANGED: 'Görev durumu',
  TASK_COMMENT: 'Görev yorumu',
  APPROVAL_DECIDED: 'Onay sonucu',
  QUOTE_EVENT: 'Teklif olayı',
};

/**
 * Hattın o anki modu — ekranın en önemli bilgisi, tek yerden üretiliyor.
 * `config` liste yanıtından gelir.
 */
export function mailModeText(config) {
  if (!config) return { text: 'Durum bilinmiyor', live: false };
  if (!config.enabled) {
    return { text: 'E-posta kapalı — hiçbir mail denenmiyor', live: false };
  }
  if (config.provider === 'mock') {
    return { text: 'Deneme modu — mailler üretiliyor ama GÖNDERİLMİYOR', live: false };
  }
  return { text: 'Canlı — mailler gerçekten gönderiliyor', live: true };
}

// Mail kayıtlarını görme yetkisi — backend yalnız super_admin'e açıyor.
export const canViewMailLogs = (user) => user?.role === 'super_admin';

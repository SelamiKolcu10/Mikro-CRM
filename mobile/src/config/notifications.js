import { colors } from '../theme';

/**
 * Bildirim türleri — backend/models/Notification.js `type` enum'ının aynası.
 *
 * `tab`/`screen`: bildirime dokunulduğunda nereye gidileceği. Backend `link`
 * alanında WEB yolunu tutuyor (ör. '/tasks?id=...'); mobilde o yolu ayrıştırmak
 * yerine türden navigasyon hedefine eşliyoruz — kimlikler `meta` içinde hazır.
 */
export const NOTIFICATION_TYPE = {
  TASK_ASSIGNED: {
    label: 'Görev',
    icon: 'checkbox-outline',
    color: colors.primary,
    bg: colors.primarySoft,
    tab: 'Anasayfa',
    screen: 'Tasks',
  },
  TASK_STATUS_CHANGED: {
    label: 'Görev Durumu',
    icon: 'sync-outline',
    color: colors.primary,
    bg: colors.primarySoft,
    tab: 'Anasayfa',
    screen: 'Tasks',
  },
  TASK_COMMENT: {
    label: 'Yorum',
    icon: 'chatbubble-outline',
    color: colors.primary,
    bg: colors.primarySoft,
    tab: 'Anasayfa',
    screen: 'Tasks',
  },
  APPROVAL_DECIDED: {
    label: 'Onay',
    icon: 'checkmark-done-outline',
    color: colors.success,
    bg: colors.successSoft,
    tab: null,
    screen: null, // Onay Kuyruğu çekmecede, sekmede değil
  },
  QUOTE_EVENT: {
    label: 'Teklif',
    icon: 'document-text-outline',
    color: '#B45309',
    bg: colors.warnSoft,
    tab: 'Satış',
    screen: 'Quotes',
  },
};

export const notificationMeta = (type) =>
  NOTIFICATION_TYPE[type] || {
    label: 'Bildirim',
    icon: 'notifications-outline',
    color: colors.textMuted,
    bg: '#EEF1F4',
    tab: null,
    screen: null,
  };

/** "3 dk önce" / "2 sa önce" / "5 gün önce" — liste satırları için. */
export function timeAgo(date) {
  const then = new Date(date).getTime();
  if (Number.isNaN(then)) return '';
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return 'şimdi';
  if (mins < 60) return `${mins} dk önce`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} sa önce`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} gün önce`;
  return new Date(then).toLocaleDateString('tr-TR');
}

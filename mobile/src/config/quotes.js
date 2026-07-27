import { colors } from '../theme';

// Teklif durum etiketleri + chip renkleri. Hem Teklifler listesi hem de
// Ürün Kataloğu'ndaki "Geçmiş Satışlar" paneli buradan okur (drift olmasın).
export const QUOTE_STATUS = {
  draft: { label: 'Taslak', bg: '#EEF1F4', fg: colors.textMuted },
  sent: { label: 'Gönderildi', bg: colors.primarySoft, fg: colors.primary },
  accepted: { label: 'Kabul Edildi', bg: colors.successSoft, fg: colors.success },
  rejected: { label: 'Reddedildi', bg: colors.dangerSoft, fg: colors.danger },
  expired: { label: 'Süresi Doldu', bg: colors.warnSoft, fg: '#B45309' },
};

export const quoteStatus = (status) => QUOTE_STATUS[status] || QUOTE_STATUS.draft;

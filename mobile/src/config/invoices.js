import { colors } from '../theme';

// Satış faturası durumları — backend/models/Invoice.js enum'ının aynası.
export const INVOICE_STATUS = {
  draft: { label: 'Taslak', bg: '#EEF1F4', fg: colors.textMuted },
  issued: { label: 'Kesildi', bg: colors.primarySoft, fg: colors.primary },
  paid: { label: 'Ödendi', bg: colors.successSoft, fg: colors.success },
  overdue: { label: 'Gecikmiş', bg: colors.dangerSoft, fg: colors.danger },
  cancelled: { label: 'İptal', bg: '#EEF1F4', fg: colors.textFaint },
};

export const invoiceStatusMeta = (s) => INVOICE_STATUS[s] || INVOICE_STATUS.draft;

export const SALES_STATUS_FILTERS = [
  { value: '', label: 'Tüm Durumlar' },
  ...Object.entries(INVOICE_STATUS).map(([value, { label }]) => ({ value, label })),
];

// Gelen (OCR) faturaların doğrulama durumu — invoice-ocr-v2 Invoice modelinin
// `validationStatus` enum'ı. Satış faturası durumlarından ayrı bir eksen:
// burası "OCR okuduğunu doğrulayabildi mi", orası "fatura tahsil edildi mi".
export const OCR_STATUS = {
  verified: { label: 'Doğrulandı', bg: colors.successSoft, fg: colors.success },
  mismatch: { label: 'Uyuşmazlık', bg: colors.warnSoft, fg: '#B45309' },
  pending: { label: 'Beklemede', bg: '#EEF1F4', fg: colors.textMuted },
};

export const ocrStatusMeta = (s) => OCR_STATUS[s] || OCR_STATUS.pending;

export const OCR_STATUS_FILTERS = [
  { value: '', label: 'Tüm Durumlar' },
  ...Object.entries(OCR_STATUS).map(([value, { label }]) => ({ value, label })),
];

// OCR servisinin kabul ettiği dosya türleri (invoice-ocr-v2 upload middleware).
export const OCR_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
export const OCR_MAX_FILES = 20;

// Fatura okuma yetkisi — backend config/permissions.js `invoices.read` ile
// birebir. Sohbet ekranını görebilen rollerden yalnızca super_admin bu
// listeye erişebilir (accountant'ın sohbet yetkisi yok), staff/support/intern
// istek atarsa 403 alır — bu yüzden profil ekranında bağlantı gizlenir.
export const canReadInvoices = (role) => ['super_admin', 'accountant'].includes(role);

// Fatura yazma yetkisi — backend config/permissions.js `invoices.write` aynası.
// Resmî fatura kesme de bu yetkiye bağlı.
export const canWriteInvoices = (role) => ['super_admin', 'accountant'].includes(role);

// Resmî e-Fatura (GİB) durumları — satış faturasının `status` alanından AYRI
// bir eksen: buradaki "Kesildi" GİB'e iletildi demek, tahsil edildi demek
// değil. Backend Invoice modelinin eInvoice.status enum'ının aynası.
export const EINVOICE_STATUS = {
  NONE: { label: 'Kesilmedi', bg: '#EEF1F4', fg: colors.textMuted },
  SENDING: { label: 'Gönderiliyor…', bg: colors.warnSoft, fg: '#B45309' },
  ISSUED: { label: 'Kesildi (GİB)', bg: colors.successSoft, fg: colors.success },
  FAILED: { label: 'Hata', bg: colors.dangerSoft, fg: colors.danger },
};

export const eInvoiceStatusMeta = (s) => EINVOICE_STATUS[s] || EINVOICE_STATUS.NONE;

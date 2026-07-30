import { colors } from '../theme';

// PendingApproval.status enum'ının aynası. "conflict" bir hata değil bir
// sonuç: onaylanmaya çalışıldı ama hedef kayıt istek yapıldıktan sonra
// değiştiği için uygulanmadı (baseVersion tutmadı).
export const APPROVAL_STATUS = {
  pending: { label: 'Bekliyor', bg: colors.primarySoft, fg: colors.primary },
  approved: { label: 'Onaylandı', bg: colors.successSoft, fg: colors.success },
  rejected: { label: 'Reddedildi', bg: colors.dangerSoft, fg: colors.danger },
  conflict: { label: 'Çakışma', bg: colors.warnSoft, fg: '#B45309' },
};

export const approvalStatusMeta = (s) => APPROVAL_STATUS[s] || APPROVAL_STATUS.pending;

export const STATUS_FILTERS = [
  { value: 'pending', label: 'Bekliyor' },
  { value: 'approved', label: 'Onaylandı' },
  { value: 'rejected', label: 'Reddedildi' },
  { value: 'conflict', label: 'Çakışma' },
  { value: '', label: 'Tümü' },
];

// Kuyruğa yalnız override verilebilen kaynaklar düşebiliyor (bkz.
// config/accessControl.js), ama bilinmeyen bir kaynak gelirse ham adı yazılır.
export const RESOURCE_LABEL = {
  customers: 'Müşteri Kaydı',
  feedbacks: 'Geri Bildirim',
};

export const ACTION_LABEL = {
  create: 'Ekleme',
  update: 'Düzenleme',
  delete: 'Silme',
};

// Payload'da işe yaramayan/gürültü yapan teknik alanlar.
const HIDDEN_KEYS = new Set(['_id', '__v', 'createdAt', 'updatedAt', 'password']);

const FIELD_LABEL = {
  name: 'Ad',
  company: 'Şirket',
  email: 'E-posta',
  phone: 'Telefon',
  plan: 'Plan',
  tier: 'Plan',
  mrr: 'MRR',
  title: 'Başlık',
  description: 'Açıklama',
  status: 'Durum',
  type: 'Tür',
  priority: 'Öncelik',
  notes: 'Not',
};

/**
 * Talep detayı — payload serbest biçimli (Mixed) olduğu için okunabilir
 * "Alan: değer" satırlarına çeviriyoruz. Web ham JSON gösteriyor; mobilde o
 * dar kartta okunmuyor. Anlamlandıramadığımız değerleri uydurmuyoruz,
 * olduğu gibi yazıyoruz.
 */
export function summarizePayload(payload) {
  if (!payload || typeof payload !== 'object') return null;

  const parts = Object.entries(payload)
    .filter(([k, v]) => !HIDDEN_KEYS.has(k) && v !== null && v !== undefined && v !== '')
    .map(([k, v]) => {
      const label = FIELD_LABEL[k] || k;
      const value =
        typeof v === 'object' ? JSON.stringify(v) : String(v);
      return `${label}: ${value}`;
    });

  return parts.length ? parts.join(' · ') : null;
}

// Onaylama/reddetme yetkisi — backend PERMISSIONS.approvals.review.
export const canReviewApprovals = (user) => user?.role === 'super_admin';

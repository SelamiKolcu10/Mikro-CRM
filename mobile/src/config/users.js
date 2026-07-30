import { colors } from '../theme';
import { ROLE_LABELS } from './navigation';
import { DEPARTMENT_OPTIONS } from './departments';

export { ROLE_LABELS };

// Kullanıcı yönetiminde yazma yetkisi — backend PERMISSIONS.users.write.
// Okuma intern'e de açık ama o yalnız görüntüler (e-postalar maskeli gelir).
export const canManageUsers = (user) => user?.role === 'super_admin';

// Onay durumu — User modelinin `status` enum'ı.
export const USER_STATUS = {
  approved: { label: 'Onaylı', color: colors.success },
  pending: { label: 'Onay bekliyor', color: colors.warm },
  rejected: { label: 'Reddedildi', color: colors.danger },
};

export const userStatusMeta = (s) => USER_STATUS[s] || USER_STATUS.pending;

// Yeni kullanıcıya atanabilecek roller — super_admin hariç
// (backend CREATABLE_ROLES aynı kuralı uyguluyor).
const ALL_ROLES = ['super_admin', 'accountant', 'staff', 'support', 'intern'];

export const CREATABLE_ROLE_OPTIONS = ALL_ROLES
  .filter((r) => r !== 'super_admin')
  .map((value) => ({ value, label: ROLE_LABELS[value] || value }));

// Mevcut kullanıcının rolü super_admin'e YÜKSELTİLEBİLİR (PATCH /:id/role
// ALL_ROLES kabul eder), o yüzden düzenleme listesi oluşturmadan geniştir.
export const ROLE_OPTIONS = ALL_ROLES.map((value) => ({
  value,
  label: ROLE_LABELS[value] || value,
}));

export const DEPARTMENT_SELECT_OPTIONS = [
  { value: '', label: 'Departman yok' },
  ...DEPARTMENT_OPTIONS,
];

/** Ay sayısını "2 yıl 11 ay" / "6 ay" biçiminde yazar. */
export function formatMonths(months) {
  if (!Number.isFinite(months) || months < 1) return '1 aydan az';
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (!years) return `${rest} ay`;
  return rest ? `${years} yıl ${rest} ay` : `${years} yıl`;
}

/**
 * "Şirkette süre" — kayıt tarihinden bugüne, referanstaki gibi
 * "1 yıl 3 ay" / "6 ay" biçiminde.
 */
export function formatTenure(createdAt) {
  if (!createdAt) return '—';
  const start = new Date(createdAt);
  if (Number.isNaN(start.getTime())) return '—';

  const now = new Date();
  let months =
    (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months -= 1;
  return formatMonths(months);
}

import { colors } from '../theme';

// Canlı sohbet yardımcıları — plan etiketleri, avatar üretimi, SLA rozet
// renkleri. Etiketler web i18n'iyle aynı (mobilde i18n katmanı yok).
export const PLAN_LABEL = {
  free: 'Ücretsiz',
  starter: 'Başlangıç',
  premium: 'Premium',
  vip: 'VIP',
};

export const PLAN_FILTERS = [
  { value: '', label: 'Tümü' },
  { value: 'vip', label: 'VIP' },
  { value: 'premium', label: 'Premium' },
  { value: 'starter', label: 'Başlangıç' },
  { value: 'free', label: 'Ücretsiz' },
];

// SLA durumu → rozet rengi/etiketi. 'ok' rozet göstermez (sessiz bant).
export const SLA_STYLE = {
  warning: { bg: colors.warnSoft, fg: '#B45309', label: 'SLA riski' },
  critical: { bg: colors.dangerSoft, fg: colors.danger, label: 'SLA kritik' },
  breached: { bg: colors.danger, fg: '#fff', label: 'SLA aşıldı' },
};

/** Ad → en fazla 2 harflik baş harf (liste avatarı için). */
export const getInitials = (name) => {
  if (!name) return '?';
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toLocaleUpperCase('tr');
  return (parts[0][0] + parts[parts.length - 1][0]).toLocaleUpperCase('tr');
};

/**
 * Müşteri kimliğinden deterministik avatar rengi — aynı müşteri her render ve
 * her oturumda aynı rengi alsın diye (kayıtlı bir renk alanına gerek kalmadan).
 * Web'deki getAvatarColor ile aynı hash.
 */
export const getAvatarColor = (id) => {
  const str = String(id || '');
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  return `hsl(${hash % 360}, 55%, 45%)`;
};

/** "şimdi" / "12dk" / "3sa" / "2g" — liste satırlarındaki son mesaj zamanı. */
export const relativeTime = (iso) => {
  if (!iso) return '';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'şimdi';
  if (mins < 60) return `${mins}dk`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}sa`;
  return `${Math.floor(hours / 24)}g`;
};

/** Müşteri kaydı yaşı — "2 yıl 3 ay" / "5 ay". */
export const formatTenure = (createdAt) => {
  if (!createdAt) return '—';
  const months = Math.max(
    0,
    Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30.44))
  );
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (years > 0) return `${years} yıl${rem > 0 ? ` ${rem} ay` : ''}`;
  return `${months} ay`;
};

/**
 * Kaba "ortalama yanıt süresi" — müşteri mesajı ile onu takip eden personel
 * yanıtı arasındaki boşlukların ortalaması. Backend'de böyle bir metrik yok,
 * yüklenmiş mesajlardan hesaplanıyor (web ChatDashboard ile aynı yöntem).
 */
export const computeAvgResponseMinutes = (messages) => {
  if (!messages || messages.length < 2) return null;
  const gaps = [];
  let pendingCustomerAt = null;
  for (const m of messages) {
    if (m.senderType !== 'internal') {
      if (pendingCustomerAt === null) pendingCustomerAt = new Date(m.createdAt).getTime();
    } else if (pendingCustomerAt !== null) {
      gaps.push((new Date(m.createdAt).getTime() - pendingCustomerAt) / 60000);
      pendingCustomerAt = null;
    }
  }
  if (gaps.length === 0) return null;
  return Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
};

// Sohbet atama yalnız super_admin'de (backend chatRoutes.js: assign ucu
// authorize(ROLES.SUPER_ADMIN)). Mesaj yazma: super_admin/staff/support —
// intern okur ama asla yazamaz.
export const canWriteChat = (role) => ['super_admin', 'staff', 'support'].includes(role);
export const canAssignChat = (role) => role === 'super_admin';

// Hata günlüğü paneli örnek veridir — bağlı bir crash-reporting hattı yok,
// yalnız düzeni gösterir. Altındaki "Bug Ticket'a Çevir" gerçek Feedback
// kaydı oluşturur (web ChatDashboard'daki MOCK_ERROR_TRACE ile aynı metin).
export const MOCK_ERROR_TRACE = `CRITICAL: InvoicesV2.jsx:42
Cannot read properties of undefined (reading 'vatRate')
  at calculateLineTotal (InvoicesV2.jsx:42:18)
  at InvoicesV2 (InvoicesV2.jsx:97:24)`;

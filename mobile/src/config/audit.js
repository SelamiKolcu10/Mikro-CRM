import { colors } from '../theme';

// AuditLog.severity enum'ının aynası.
export const SEVERITY = {
  info: { label: 'Bilgi', bg: '#EEF1F4', fg: colors.textMuted },
  sensitive: { label: 'Hassas', bg: colors.warnSoft, fg: '#B45309' },
  critical: { label: 'Kritik', bg: colors.dangerSoft, fg: colors.danger },
};

export const severityMeta = (s) => SEVERITY[s] || SEVERITY.info;

// AuditLog.collectionName enum'ı. 'System' gerçek bir koleksiyon değil —
// uygulamanın kendisi hakkında yazdığı sentetik kayıtlar (ör. zincir
// göçünün genesis işareti) için ayrılmış.
export const COLLECTION_LABEL = {
  User: 'Kullanıcı',
  Customer: 'Müşteri',
  CustomerUser: 'Portal Kullanıcısı',
  Feedback: 'Geri Bildirim',
  PermissionOverride: 'Yetki Tanımı',
  System: 'Sistem',
};

export const ACTION_LABEL = {
  create: 'Oluşturma',
  update: 'Güncelleme',
  delete: 'Silme',
};

const FIELD_LABEL = {
  status: 'Durum',
  role: 'Rol',
  department: 'Departman',
  name: 'Ad',
  email: 'E-posta',
  phone: 'Telefon',
  company: 'Şirket',
  tier: 'Plan',
  plan: 'Plan',
  mrr: 'MRR',
  title: 'Başlık',
  active: 'Aktiflik',
  resource: 'Kaynak',
  isDepartmentLead: 'Departman Liderliği',
};

export const fieldLabel = (f) => FIELD_LABEL[f] || f;

export const formatValue = (v) => {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'evet' : 'hayır';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

// Kaydın kime/neye ait olduğu — snapshot serbest biçimli, sırayla en
// anlamlı alanı dene.
export const targetLabel = (log) =>
  log?.snapshot?.name || log?.snapshot?.title || log?.snapshot?.email || null;

/**
 * Satır özeti — "Admin, Durum alanını 'active' olarak güncelledi" gibi.
 *
 * TAMAMEN kayıttaki verilerden türetilir (aktör, action, changes); metin
 * uydurulmaz. Birden çok alan değiştiyse ilki yazılıp "+N alan" eklenir.
 */
export function describeLog(log) {
  if (!log) return '';
  const actor = log.actorEmail || (log.actorType === 'system' ? 'Sistem' : 'Bilinmeyen');
  const what = COLLECTION_LABEL[log.collectionName] || log.collectionName;
  const target = targetLabel(log);
  const subject = target ? `${what} "${target}"` : what;

  if (log.action === 'create') return `${actor}, ${subject} kaydını oluşturdu`;
  if (log.action === 'delete') return `${actor}, ${subject} kaydını sildi`;

  const changes = log.changes || [];
  if (!changes.length) return `${actor}, ${subject} kaydını güncelledi`;

  const [first] = changes;
  const extra = changes.length > 1 ? ` +${changes.length - 1} alan` : '';
  return `${actor}, ${fieldLabel(first.field)} alanını "${formatValue(first.after)}" olarak güncelledi${extra}`;
}

// "23 Temmuz 2026 Perşembe" → grup başlığı için.
export const dayHeading = (d) => {
  try {
    return new Date(d)
      .toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' })
      .toLocaleUpperCase('tr');
  } catch {
    return '';
  }
};

export const timeOf = (d) => {
  try {
    return new Date(d).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '';
  }
};

// Aktör filtresi yalnız super_admin'de anlamlı (uç de ona açık).
export const canFilterByActor = (user) => user?.role === 'super_admin';

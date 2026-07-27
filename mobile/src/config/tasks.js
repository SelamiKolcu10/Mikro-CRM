import { colors } from '../theme';

// Görev sabitleri — backend/models/Task.js enum'ları ve web i18n etiketleriyle
// senkron. Mobilde i18n katmanı yok, etiketler Türkçe.
export const PRIORITY = {
  critical: { label: 'Kritik', bg: colors.dangerSoft, fg: colors.danger, dot: colors.danger },
  high: { label: 'Yüksek', bg: colors.warnSoft, fg: '#B45309', dot: colors.warm },
  medium: { label: 'Orta', bg: '#E0F2FE', fg: '#0369A1', dot: colors.cold },
  low: { label: 'Düşük', bg: '#EEF1F4', fg: colors.textMuted, dot: colors.textFaint },
};

export const STATUS = {
  todo: { label: 'Yapılacak', bg: '#EEF1F4', fg: colors.textMuted },
  in_progress: { label: 'Yapılıyor', bg: colors.primarySoft, fg: colors.primary },
  in_review: { label: 'İncelemede', bg: colors.warnSoft, fg: '#B45309' },
  done: { label: 'Tamamlandı', bg: colors.successSoft, fg: colors.success },
};

export const STATUSES = ['todo', 'in_progress', 'in_review', 'done'];
export const PRIORITIES = ['critical', 'high', 'medium', 'low'];

// Tamamlanan görevler panoda 7 gün görünür, sonra "Görev Geçmişi" sekmesine
// düşer (web TaskBoard ile aynı kural).
export const DONE_VISIBLE_DAYS = 7;

// Aynı günün görevleri önceliğe göre sıralanır (web CalendarView ile aynı).
export const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

export const priorityMeta = (p) => PRIORITY[p] || PRIORITY.medium;
export const statusMeta = (s) => STATUS[s] || STATUS.todo;

export const MONTHS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

// Pazartesi başlangıçlı — takvim ızgarası da öyle kuruluyor.
export const WEEKDAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

// Departmanlar tek kaynaktan (config/departments.js) gelir; ekranlar zaten
// config/tasks.js'i import ettiği için buradan yeniden dışa veriyoruz.
export { DEPARTMENTS, DEPARTMENT_LABEL, DEPARTMENT_OPTIONS } from './departments';

/**
 * Bir görevin tarihini değiştirme yetkisi — web utils/taskScope.js'in aynası
 * (o da backend/utils/taskScope.js'in aynası). super_admin her görevi,
 * departman lideri yalnız kendi departmanının görevlerini taşıyabilir.
 * Gerçek yetki her zaman backend'de zorlanır.
 */
export function canApproveTask(user, task) {
  if (!user || !task) return false;
  if (user.role === 'super_admin') return true;
  return !!(user.isDepartmentLead && user.department && user.department === task.department);
}

/** Görevi ilerletme: lider/super_admin ya da görevin atandığı kişi. */
export function canActOnTask(user, task) {
  if (!user || !task) return false;
  if (canApproveTask(user, task)) return true;
  return (task.assignedTo?._id || task.assignedTo) === user._id;
}

/** Yorum yazma intern'e kapalı (backend addTaskComment kuralının aynısı). */
export const canCommentOnTask = (user) => !!user && user.role !== 'intern';

/** Görev oluşturma: super_admin ya da departman lideri. */
export const canCreateTask = (user) =>
  !!user && (user.role === 'super_admin' || user.isDepartmentLead);

/**
 * Departman filtresini gerçekten kimin görmesi anlamlı: yalnız super_admin ve
 * intern tüm departmanları görebiliyor. Lider/üye zaten backend'den sadece
 * kendi departmanının verisini alıyor — onlara "başka departman seç" demek
 * boş bir pano gösterirdi (web Tasks.jsx'teki aynı gerekçe).
 */
export const hasFullDepartmentAccess = (user) =>
  user?.role === 'super_admin' || user?.role === 'intern';

// Katkı aktivitesi (heatmap) olay etiketleri.
export const ACTIVITY_ACTION = {
  created: 'oluşturdu',
  status_changed: 'taşıdı →',
  deadline_changed: 'tarihini değiştirdi',
};

/** Saf filtre fonksiyonu — web hooks/useTasks.js:applyTaskFilters'ın aynısı. */
export function applyTaskFilters(tasks, filters, currentUserId) {
  return tasks.filter((task) => {
    const assigneeId = task.assignedTo?._id || task.assignedTo;
    const projectId = task.projectId?._id || task.projectId;
    if (filters.onlyMine && assigneeId !== currentUserId) return false;
    if (filters.department && task.department !== filters.department) return false;
    if (filters.assigneeId && assigneeId !== filters.assigneeId) return false;
    return true;
  });
}

// Kişi avatarı — kimliğe göre sabit renk + baş harfler (web TaskAvatar).
const AVATAR_COLORS = ['#7c5cfc', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#a78bfa', '#06b6d4', '#ec4899'];

export function avatarColor(id) {
  const str = String(id || '');
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) hash = (hash * 31 + str.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function avatarInitials(name) {
  if (!name) return '?';
  const parts = String(name).trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toLocaleUpperCase('tr');
}

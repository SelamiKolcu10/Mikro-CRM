import { colors } from '../theme';

const idOf = (v) => String(v?._id || v?.id || v || '');

/**
 * Web utils/projectScope.js'in aynası (o da backend/utils/projectScope.js'in
 * aynası). Yalnız "proje seçici gösterilsin mi" kararı için; gerçek yetki
 * backend'de zorlanır.
 */
export function canManageProjects(user) {
  if (!user) return false;
  if (user.role === 'super_admin') return true;
  return !!(user.isDepartmentLead && user.department === 'development');
}

/**
 * Projeyi görüntüleme — yönetici her projeyi, ekip üyesi yalnız içinde
 * bulunduğu projeyi. Backend canViewProject ile aynı kural.
 */
export function canViewProject(user, project) {
  if (canManageProjects(user)) return true;
  if (!user || !project) return false;
  return (project.teamMembers || []).some((m) => idOf(m) === idOf(user));
}

/**
 * Proje düzenleme — global yönetici HER ZAMAN, ya da bu projenin atanmış
 * lideri. Oluşturma/silme buna DAHİL DEĞİL, onlar global yöneticide kalır
 * (bkz. backend requireProjectManager vs requireProjectEditor).
 */
export function canEditProject(user, project) {
  if (canManageProjects(user)) return true;
  if (!user || !project?.projectLead) return false;
  return idOf(project.projectLead) === idOf(user);
}

// Stajyer uygulama genelinde salt-okunur — yorum yazamaz (backend
// addProjectComment aynı kuralı uyguluyor).
export const canCommentOnProject = (user) => !!user && user.role !== 'intern';

// Ekip üyesi seçerken gösterilen iş yükü rozetleri — backend
// utils/workloadCalculator.js classifyLoad çıktısının karşılıkları.
export const LOAD_STATUS = {
  LOW_LOAD: { label: 'Müsait', color: colors.success },
  OPTIMAL_LOAD: { label: 'Dengeli', color: colors.warm },
  OVERLOADED: { label: 'Yoğun', color: colors.danger },
};

export const loadStatusMeta = (s) => LOAD_STATUS[s] || LOAD_STATUS.LOW_LOAD;

// Ad/soyaddan avatar baş harfleri ("Selami Kolcu" → "SK").
export const initialsOf = (name) =>
  String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');

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

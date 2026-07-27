import { ROLES } from '../config/permissions';

/**
 * UI tarafı aynası — backend/utils/leadScope.js ile birebir aynı kural.
 * super_admin her departmana atayabilir, departman lideri sadece kendi
 * departmanına. Gerçek yetki her zaman backend'de zorlanır, burası sadece
 * "hangi departman seçenekleri gösterilsin" kararı için.
 */
export function assignableDepartmentsFor(user, allDepartments) {
  if (!user) return [];
  if (user.role === ROLES.SUPER_ADMIN) return allDepartments;
  if (user.isDepartmentLead && user.department) return [user.department];
  return [];
}

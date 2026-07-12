import { ROLES } from '../config/permissions';

/**
 * UI tarafı aynası — backend/utils/taskScope.js ile birebir aynı kural.
 * Burada veri filtrelemek için değil, "bu sürükleme/aksiyon bu kullanıcı
 * için gösterilsin mi" kararı için kullanılır; gerçek yetki her zaman
 * backend'de zorlanır.
 */
export function canApproveTask(user, task) {
  if (!user || !task) return false;
  if (user.role === ROLES.SUPER_ADMIN) return true;
  return !!(user.isDepartmentLead && user.department && user.department === task.department);
}

export function canActOnTask(user, task) {
  if (!user || !task) return false;
  if (canApproveTask(user, task)) return true;
  return task.assignedTo?._id === user._id || task.assignedTo === user._id;
}

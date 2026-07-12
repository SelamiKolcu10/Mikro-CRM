const { ROLES } = require('../config/permissions');

/**
 * Departman bazlı görünürlük — izin matrisinde ifade edilemeyen tek yer
 * burasıdır (satır/veri bazlı filtreleme, rol→aksiyon eşlemesi değil).
 * Hem backend controller'ı hem frontend'deki aynası (bkz.
 * frontend/src/utils/taskScope.js) bu kuralı birebir uygular.
 *
 * department:undefined'ı $or'a koymak Mongoose'un undefined alanları
 * query'den silmesi yüzünden "hepsini getir" gibi davranır — bu yüzden
 * department yoksa o dal $or'a hiç eklenmez (departmansız kullanıcı sadece
 * kendine atanmış görevleri görür, ki zaten hiç olamaz çünkü assignedTo hep
 * kendi departmanıyla eşleşmek zorunda — bkz. taskController.createTask).
 */
function taskScope(user) {
  if (user.role === ROLES.SUPER_ADMIN) return {};

  if (user.isDepartmentLead && user.department) {
    return { department: user.department };
  }

  const or = [{ assignedTo: user._id }];
  if (user.department) or.push({ department: user.department });
  return { $or: or };
}

/** in_review -> done onay yetkisi: task'ın GÜNCEL departmanının lideri ya da super_admin. */
function canApproveTask(user, task) {
  if (user.role === ROLES.SUPER_ADMIN) return true;
  return !!(user.isDepartmentLead && user.department && user.department === task.department);
}

/** todo/in_progress/in_review arası serbest geçiş: assignee, lider veya super_admin. */
function canActOnTask(user, task) {
  if (canApproveTask(user, task)) return true;
  return task.assignedTo.toString() === user._id.toString();
}

module.exports = { taskScope, canApproveTask, canActOnTask };

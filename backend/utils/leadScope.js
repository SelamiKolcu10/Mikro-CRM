const { ROLES } = require('../config/permissions');

/**
 * Lead atama yetkisi — taskScope.js'teki canApproveTask ile aynı desen:
 * super_admin HER departmana atayabilir, departman lideri SADECE kendi
 * departmanına. Sıradan staff (leads.write var ama lider değil) hiçbir
 * departmana atama yapamaz — sadece görüntüleyip not/durum değiştirebilir.
 */
function canAssignLeadToDepartment(user, targetDepartment) {
  if (!user) return false;
  if (user.role === ROLES.SUPER_ADMIN) return true;
  return !!(user.isDepartmentLead && user.department && user.department === targetDepartment);
}

module.exports = { canAssignLeadToDepartment };

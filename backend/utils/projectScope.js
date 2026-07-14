const { ROLES } = require('../config/permissions');

/**
 * Proje CRUD yetkisi — düz rol dizisiyle ifade edilemeyen tek kural
 * (taskScope.js'teki canApproveTask ile aynı desen): super_admin HER ZAMAN,
 * ya da development departmanının lideri (isDepartmentLead + department
 * eşleşmesi). Diğer her rol/departman — staff dahil — reddedilir.
 */
function canManageProjects(user) {
  if (!user) return false;
  if (user.role === ROLES.SUPER_ADMIN) return true;
  return !!(user.isDepartmentLead && user.department === 'development');
}

/**
 * Proje görüntüleme + tartışma (yorum) erişimi — yönetici (canManageProjects)
 * her zaman, ekip üyesi sadece KENDİ projesinde. CRUD (oluştur/düzenle/sil,
 * tüm projeleri listeleme) hâlâ sadece canManageProjects'te kalır — bu sadece
 * "görebilir mi / yorum yazabilir mi" sorusu için (bkz. routes/projectRoutes.js
 * requireProjectViewer).
 */
function canViewProject(user, project) {
  if (!user || !project) return false;
  if (canManageProjects(user)) return true;
  return project.teamMembers.some((member) => (member._id || member).toString() === user._id.toString());
}

/** Bu projeye özel, teamMembers içinden atanmış lider mi (bkz. models/Project.js). */
function isProjectLead(user, project) {
  if (!user || !project || !project.projectLead) return false;
  const leadId = project.projectLead._id || project.projectLead;
  return leadId.toString() === user._id.toString();
}

/**
 * Proje düzenleme (wiki + isim/tech-stack/ekip) — global yönetici HER ZAMAN,
 * ya da BU projenin atanmış lideri. Oluşturma/silme/tam liste bunun dışında,
 * hâlâ sadece canManageProjects'te (bkz. routes/projectRoutes.js).
 */
function canEditProject(user, project) {
  return canManageProjects(user) || isProjectLead(user, project);
}

module.exports = { canManageProjects, canViewProject, isProjectLead, canEditProject };

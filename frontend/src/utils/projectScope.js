import { ROLES } from '../config/permissions';

/**
 * UI tarafı aynası — backend/utils/projectScope.js ile birebir aynı kural.
 * Sadece görünürlük/UX kararı için; gerçek yetki her zaman backend'de zorlanır.
 */
export function canManageProjects(user) {
  if (!user) return false;
  if (user.role === ROLES.SUPER_ADMIN) return true;
  return !!(user.isDepartmentLead && user.department === 'development');
}

/** Yönetici her zaman, ekip üyesi sadece kendi projesinde görebilir/yorum yazabilir. */
export function canViewProject(user, project) {
  if (!user || !project) return false;
  if (canManageProjects(user)) return true;
  return project.teamMembers.some((member) => (member._id || member) === user._id);
}

/** Yorum yazma intern'e kapalı (backend'deki addProjectComment kuralının aynısı). */
export function canCommentOnProject(user, project) {
  return canViewProject(user, project) && user.role !== ROLES.INTERN;
}

/** Bu projeye özel, teamMembers içinden atanmış lider mi. */
export function isProjectLead(user, project) {
  if (!user || !project?.projectLead) return false;
  const leadId = project.projectLead._id || project.projectLead;
  return leadId === user._id;
}

/** Global yönetici HER ZAMAN, ya da bu projenin atanmış lideri düzenleyebilir. */
export function canEditProject(user, project) {
  return canManageProjects(user) || isProjectLead(user, project);
}

/**
 * Frontend kopyası — backend/config/permissions.js ile senkron tutulmalı.
 * Burası SADECE UX içindir (menü/route gizleme); gerçek yetki her zaman
 * backend'de zorlanır.
 */

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ACCOUNTANT: 'accountant',
  STAFF: 'staff',
  SUPPORT: 'support',
  INTERN: 'intern',
};

export const ALL_ROLES = Object.values(ROLES);

// i18n keys, not literal strings — resolve with t(ROLE_LABELS[role]) wherever
// a role label renders (see components/layout/Navbar.jsx for the reference
// usage, the role badge).
export const ROLE_LABELS = {
  [ROLES.SUPER_ADMIN]: 'roles.superAdmin',
  [ROLES.ACCOUNTANT]: 'roles.accountant',
  [ROLES.STAFF]: 'roles.staff',
  [ROLES.SUPPORT]: 'roles.support',
  [ROLES.INTERN]: 'roles.intern',
};

export const DEPARTMENTS = ['development', 'design', 'hr', 'marketing'];

export const DEPARTMENT_LABELS = {
  development: 'departments.development',
  design: 'departments.design',
  hr: 'departments.hr',
  marketing: 'departments.marketing',
};

export const PERMISSIONS = {
  users: {
    read: [ROLES.SUPER_ADMIN, ROLES.INTERN],
    write: [ROLES.SUPER_ADMIN],
    approve: [ROLES.SUPER_ADMIN],
  },
  company: {
    read: ALL_ROLES,
    write: [ROLES.SUPER_ADMIN],
  },
  customers: {
    read: [ROLES.SUPER_ADMIN, ROLES.ACCOUNTANT, ROLES.STAFF, ROLES.SUPPORT, ROLES.INTERN],
    write: [ROLES.SUPER_ADMIN, ROLES.STAFF],
  },
  feedbacks: {
    read: [ROLES.SUPER_ADMIN, ROLES.ACCOUNTANT, ROLES.STAFF, ROLES.SUPPORT, ROLES.INTERN],
    write: [ROLES.SUPER_ADMIN, ROLES.STAFF],
    updateStatus: [ROLES.SUPER_ADMIN, ROLES.STAFF, ROLES.SUPPORT],
  },
  invoices: {
    read: [ROLES.SUPER_ADMIN, ROLES.ACCOUNTANT],
    write: [ROLES.SUPER_ADMIN, ROLES.ACCOUNTANT],
  },
  spendingReport: {
    read: [ROLES.SUPER_ADMIN, ROLES.ACCOUNTANT, ROLES.INTERN],
  },
  auditLog: {
    read: [ROLES.SUPER_ADMIN, ROLES.INTERN],
  },
  // Live customer chat — a separate channel from `feedbacks` (support
  // tickets). Intern can read (see conversations) but never write — sending
  // messages to a customer stays limited to staff/support/super_admin.
  chat: {
    read: [ROLES.SUPER_ADMIN, ROLES.STAFF, ROLES.SUPPORT, ROLES.INTERN],
    write: [ROLES.SUPER_ADMIN, ROLES.STAFF, ROLES.SUPPORT],
    assign: [ROLES.SUPER_ADMIN],
  },
  tasks: {
    read: ALL_ROLES,
    write: [ROLES.SUPER_ADMIN, ROLES.STAFF],
    assign: [ROLES.SUPER_ADMIN, ROLES.STAFF],
    approve: [ROLES.SUPER_ADMIN, ROLES.STAFF],
  },
  // Proje Portföyü — kaba filtre; asıl kural (Dev Lead mi) utils/projectScope.js'te.
  projects: {
    read: [ROLES.SUPER_ADMIN, ROLES.STAFF],
    write: [ROLES.SUPER_ADMIN, ROLES.STAFF],
  },
  // The Pending Approvals queue itself — reviewing/deciding stays
  // super_admin only, regardless of what overrides exist, otherwise a user
  // could grant themselves more access. Reading the queue (who requested
  // what) is opened to intern as part of the read-only visibility rollout.
  approvals: {
    read: [ROLES.SUPER_ADMIN, ROLES.INTERN],
    review: [ROLES.SUPER_ADMIN],
  },
  // Access Control Matrix — granting/revoking a PermissionOverride is always
  // super_admin only (same "no exceptions" rule as before). Reading the
  // matrix (who has what override) is opened to intern.
  permissionOverrides: {
    read: [ROLES.SUPER_ADMIN, ROLES.INTERN],
    write: [ROLES.SUPER_ADMIN],
  },
};

// Resources a Super Admin can grant a runtime PermissionOverride for — kept
// in sync with backend/config/permissions.js's OVERRIDABLE_RESOURCES.
export const OVERRIDABLE_RESOURCES = ['customers', 'feedbacks'];

/**
 * @param {string} role - user.role
 * @param {string} resource - PERMISSIONS anahtarı (ör. 'customers')
 * @param {'read'|'write'} action
 */
export function can(role, resource, action = 'read') {
  const entry = PERMISSIONS[resource];
  if (!entry || !entry[action]) return false;
  return entry[action].includes(role);
}

/** Her rolün giriş sonrası düşeceği varsayılan sayfa. */
export const DEFAULT_ROUTE_BY_ROLE = {
  [ROLES.SUPER_ADMIN]: '/',
  [ROLES.ACCOUNTANT]: '/invoices',
  [ROLES.STAFF]: '/',
  [ROLES.SUPPORT]: '/feedbacks',
  [ROLES.INTERN]: '/customers',
};

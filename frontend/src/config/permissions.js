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

export const ROLE_LABELS = {
  [ROLES.SUPER_ADMIN]: 'Süper Admin',
  [ROLES.ACCOUNTANT]: 'Muhasebeci',
  [ROLES.STAFF]: 'Çalışan',
  [ROLES.SUPPORT]: 'Destek',
  [ROLES.INTERN]: 'Stajer',
};

export const PERMISSIONS = {
  users: {
    read: [ROLES.SUPER_ADMIN],
    write: [ROLES.SUPER_ADMIN],
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
    read: [ROLES.SUPER_ADMIN, ROLES.ACCOUNTANT],
  },
  knowledgeBase: {
    read: ALL_ROLES,
    write: [ROLES.SUPER_ADMIN, ROLES.SUPPORT],
  },
};

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

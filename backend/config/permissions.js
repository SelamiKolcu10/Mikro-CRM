/**
 * Tek kaynak izin matrisi — hem backend authorize middleware'i hem frontend
 * (frontend/src/config/permissions.js kopyası) bu tabloya göre tutarlı kalır.
 * ROLES burada tanımlı; her kaynak için hangi rollerin erişebileceği listelenir.
 */

const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ACCOUNTANT: 'accountant',
  STAFF: 'staff',
  SUPPORT: 'support',
  INTERN: 'intern',
};

const ALL_ROLES = Object.values(ROLES);

// Kaynak → { read: [roller], write: [roller] }
const PERMISSIONS = {
  users: {
    read: [ROLES.SUPER_ADMIN],
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
  // Feedback modeli aynı zamanda müşteri destek taleplerini de temsil eder —
  // Destek ekibi bu talepleri işlemekten sorumlu olduğu için okuma+güncelleme
  // yetkisi var (yeni kalem oluşturma/silme yine super_admin+staff'ta kalıyor).
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
  auditLog: {
    read: [ROLES.SUPER_ADMIN],
  },
  // Live customer chat — a separate channel from `feedbacks` (support
  // tickets). Intern is deliberately excluded: unlike knowledge base/tickets
  // (read-only for them), unsupervised live back-and-forth with a customer
  // is a bigger blast radius for a trainee account.
  chat: {
    read: [ROLES.SUPER_ADMIN, ROLES.STAFF, ROLES.SUPPORT],
    write: [ROLES.SUPER_ADMIN, ROLES.STAFF, ROLES.SUPPORT],
    assign: [ROLES.SUPER_ADMIN],
  },
  // The dynamic override/approval workflow itself (Access Control Matrix +
  // Pending Approvals queue) — always super_admin only, regardless of what
  // overrides exist, otherwise a user could grant themselves more access.
  approvals: {
    read: [ROLES.SUPER_ADMIN],
    review: [ROLES.SUPER_ADMIN],
  },
};

// Resources a Super Admin can grant a runtime PermissionOverride for — kept
// separate from PERMISSIONS' keys since not every resource makes sense to
// override (e.g. `users`, `approvals` themselves stay super_admin-only, no
// exceptions).
const OVERRIDABLE_RESOURCES = ['customers', 'feedbacks'];

module.exports = { ROLES, ALL_ROLES, PERMISSIONS, OVERRIDABLE_RESOURCES };

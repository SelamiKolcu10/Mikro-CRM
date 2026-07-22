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

const DEPARTMENTS = ['development', 'design', 'hr', 'marketing'];
const TASK_PRIORITIES = ['critical', 'high', 'medium', 'low'];
const TASK_STATUSES = ['todo', 'in_progress', 'in_review', 'done'];

// Kaynak → { read: [roller], write: [roller] }
const PERMISSIONS = {
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
  // Task modülü — rol seviyesinde sadece kaba bir filtredir (kimi endpoint'e
  // hiç sokmaz). Asıl kural: departman görünürlüğü backend/utils/taskScope.js
  // içinde, "kim oluşturabilir/onaylayabilir" kontrolü ise controller'da
  // isDepartmentLead + department eşleşmesine bakılarak yapılır — bkz.
  // taskController.js. accountant/support/intern departman taşımadığı için
  // pratikte board'ları hep boş görünür, reddedilmezler.
  tasks: {
    read: ALL_ROLES,
    write: [ROLES.SUPER_ADMIN, ROLES.STAFF],
    assign: [ROLES.SUPER_ADMIN, ROLES.STAFF],
    approve: [ROLES.SUPER_ADMIN, ROLES.STAFF],
  },
  // Proje Portföyü — rol seviyesinde sadece kaba bir filtredir (staff'ı hiç
  // sokmaz demek değil, sadece intern/accountant/support'u eler). Asıl kural
  // "Dev Lead mi" sorusudur ve düz rol dizisiyle ifade edilemez — bkz.
  // utils/projectScope.js (canManageProjects), route'ta bu ikinci katman
  // olarak uygulanır (bkz. routes/projectRoutes.js).
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
  // Formlar / Lead Intake — iki katmanlı: GÖRÜNTÜLEME geniş (super_admin,
  // staff + accountant/support/intern salt-okunur), DEĞİŞTİRME dar
  // (yalnız super_admin+staff lead'i işler: durum/atama/not). Lead'ler ham
  // PII (email/telefon) taşıdığından intern GET'lerinde redactForIntern
  // devrede (bkz. routes/leadRoutes.js) — email+telefon maskelenir.
  leads: {
    read: [ROLES.SUPER_ADMIN, ROLES.STAFF, ROLES.ACCOUNTANT, ROLES.SUPPORT, ROLES.INTERN],
    write: [ROLES.SUPER_ADMIN, ROLES.STAFF],
  },
  // Satış Pipeline (Deal/Fırsat) — GÖRÜNTÜLEME: super_admin + staff + accountant
  // (accountant forecast/ciro için okur). DEĞİŞTİRME: yalnız super_admin+staff
  // (satışı yürüten ekip). intern BİLEREK HARİÇ: deal.value hassas ciro verisi
  // — leads'teki gibi maskeleme değil, tamamen kapalı (route intern'i hiç
  // sokmaz). Tasarım: docs/superpowers/specs/2026-07-21-deal-pipeline-design.md §5.
  deals: {
    read: [ROLES.SUPER_ADMIN, ROLES.STAFF, ROLES.ACCOUNTANT],
    write: [ROLES.SUPER_ADMIN, ROLES.STAFF],
  },
  // Ürün Kataloğu — deals ile aynı çizgi: intern hariç (fiyat hassas ciro
  // verisi), accountant okur, staff+super_admin yazar.
  catalog: {
    read: [ROLES.SUPER_ADMIN, ROLES.STAFF, ROLES.ACCOUNTANT],
    write: [ROLES.SUPER_ADMIN, ROLES.STAFF],
  },
  // Teklifler — intern hariç (teklif tutarları hassas ciro verisi),
  // accountant okur (forecast/fiyatlandırma), yazamaz.
  quotes: {
    read: [ROLES.SUPER_ADMIN, ROLES.STAFF, ROLES.ACCOUNTANT],
    write: [ROLES.SUPER_ADMIN, ROLES.STAFF],
  },
  // Satış Faturaları — muhasebe ve süper admin tam yetkili, staff okuyabilir.
  invoices: {
    read: [ROLES.SUPER_ADMIN, ROLES.ACCOUNTANT, ROLES.STAFF],
    write: [ROLES.SUPER_ADMIN, ROLES.ACCOUNTANT],
  },
};

// Resources a Super Admin can grant a runtime PermissionOverride for — kept
// separate from PERMISSIONS' keys since not every resource makes sense to
// override (e.g. `users`, `approvals` themselves stay super_admin-only, no
// exceptions).
const OVERRIDABLE_RESOURCES = ['customers', 'feedbacks'];

module.exports = { ROLES, ALL_ROLES, PERMISSIONS, OVERRIDABLE_RESOURCES, DEPARTMENTS, TASK_PRIORITIES, TASK_STATUSES };

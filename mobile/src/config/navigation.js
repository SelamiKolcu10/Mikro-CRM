// Single source of truth for the mobile drawer menu — mirrors the web app's
// config/navigation.js (INTERNAL_NAV): same groups, same role gating, same
// order. Only the presentation differs (a native drawer vs a web sidebar).
//
// `roles` = which staff roles see the item. An item whose `name` matches a
// real screen renders that screen; every other item renders PlaceholderScreen
// ("Yakında") until we build it. Icon names are Ionicons (@expo/vector-icons).
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ACCOUNTANT: 'accountant',
  STAFF: 'staff',
  SUPPORT: 'support',
  INTERN: 'intern',
};

export const ROLE_LABELS = {
  super_admin: 'Süper Admin',
  accountant: 'Muhasebe',
  staff: 'Personel',
  support: 'Destek',
  intern: 'Stajyer',
};

const R = ROLES;

export const NAV_GROUPS = [
  {
    section: 'main',
    label: '',
    items: [
      { name: 'Dashboard', label: 'Kontrol Paneli', icon: 'grid-outline', roles: [R.SUPER_ADMIN, R.STAFF] },
    ],
  },
  {
    section: 'sales',
    label: 'Satış',
    items: [
      { name: 'Customers', label: 'Müşteriler', icon: 'people-outline', roles: [R.SUPER_ADMIN, R.ACCOUNTANT, R.STAFF, R.SUPPORT, R.INTERN] },
      { name: 'Deals', label: 'Fırsatlar', icon: 'trending-up-outline', roles: [R.SUPER_ADMIN, R.STAFF, R.ACCOUNTANT] },
      { name: 'Quotes', label: 'Teklifler', icon: 'document-text-outline', roles: [R.SUPER_ADMIN, R.STAFF, R.ACCOUNTANT] },
      { name: 'Catalog', label: 'Ürün Kataloğu', icon: 'cube-outline', roles: [R.SUPER_ADMIN, R.STAFF, R.ACCOUNTANT] },
    ],
  },
  {
    section: 'support',
    label: 'Destek',
    items: [
      { name: 'Feedbacks', label: 'Geri Bildirimler', icon: 'chatbubbles-outline', roles: [R.SUPER_ADMIN, R.STAFF, R.SUPPORT, R.INTERN] },
      { name: 'Leads', label: 'Formlar', icon: 'file-tray-full-outline', roles: [R.SUPER_ADMIN, R.STAFF, R.ACCOUNTANT, R.SUPPORT, R.INTERN] },
      { name: 'Chat', label: 'Canlı Sohbet', icon: 'chatbox-ellipses-outline', roles: [R.SUPER_ADMIN, R.STAFF, R.SUPPORT, R.INTERN] },
    ],
  },
  {
    section: 'planning',
    label: 'Planlama',
    items: [
      { name: 'Calendar', label: 'Takvim', icon: 'calendar-outline', roles: [R.SUPER_ADMIN, R.STAFF, R.INTERN] },
      { name: 'Tasks', label: 'Görevler', icon: 'checkbox-outline', roles: [R.SUPER_ADMIN, R.STAFF, R.INTERN] },
    ],
  },
  {
    section: 'finance',
    label: 'Finans',
    items: [
      { name: 'Invoices', label: 'Faturalar', icon: 'receipt-outline', roles: [R.SUPER_ADMIN, R.ACCOUNTANT] },
    ],
  },
  {
    section: 'analysis',
    label: 'Analiz',
    items: [
      { name: 'Spending', label: 'Genel Harcama', icon: 'bar-chart-outline', roles: [R.SUPER_ADMIN, R.ACCOUNTANT, R.INTERN] },
      // Web'de ayrıca `canManageProjects` (Dev Lead) özel kuralı var; mobilde
      // şimdilik sade rol filtresiyle bırakıldı, gerekince daraltılır.
      { name: 'Projects', label: 'Projeler', icon: 'folder-open-outline', roles: [R.SUPER_ADMIN, R.STAFF] },
    ],
  },
  {
    section: 'admin',
    label: 'Yönetim',
    items: [
      { name: 'Users', label: 'Kullanıcı Yönetimi', icon: 'shield-checkmark-outline', roles: [R.SUPER_ADMIN, R.INTERN] },
      { name: 'AccessControl', label: 'Erişim Kontrolü', icon: 'key-outline', roles: [R.SUPER_ADMIN, R.INTERN] },
      { name: 'Approvals', label: 'Onay Kuyruğu', icon: 'checkmark-done-outline', roles: [R.SUPER_ADMIN, R.INTERN] },
      { name: 'AuditLog', label: 'Denetim Kaydı', icon: 'clipboard-outline', roles: [R.SUPER_ADMIN, R.INTERN] },
    ],
  },
];

// Convenience: every item across groups visible to a given role, in order.
export const visibleItems = (role) =>
  NAV_GROUPS.flatMap((g) => g.items).filter((i) => !i.roles || i.roles.includes(role));

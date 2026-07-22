import {
  HiOutlineViewGrid,
  HiOutlineUsers,
  HiOutlineChatAlt2,
  HiOutlineDocumentText,
  HiOutlineBeaker,
  HiOutlineShieldCheck,
  HiOutlineChartBar,
  HiOutlineClipboardList,
  HiOutlineTicket,
  HiOutlineChat,
  HiOutlineKey,
  HiOutlineClipboardCheck,
  HiOutlineViewBoards,
  HiOutlineFolderOpen,
  HiOutlineInbox,
  HiOutlinePencilAlt,
  HiOutlineTrendingUp,
  HiOutlineCube,
} from 'react-icons/hi';
import { ROLES } from './permissions';
import { canManageProjects } from '../utils/projectScope';

/**
 * Single source of truth for both the staff sidebar and the customer portal
 * sidebar — one <Sidebar/> component (components/layout/Sidebar.jsx) reads
 * from whichever of these matches the session's accountType. Adding a new
 * role or a new portal page only ever means editing this file.
 *
 * `roles: null` means "every account of this type sees this item" (used for
 * the portal, which has no internal roles to filter by).
 */
export const INTERNAL_NAV = [
  {
    section: 'main',
    sectionLabelKey: 'nav.main',
    items: [
      { path: '/', icon: HiOutlineViewGrid, labelKey: 'nav.dashboard', roles: [ROLES.SUPER_ADMIN, ROLES.STAFF] },
      { path: '/customers', icon: HiOutlineUsers, labelKey: 'nav.customers', roles: [ROLES.SUPER_ADMIN, ROLES.ACCOUNTANT, ROLES.STAFF, ROLES.SUPPORT, ROLES.INTERN] },
      { path: '/feedbacks', icon: HiOutlineChatAlt2, labelKey: 'nav.feedbacks', roles: [ROLES.SUPER_ADMIN, ROLES.STAFF, ROLES.SUPPORT, ROLES.INTERN] },
      { path: '/tasks', icon: HiOutlineViewBoards, labelKey: 'nav.tasks', roles: [ROLES.SUPER_ADMIN, ROLES.STAFF, ROLES.INTERN] },
      // Formlar (Lead Intake) — bkz. spec §4/§12: v1'de sadece super_admin+staff,
      // ham PII taşıdığı için support/intern dışında tutuldu. Bildirim badge'i
      // (newLeads) Faz 3'te eklenecek (bkz. Sidebar.jsx fetchPending).
      { path: '/leads', icon: HiOutlineInbox, labelKey: 'nav.leads', roles: [ROLES.SUPER_ADMIN, ROLES.STAFF, ROLES.ACCOUNTANT, ROLES.SUPPORT, ROLES.INTERN] },
      // Satış Pipeline — Formlar'ın (lead) doğal devamı: nitelikli lead → Deal.
      // intern yok (ciro verisi kapalı, bkz. config/permissions.js deals).
      { path: '/deals', icon: HiOutlineTrendingUp, labelKey: 'nav.deals', roles: [ROLES.SUPER_ADMIN, ROLES.STAFF, ROLES.ACCOUNTANT] },
      // Ürün Kataloğu — deals ile aynı çizgi (ciro verisi, intern hariç).
      { path: '/catalog', icon: HiOutlineCube, labelKey: 'nav.catalog', roles: [ROLES.SUPER_ADMIN, ROLES.STAFF, ROLES.ACCOUNTANT] },
      // Teklifler — teklif tutarları hassas, intern hariç.
      { path: '/quotes', icon: HiOutlineDocumentText, labelKey: 'nav.quotes', roles: [ROLES.SUPER_ADMIN, ROLES.STAFF, ROLES.ACCOUNTANT] },
      { path: '/chat', icon: HiOutlineChat, labelKey: 'nav.chat', roles: [ROLES.SUPER_ADMIN, ROLES.STAFF, ROLES.SUPPORT, ROLES.INTERN], badgeKey: 'chatEscalations' },
      // Profilim ana menüden çıkarıldı → sidebar alt bilgisindeki profil kartına
      // taşındı (bkz. components/layout/Sidebar.jsx footer). Rota (/profile) aynen
      // duruyor, sadece bu menü girdisi kaldırıldı.
    ],
  },
  {
    section: 'finance',
    sectionLabelKey: 'nav.finance',
    items: [
      { path: '/invoices', icon: HiOutlineDocumentText, labelKey: 'nav.invoices', roles: [ROLES.SUPER_ADMIN, ROLES.ACCOUNTANT] },
      { path: '/invoices-v2', icon: HiOutlineBeaker, labelKey: 'nav.invoicesV2', roles: [ROLES.SUPER_ADMIN, ROLES.ACCOUNTANT] },
      { path: '/reports/spending', icon: HiOutlineChartBar, labelKey: 'nav.spendingReport', roles: [ROLES.SUPER_ADMIN, ROLES.ACCOUNTANT, ROLES.INTERN] },
    ],
  },
  {
    section: 'admin',
    sectionLabelKey: 'nav.admin',
    items: [
      // Dev Lead koşulu düz rol dizisiyle ifade edilemez — `roles` sadece
      // kaba filtre (staff, dev-lead olmasa da bu diziyi geçer), asıl karar
      // `visible()`'da (bkz. Sidebar.jsx'teki genişletilmiş filtre).
      { path: '/projects', icon: HiOutlineFolderOpen, labelKey: 'nav.projects', roles: [ROLES.SUPER_ADMIN, ROLES.STAFF], visible: canManageProjects },
      { path: '/users', icon: HiOutlineShieldCheck, labelKey: 'nav.users', roles: [ROLES.SUPER_ADMIN, ROLES.INTERN], badgeKey: 'pendingUsers' },
      { path: '/access-control', icon: HiOutlineKey, labelKey: 'nav.accessControl', roles: [ROLES.SUPER_ADMIN, ROLES.INTERN] },
      { path: '/approvals', icon: HiOutlineClipboardCheck, labelKey: 'nav.approvals', roles: [ROLES.SUPER_ADMIN, ROLES.INTERN], badgeKey: 'pendingApprovals' },
      { path: '/audit-log', icon: HiOutlineClipboardList, labelKey: 'nav.auditLog', roles: [ROLES.SUPER_ADMIN, ROLES.INTERN] },
    ],
  },
];

export const PORTAL_NAV = [
  {
    section: 'main',
    sectionLabelKey: 'nav.main',
    items: [
      { path: '/portal', icon: HiOutlineTicket, labelKey: 'nav.portalTickets', roles: null, end: true },
      // Başvuru (Lead) — destek talebinden (Taleplerim) ayrı bir eksen: satış/
      // proje başvurusu. Gönderilince admin Formlar paneline düşer.
      { path: '/portal/apply', icon: HiOutlinePencilAlt, labelKey: 'nav.portalApply', roles: null },
      { path: '/portal/chat', icon: HiOutlineChat, labelKey: 'nav.portalChat', roles: null },
      // Profilim portal menüsünden çıkarıldı → sidebar alt bilgisindeki müşteri
      // profil kartına taşındı (staff tarafıyla aynı desen, bkz. Sidebar.jsx footer).
    ],
  },
];

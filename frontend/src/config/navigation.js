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
  HiOutlineUserCircle,
  HiOutlineChat,
  HiOutlineKey,
  HiOutlineClipboardCheck,
  HiOutlineViewBoards,
} from 'react-icons/hi';
import { ROLES } from './permissions';

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
      { path: '/chat', icon: HiOutlineChat, labelKey: 'nav.chat', roles: [ROLES.SUPER_ADMIN, ROLES.STAFF, ROLES.SUPPORT, ROLES.INTERN] },
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
      { path: '/portal/chat', icon: HiOutlineChat, labelKey: 'nav.portalChat', roles: null },
      { path: '/portal/profile', icon: HiOutlineUserCircle, labelKey: 'nav.portalProfile', roles: null },
    ],
  },
];

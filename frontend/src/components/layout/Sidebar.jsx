import { useState, useEffect, Fragment } from 'react';
import { NavLink } from 'react-router-dom';
import { HiOutlineSun, HiOutlineMoon, HiOutlineX } from 'react-icons/hi';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { useSidebar } from '../../context/SidebarContext';
import { INTERNAL_NAV, PORTAL_NAV } from '../../config/navigation';
import { ROLES } from '../../config/permissions';
import userService from '../../services/userService';
import approvalService from '../../services/approvalService';

/**
 * One sidebar for the whole app — staff and customer portal alike. Which
 * nav tree renders (INTERNAL_NAV vs PORTAL_NAV, see config/navigation.js) is
 * the only thing that branches on account type; a new role or a new portal
 * page never needs a change here, only in navigation.js.
 */
const Sidebar = () => {
  const { t } = useLanguage();
  const { user, customerUser, isInternal, isCustomer } = useAuth();
  const { isOpen, close } = useSidebar();
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);

  // Super admin sees badges for accounts awaiting approval and for queued
  // override actions awaiting review — both refreshed periodically so they
  // don't go stale during a long session.
  useEffect(() => {
    if (!isInternal || user?.role !== ROLES.SUPER_ADMIN) return;
    const fetchPending = () => {
      userService.getPending().then((res) => setPendingCount(res.data.data.length)).catch(() => {});
      approvalService.getAll({ status: 'pending' }).then((res) => setPendingApprovalsCount(res.data.data.length)).catch(() => {});
    };
    fetchPending();
    const interval = setInterval(fetchPending, 60000);
    return () => clearInterval(interval);
  }, [isInternal, user?.role]);

  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const badges = { pendingUsers: pendingCount, pendingApprovals: pendingApprovalsCount };

  const navGroups = isInternal ? INTERNAL_NAV : PORTAL_NAV;
  const visibleGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.roles || (isInternal && item.roles.includes(user.role))),
    }))
    .filter((group) => group.items.length > 0);

  const brandLabel = isCustomer
    ? customerUser?.customer?.name || t('nav.portalBrandFallback')
    : 'Micro CRM';

  const renderLink = (item) => {
    const Icon = item.icon;
    const badgeValue = item.badgeKey ? badges[item.badgeKey] : 0;
    return (
      <NavLink
        key={item.path}
        to={item.path}
        end={item.end ?? item.path === '/'}
        className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
      >
        <span className="nav-icon"><Icon /></span>
        <span>{t(item.labelKey)}</span>
        {!!badgeValue && <span className="nav-badge">{badgeValue}</span>}
      </NavLink>
    );
  };

  return (
    <>
      {isOpen && <div className="sidebar-backdrop" onClick={close} />}
      <aside className={`sidebar ${isOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-logo">
          <div className="logo-icon">μ</div>
          <span>{brandLabel}</span>
          <button
            type="button"
            className="sidebar-close-btn"
            onClick={close}
            aria-label={t('nav.closeSidebar')}
            style={{ marginLeft: 'auto' }}
          >
            <HiOutlineX />
          </button>
        </div>

        <nav className="sidebar-nav">
          {visibleGroups.map((group, idx) => (
            <Fragment key={group.section}>
              <span className="sidebar-label" style={idx > 0 ? { marginTop: 'var(--space-lg)' } : undefined}>
                {t(group.sectionLabelKey)}
              </span>
              {group.items.map(renderLink)}
            </Fragment>
          ))}
        </nav>

        {/* Theme Toggle Button */}
        <div className="sidebar-footer" style={{ marginTop: 'auto', padding: 'var(--space-md)' }}>
          <button
            className="btn btn-secondary"
            onClick={toggleTheme}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {theme === 'dark' ? (
              <><HiOutlineSun className="icon" /> <span>{t('nav.lightMode')}</span></>
            ) : (
              <><HiOutlineMoon className="icon" /> <span>{t('nav.darkMode')}</span></>
            )}
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;

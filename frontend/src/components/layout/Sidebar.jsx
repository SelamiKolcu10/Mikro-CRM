import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { HiOutlineViewGrid, HiOutlineUsers, HiOutlineChatAlt2, HiOutlineDocumentText, HiOutlineBeaker, HiOutlineShieldCheck, HiOutlineChartBar, HiOutlineBookOpen, HiOutlineSun, HiOutlineMoon } from 'react-icons/hi';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { ROLES, ALL_ROLES } from '../../config/permissions';
import userService from '../../services/userService';

const Sidebar = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [pendingCount, setPendingCount] = useState(0);

  // Super admin sees a badge for accounts awaiting approval — refreshed
  // periodically so it doesn't go stale during a long session.
  useEffect(() => {
    if (user?.role !== ROLES.SUPER_ADMIN) return;
    const fetchPending = () => {
      userService.getPending().then((res) => setPendingCount(res.data.data.length)).catch(() => {});
    };
    fetchPending();
    const interval = setInterval(fetchPending, 60000);
    return () => clearInterval(interval);
  }, [user?.role]);

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

  const allMainItems = [
    { path: '/', icon: <HiOutlineViewGrid />, label: t('nav.dashboard'), roles: [ROLES.SUPER_ADMIN, ROLES.STAFF] },
    { path: '/customers', icon: <HiOutlineUsers />, label: t('nav.customers'), roles: [ROLES.SUPER_ADMIN, ROLES.ACCOUNTANT, ROLES.STAFF, ROLES.SUPPORT, ROLES.INTERN] },
    { path: '/feedbacks', icon: <HiOutlineChatAlt2 />, label: t('nav.feedbacks'), roles: [ROLES.SUPER_ADMIN, ROLES.STAFF, ROLES.SUPPORT, ROLES.INTERN] },
    { path: '/knowledge-base', icon: <HiOutlineBookOpen />, label: t('nav.knowledgeBase'), roles: ALL_ROLES },
  ];

  const allFinanceItems = [
    { path: '/invoices', icon: <HiOutlineDocumentText />, label: t('nav.invoices'), roles: [ROLES.SUPER_ADMIN, ROLES.ACCOUNTANT] },
    { path: '/invoices-v2', icon: <HiOutlineBeaker />, label: t('nav.invoicesV2'), roles: [ROLES.SUPER_ADMIN, ROLES.ACCOUNTANT] },
    { path: '/reports/spending', icon: <HiOutlineChartBar />, label: t('nav.spendingReport'), roles: [ROLES.SUPER_ADMIN, ROLES.ACCOUNTANT] },
  ];

  const allAdminItems = [
    { path: '/users', icon: <HiOutlineShieldCheck />, label: t('nav.users'), roles: [ROLES.SUPER_ADMIN], badge: pendingCount },
  ];

  const visible = (items) => items.filter((item) => !user || item.roles.includes(user.role));
  const mainItems = visible(allMainItems);
  const financeItems = visible(allFinanceItems);
  const adminItems = visible(allAdminItems);

  const renderLink = (item) => (
    <NavLink
      key={item.path}
      to={item.path}
      end={item.path === '/'}
      className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
    >
      <span className="nav-icon">{item.icon}</span>
      <span>{item.label}</span>
      {!!item.badge && <span className="nav-badge">{item.badge}</span>}
    </NavLink>
  );

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-icon">μ</div>
        <span>Micro CRM</span>
      </div>

      <nav className="sidebar-nav">
        {mainItems.length > 0 && (
          <>
            <span className="sidebar-label">{t('nav.main')}</span>
            {mainItems.map(renderLink)}
          </>
        )}

        {financeItems.length > 0 && (
          <>
            <span className="sidebar-label" style={{ marginTop: 'var(--space-lg)' }}>{t('nav.finance')}</span>
            {financeItems.map(renderLink)}
          </>
        )}

        {adminItems.length > 0 && (
          <>
            <span className="sidebar-label" style={{ marginTop: 'var(--space-lg)' }}>{t('nav.admin')}</span>
            {adminItems.map(renderLink)}
          </>
        )}
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
  );
};

export default Sidebar;


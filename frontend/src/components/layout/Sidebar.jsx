import { NavLink } from 'react-router-dom';
import { HiOutlineViewGrid, HiOutlineUsers, HiOutlineChatAlt2, HiOutlineDocumentText } from 'react-icons/hi';
import { useLanguage } from '../../context/LanguageContext';

const Sidebar = () => {
  const { t } = useLanguage();

  const mainItems = [
    { path: '/', icon: <HiOutlineViewGrid />, label: t('nav.dashboard') },
    { path: '/customers', icon: <HiOutlineUsers />, label: t('nav.customers') },
    { path: '/feedbacks', icon: <HiOutlineChatAlt2 />, label: t('nav.feedbacks') },
  ];

  const financeItems = [
    { path: '/invoices', icon: <HiOutlineDocumentText />, label: t('nav.invoices') },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-icon">μ</div>
        <span>Micro CRM</span>
      </div>

      <nav className="sidebar-nav">
        <span className="sidebar-label">{t('nav.main')}</span>
        {mainItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}

        <span className="sidebar-label" style={{ marginTop: 'var(--space-lg)' }}>{t('nav.finance')}</span>
        {financeItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;


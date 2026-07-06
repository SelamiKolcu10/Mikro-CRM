import { NavLink } from 'react-router-dom';
import { HiOutlineViewGrid, HiOutlineUsers, HiOutlineChatAlt2 } from 'react-icons/hi';
import { useLanguage } from '../../context/LanguageContext';

const Sidebar = () => {
  const { t } = useLanguage();

  const navItems = [
    { path: '/', icon: <HiOutlineViewGrid />, label: t('nav.dashboard') },
    { path: '/customers', icon: <HiOutlineUsers />, label: t('nav.customers') },
    { path: '/feedbacks', icon: <HiOutlineChatAlt2 />, label: t('nav.feedbacks') },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-icon">μ</div>
        <span>Micro CRM</span>
      </div>

      <nav className="sidebar-nav">
        <span className="sidebar-label">{t('nav.main')}</span>
        {navItems.map((item) => (
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
      </nav>
    </aside>
  );
};

export default Sidebar;

import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { HiOutlineViewGrid, HiOutlineUsers, HiOutlineChatAlt2, HiOutlineDocumentText, HiOutlineBeaker, HiOutlineSun, HiOutlineMoon } from 'react-icons/hi';
import { useLanguage } from '../../context/LanguageContext';

const Sidebar = () => {
  const { t } = useLanguage();
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');

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

  const mainItems = [
    { path: '/', icon: <HiOutlineViewGrid />, label: t('nav.dashboard') },
    { path: '/customers', icon: <HiOutlineUsers />, label: t('nav.customers') },
    { path: '/feedbacks', icon: <HiOutlineChatAlt2 />, label: t('nav.feedbacks') },
  ];

  const financeItems = [
    { path: '/invoices', icon: <HiOutlineDocumentText />, label: t('nav.invoices') },
    { path: '/invoices-v2', icon: <HiOutlineBeaker />, label: t('nav.invoicesV2') },
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


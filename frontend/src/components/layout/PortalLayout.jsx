import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { HiOutlineLogout } from 'react-icons/hi';

const PortalLayout = () => {
  const { customerUser, logout } = useAuth();

  return (
    <div className="app-layout">
      <main className="main-content" style={{ marginLeft: 0, width: '100%' }}>
        <nav className="navbar" style={{ left: 0 }}>
          <div className="navbar-left" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-lg)' }}>
            <div className="sidebar-logo" style={{ padding: 0 }}>
              <div className="logo-icon">μ</div>
              <span>{customerUser?.customer?.name || 'Müşteri Portalı'}</span>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
              <NavLink to="/portal" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <span>Taleplerim</span>
              </NavLink>
              <NavLink to="/portal/profile" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <span>Profilim</span>
              </NavLink>
            </div>
          </div>
          <div className="navbar-right">
            <button className="btn-icon" onClick={logout} title="Çıkış Yap">
              <HiOutlineLogout />
            </button>
          </div>
        </nav>
        <div className="page-container">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default PortalLayout;

import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

// Same shell as the staff app's Layout.jsx — Sidebar/Navbar branch on
// accountType internally (see config/navigation.js), so this file has
// nothing portal-specific left to say.
const PortalLayout = () => {
  return (
    <div className="app-layout">
      <Sidebar />
      <Navbar />
      <main className="main-content">
        <div className="page-container">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default PortalLayout;

import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import { SidebarProvider } from '../../context/SidebarContext';

// Same shell as the staff app's Layout.jsx — Sidebar/Navbar branch on
// accountType internally (see config/navigation.js), so this file has
// nothing portal-specific left to say.
const PortalLayout = () => {
  return (
    <SidebarProvider>
      <div className="app-layout">
        <Sidebar />
        <Navbar />
        <main className="main-content">
          <div className="page-container">
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default PortalLayout;

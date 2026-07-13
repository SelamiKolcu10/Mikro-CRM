import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import ReadOnlyBanner from './ReadOnlyBanner';
import { SidebarProvider } from '../../context/SidebarContext';

const Layout = () => {
  return (
    <SidebarProvider>
      <div className="app-layout">
        <Sidebar />
        <Navbar />
        <main className="main-content">
          <ReadOnlyBanner />
          <div className="page-container">
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default Layout;

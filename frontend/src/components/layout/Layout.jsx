import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import ReadOnlyBanner from './ReadOnlyBanner';
import EscalationBanner from './EscalationBanner';
import { SidebarProvider } from '../../context/SidebarContext';

const Layout = () => {
  // Route değişince key değişir → .page-enter animasyonu yeniden tetiklenir
  // (tasarım.md §7 — sayfa geçişi; prefers-reduced-motion CSS'te kapatır).
  const location = useLocation();
  return (
    <SidebarProvider>
      <div className="app-layout">
        <Sidebar />
        <Navbar />
        <main className="main-content">
          <ReadOnlyBanner />
          <EscalationBanner />
          <div className="page-container page-enter" key={location.pathname}>
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default Layout;

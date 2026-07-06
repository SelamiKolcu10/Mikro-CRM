import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

const Layout = () => {
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

export default Layout;

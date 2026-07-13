import { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const SidebarContext = createContext();

/**
 * Mobile drawer open/close state for the Sidebar. Sidebar and Navbar are
 * rendered as siblings under Layout/PortalLayout (not parent-child), so the
 * hamburger button (Navbar) and the drawer it controls (Sidebar) need a
 * shared place to coordinate — this is it. Irrelevant above the 768px
 * breakpoint, where the sidebar is always visible regardless of this state.
 */
export const SidebarProvider = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  // Close the drawer on navigation — otherwise it stays open over the new
  // page after tapping a link.
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  return (
    <SidebarContext.Provider
      value={{
        isOpen,
        open: () => setIsOpen(true),
        close: () => setIsOpen(false),
        toggle: () => setIsOpen((prev) => !prev),
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
};

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
};

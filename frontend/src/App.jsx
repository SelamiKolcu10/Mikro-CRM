import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { DEFAULT_ROUTE_BY_ROLE } from './config/permissions';
import Layout from './components/layout/Layout';
import PortalLayout from './components/layout/PortalLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Feedbacks from './pages/Feedbacks';
import Invoices from './pages/Invoices';
import InvoicesV2 from './pages/InvoicesV2';
import UserManagement from './pages/UserManagement';
import SpendingDashboard from './pages/SpendingDashboard';
import KnowledgeBase from './pages/KnowledgeBase';
import PortalTickets from './pages/portal/PortalTickets';
import PortalProfile from './pages/portal/PortalProfile';
import RoleGuard from './components/auth/RoleGuard';
import { ROLES } from './config/permissions';

const Spinner = () => (
  <div className="loading-spinner" style={{ minHeight: '100vh' }}>
    <div className="spinner" />
  </div>
);

// Single login for everyone — this just gates on "is there any session at all".
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <Spinner />;
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

// If already logged in, skip the login form and land on the right panel for
// whichever account type the session is.
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading, isCustomer, session } = useAuth();
  if (loading) return <Spinner />;
  if (!isAuthenticated) return children;
  return <Navigate to={isCustomer ? '/portal' : (DEFAULT_ROUTE_BY_ROLE[session.role] || '/')} replace />;
};

// A customer session must never render the staff app — bounce to the portal.
const InternalOnlyRoute = ({ children }) => {
  const { isCustomer } = useAuth();
  return isCustomer ? <Navigate to="/portal" replace /> : children;
};

// A staff session must never render the customer portal — bounce to their role's page.
const CustomerOnlyRoute = ({ children }) => {
  const { isInternal, session } = useAuth();
  return isInternal ? <Navigate to={DEFAULT_ROUTE_BY_ROLE[session.role] || '/'} replace /> : children;
};

const App = () => {
  return (
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter>
          <Toaster
            position="top-right"
            toastOptions={{
              className: 'toast-custom',
              duration: 3000,
            }}
          />
          <Routes>
            {/* Public */}
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <Login />
                </PublicRoute>
              }
            />

            {/* Customer Portal — same login, same session, different panel */}
            <Route
              element={
                <ProtectedRoute>
                  <CustomerOnlyRoute>
                    <PortalLayout />
                  </CustomerOnlyRoute>
                </ProtectedRoute>
              }
            >
              <Route path="/portal" element={<PortalTickets />} />
              <Route path="/portal/profile" element={<PortalProfile />} />
            </Route>

            {/* Staff app */}
            <Route
              element={
                <ProtectedRoute>
                  <InternalOnlyRoute>
                    <Layout />
                  </InternalOnlyRoute>
                </ProtectedRoute>
              }
            >
              <Route path="/" element={
                <RoleGuard allow={[ROLES.SUPER_ADMIN, ROLES.STAFF]}><Dashboard /></RoleGuard>
              } />
              <Route path="/customers" element={
                <RoleGuard allow={[ROLES.SUPER_ADMIN, ROLES.ACCOUNTANT, ROLES.STAFF, ROLES.SUPPORT, ROLES.INTERN]}><Customers /></RoleGuard>
              } />
              <Route path="/feedbacks" element={
                <RoleGuard allow={[ROLES.SUPER_ADMIN, ROLES.STAFF, ROLES.SUPPORT, ROLES.INTERN]}><Feedbacks /></RoleGuard>
              } />
              <Route path="/invoices" element={
                <RoleGuard allow={[ROLES.SUPER_ADMIN, ROLES.ACCOUNTANT]}><Invoices /></RoleGuard>
              } />
              <Route path="/invoices-v2" element={
                <RoleGuard allow={[ROLES.SUPER_ADMIN, ROLES.ACCOUNTANT]}><InvoicesV2 /></RoleGuard>
              } />
              <Route path="/reports/spending" element={
                <RoleGuard allow={[ROLES.SUPER_ADMIN, ROLES.ACCOUNTANT]}><SpendingDashboard /></RoleGuard>
              } />
              <Route path="/knowledge-base" element={<KnowledgeBase />} />
              <Route path="/users" element={
                <RoleGuard allow={[ROLES.SUPER_ADMIN]}><UserManagement /></RoleGuard>
              } />
            </Route>

            {/* Catch all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  );
};

export default App;

import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { DEFAULT_ROUTE_BY_ROLE } from '../../config/permissions';

/**
 * Route-seviyesi rol koruması. Kullanıcının rolü `allow` listesinde değilse,
 * kendi rolünün varsayılan sayfasına yönlendirir (sabit "/" değil — aksi
 * halde "/" da kısıtlıysa sonsuz yönlendirme döngüsü oluşur). Bu sadece UX
 * içindir — gerçek yetki her zaman backend'de zorlanır.
 */
const RoleGuard = ({ allow, children }) => {
  const { user, hasRole } = useAuth();

  if (!hasRole(...allow)) {
    const fallback = DEFAULT_ROUTE_BY_ROLE[user?.role] || '/customers';
    return <Navigate to={fallback} replace />;
  }

  return children;
};

export default RoleGuard;

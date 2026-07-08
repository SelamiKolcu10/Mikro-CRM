import { useAuth } from '../../context/AuthContext';
import { can } from '../../config/permissions';

/**
 * Eleman-seviyesi izin kontrolü — bir butonu/aksiyonu gizlemek için.
 * Örnek: <PermissionGate resource="customers" action="write"><button>Sil</button></PermissionGate>
 */
const PermissionGate = ({ resource, action = 'read', children }) => {
  const { user } = useAuth();

  if (!user || !can(user.role, resource, action)) {
    return null;
  }

  return children;
};

export default PermissionGate;

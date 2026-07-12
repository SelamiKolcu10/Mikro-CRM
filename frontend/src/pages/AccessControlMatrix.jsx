import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import userService from '../services/userService';
import permissionOverrideService from '../services/permissionOverrideService';
import Modal from '../components/common/Modal';
import toast from 'react-hot-toast';
import { ROLES, ROLE_LABELS, OVERRIDABLE_RESOURCES, can } from '../config/permissions';

const RESOURCE_LABEL_KEYS = {
  customers: 'accessControl.resourceCustomers',
  feedbacks: 'accessControl.resourceFeedbacks',
};

const ACTIONS = ['write', 'delete'];

// Mirrors the `staticRoles` each authorizeOrQueue call site actually uses
// (see backend/routes/{customer,feedback}Routes.js) — a checkbox shows
// disabled+checked when the role already has this natively, nothing to
// grant/revoke.
const STATIC_GRANT = {
  customers: {
    write: [ROLES.SUPER_ADMIN, ROLES.STAFF],
    delete: [ROLES.SUPER_ADMIN, ROLES.STAFF],
  },
  feedbacks: {
    write: [ROLES.SUPER_ADMIN, ROLES.STAFF],
    delete: [ROLES.SUPER_ADMIN, ROLES.STAFF],
  },
};

const AccessControlMatrix = () => {
  const { t } = useLanguage();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [overrides, setOverrides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rationaleModal, setRationaleModal] = useState(null); // { userId, resource, action, userName }
  const [rationale, setRationale] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [usersRes, overridesRes] = await Promise.all([
        userService.getAll({ status: 'approved' }),
        permissionOverrideService.getAll(),
      ]);
      setUsers(usersRes.data.data.filter((u) => u.role !== ROLES.SUPER_ADMIN));
      setOverrides(overridesRes.data.data);
    } catch (err) {
      toast.error(t('common.loadError'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const findOverride = (userId, resource, action) =>
    overrides.find((o) => o.user?._id === userId && o.resource === resource && o.action === action);

  const hasStaticGrant = (role, resource, action) => STATIC_GRANT[resource]?.[action]?.includes(role);

  const handleToggle = async (user, resource, action) => {
    const existing = findOverride(user._id, resource, action);
    if (existing) {
      try {
        await permissionOverrideService.revoke(existing._id);
        setOverrides((prev) => prev.filter((o) => o._id !== existing._id));
        toast.success(t('accessControl.revokeSuccess'));
      } catch (err) {
        toast.error(err.response?.data?.error || t('common.error'));
      }
      return;
    }

    setRationale('');
    setRationaleModal({ userId: user._id, resource, action, userName: user.name });
  };

  const confirmGrant = async () => {
    if (!rationaleModal) return;
    setSaving(true);
    try {
      const res = await permissionOverrideService.grant(
        rationaleModal.userId,
        rationaleModal.resource,
        rationaleModal.action,
        rationale
      );
      setOverrides((prev) => [...prev.filter((o) => o._id !== res.data.data._id), res.data.data]);
      toast.success(t('accessControl.grantSuccess'));
      setRationaleModal(null);
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="loading-spinner"><div className="spinner" /></div>;
  }

  const columnCount = 1 + OVERRIDABLE_RESOURCES.length * ACTIONS.length;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>🔐 {t('accessControl.title')}</h1>
          <p>{t('accessControl.subtitle')}</p>
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>{t('accessControl.user')}</th>
              {OVERRIDABLE_RESOURCES.map((resource) =>
                ACTIONS.map((action) => (
                  <th key={`${resource}-${action}`} style={{ textAlign: 'center' }}>
                    {t(RESOURCE_LABEL_KEYS[resource])}
                    <br />
                    <span style={{ fontWeight: 400, fontSize: '11px', color: 'var(--text-tertiary)' }}>
                      {t(`accessControl.action${action === 'write' ? 'Write' : 'Delete'}`)}
                    </span>
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={columnCount}>
                  <div className="table-empty">
                    <p>{t('accessControl.noEligibleUsers')}</p>
                  </div>
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u._id}>
                  <td>
                    <div className="cell-name">{u.name}</div>
                    <div className="cell-email">{u.email} — {t(ROLE_LABELS[u.role])}</div>
                  </td>
                  {OVERRIDABLE_RESOURCES.map((resource) =>
                    ACTIONS.map((action) => {
                      const staticGrant = hasStaticGrant(u.role, resource, action);
                      const override = findOverride(u._id, resource, action);
                      return (
                        <td key={`${resource}-${action}`} style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={!!(staticGrant || override)}
                            disabled={staticGrant || !can(currentUser.role, 'permissionOverrides', 'write')}
                            title={staticGrant ? t('accessControl.grantedByRole') : (override?.rationale || '')}
                            onChange={() => handleToggle(u, resource, action)}
                          />
                        </td>
                      );
                    })
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={!!rationaleModal}
        onClose={() => setRationaleModal(null)}
        title={`${t('accessControl.grantOverride')} — ${rationaleModal?.userName || ''}`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setRationaleModal(null)}>
              {t('common.cancel')}
            </button>
            <button className="btn btn-primary" onClick={confirmGrant} disabled={saving}>
              {saving ? t('common.loading') : t('accessControl.grantOverride')}
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">{t('accessControl.rationalePrompt')}</label>
          <textarea
            className="form-input"
            rows={3}
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            placeholder={t('accessControl.rationalePlaceholder')}
          />
        </div>
      </Modal>
    </>
  );
};

export default AccessControlMatrix;

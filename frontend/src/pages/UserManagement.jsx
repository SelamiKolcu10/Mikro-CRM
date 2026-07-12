import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import userService from '../services/userService';
import ConfirmDialog from '../components/common/ConfirmDialog';
import Modal from '../components/common/Modal';
import toast from 'react-hot-toast';
import { HiOutlineCheck, HiOutlineX, HiOutlineTrash, HiOutlinePlus } from 'react-icons/hi';
import { ALL_ROLES, ROLE_LABELS, DEPARTMENTS, DEPARTMENT_LABELS, can } from '../config/permissions';
import PermissionGate from '../components/auth/PermissionGate';

const STATUS_COLORS = {
  pending: 'var(--color-info)',
  approved: 'var(--color-success)',
  rejected: 'var(--color-danger)',
};

const initialCreateForm = { name: '', email: '', role: 'staff' };

const UserManagement = () => {
  const { t } = useLanguage();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [deleteId, setDeleteId] = useState(null);

  // Create user modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState(initialCreateForm);
  const [creating, setCreating] = useState(false);

  // Result modal — shows the generated temp password once
  const [createResult, setCreateResult] = useState(null);

  const fetchUsers = useCallback(async () => {
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      const res = await userService.getAll(params);
      setUsers(res.data.data);
    } catch (err) {
      toast.error(t('common.loadError'));
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleApprove = async (id) => {
    try {
      await userService.approve(id);
      toast.success(t('users.approved'));
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.error'));
    }
  };

  const handleReject = async (id) => {
    try {
      await userService.reject(id);
      toast.success(t('users.rejected'));
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.error'));
    }
  };

  const handleRoleChange = async (id, role) => {
    try {
      await userService.updateRole(id, role);
      toast.success(t('common.update') + ' ✅');
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.error'));
    }
  };

  const handleDepartmentChange = async (id, department) => {
    try {
      await userService.updateDepartment(id, { department: department || null });
      toast.success(t('common.update') + ' ✅');
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.error'));
    }
  };

  const handleLeadToggle = async (id, isDepartmentLead) => {
    try {
      await userService.updateDepartment(id, { isDepartmentLead });
      toast.success(t('common.update') + ' ✅');
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.error'));
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await userService.delete(deleteId);
      toast.success(t('common.delete') + ' ✅');
      setDeleteId(null);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.error'));
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await userService.create(createForm);
      setCreateModalOpen(false);
      setCreateForm(initialCreateForm);
      setCreateResult(res.data.data);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.error'));
    } finally {
      setCreating(false);
    }
  };

  const pendingCount = users.filter((u) => u.status === 'pending').length;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>🛡️ {t('users.title')}</h1>
          <p>{t('users.subtitle')}</p>
        </div>
        <PermissionGate resource="users" action="write">
          <button className="btn btn-primary" onClick={() => setCreateModalOpen(true)}>
            <HiOutlinePlus /> {t('users.createUser')}
          </button>
        </PermissionGate>
      </div>

      <div className="table-container">
        <div className="table-header">
          <div className="filter-group">
            <select
              className="form-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">{t('users.allStatuses')}</option>
              <option value="pending">{t('users.statuses.pending')} {pendingCount > 0 && statusFilter === '' ? `(${pendingCount})` : ''}</option>
              <option value="approved">{t('users.statuses.approved')}</option>
              <option value="rejected">{t('users.statuses.rejected')}</option>
            </select>
          </div>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('auth.name')}</th>
                <th>{t('auth.email')}</th>
                <th>{t('users.role')}</th>
                <th>{t('users.department')}</th>
                <th>{t('users.isDepartmentLead')}</th>
                <th>{t('users.status')}</th>
                <th className="text-right">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7}>{t('common.loading')}</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={7}>{t('common.noData')}</td></tr>
              ) : (
                users.map((u) => (
                  <tr key={u._id}>
                    <td>{u.name}</td>
                    <td>{u.email}</td>
                    <td>
                      {can(currentUser.role, 'users', 'write') ? (
                        <select
                          className="form-select compact"
                          value={u.role}
                          disabled={u._id === currentUser._id}
                          onChange={(e) => handleRoleChange(u._id, e.target.value)}
                        >
                          {ALL_ROLES.map((role) => (
                            <option key={role} value={role}>{t(ROLE_LABELS[role])}</option>
                          ))}
                        </select>
                      ) : (
                        <span>{t(ROLE_LABELS[u.role])}</span>
                      )}
                    </td>
                    <td>
                      {can(currentUser.role, 'users', 'write') ? (
                        <select
                          className="form-select compact"
                          value={u.department || ''}
                          onChange={(e) => handleDepartmentChange(u._id, e.target.value)}
                        >
                          <option value="">{t('departments.none')}</option>
                          {DEPARTMENTS.map((dept) => (
                            <option key={dept} value={dept}>{t(DEPARTMENT_LABELS[dept])}</option>
                          ))}
                        </select>
                      ) : (
                        <span>{u.department ? t(DEPARTMENT_LABELS[u.department]) : t('departments.none')}</span>
                      )}
                    </td>
                    <td>
                      {can(currentUser.role, 'users', 'write') ? (
                        <input
                          type="checkbox"
                          checked={!!u.isDepartmentLead}
                          onChange={(e) => handleLeadToggle(u._id, e.target.checked)}
                        />
                      ) : (
                        <span>{u.isDepartmentLead ? '✓' : '—'}</span>
                      )}
                    </td>
                    <td>
                      <span className="status-badge" style={{ color: STATUS_COLORS[u.status] }}>
                        ● {t(`users.statuses.${u.status}`)}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="action-buttons">
                        {u.status === 'pending' && (
                          <PermissionGate resource="users" action="approve">
                            <button className="btn-icon" title={t('users.approve')} onClick={() => handleApprove(u._id)}>
                              <HiOutlineCheck style={{ color: 'var(--color-success)' }} />
                            </button>
                            <button className="btn-icon" title={t('users.reject')} onClick={() => handleReject(u._id)}>
                              <HiOutlineX style={{ color: 'var(--color-danger)' }} />
                            </button>
                          </PermissionGate>
                        )}
                        {u._id !== currentUser._id && (
                          <PermissionGate resource="users" action="write">
                            <button className="btn-icon" title={t('common.delete')} onClick={() => setDeleteId(u._id)}>
                              <HiOutlineTrash />
                            </button>
                          </PermissionGate>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title={t('users.deleteConfirm')}
        message={t('users.deleteWarning')}
      />

      {/* Create User Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title={<>👤 {t('users.createUser')}</>}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setCreateModalOpen(false)}>
              {t('common.cancel')}
            </button>
            <button className="btn btn-primary" onClick={handleCreateSubmit} disabled={creating}>
              {creating ? t('common.loading') : t('common.create')}
            </button>
          </>
        }
      >
        <form onSubmit={handleCreateSubmit}>
          <div className="form-group">
            <label className="form-label">{t('auth.name')} *</label>
            <input
              type="text"
              className="form-input"
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label">{t('auth.email')} *</label>
            <input
              type="email"
              className="form-input"
              value={createForm.email}
              onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">{t('users.role')} *</label>
            <select
              className="form-select"
              value={createForm.role}
              onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
            >
              {ALL_ROLES.filter((r) => r !== 'super_admin').map((role) => (
                <option key={role} value={role}>{ROLE_LABELS[role]}</option>
              ))}
            </select>
          </div>
          <span className="form-hint">💡 {t('users.createUserHint')}</span>
        </form>
      </Modal>

      {/* Result — temp password shown once */}
      <Modal
        isOpen={!!createResult}
        onClose={() => setCreateResult(null)}
        title={<>🔑 {t('users.userCreated')}</>}
        footer={
          <button className="btn btn-primary" onClick={() => setCreateResult(null)}>
            {t('common.close')}
          </button>
        }
      >
        {createResult && (
          <div>
            <p>{createResult.name} ({t(ROLE_LABELS[createResult.role])}) {t('users.userCreatedHint')}</p>
            <div className="form-group">
              <label className="form-label">{t('auth.email')}</label>
              <input type="text" className="form-input" value={createResult.email} readOnly />
            </div>
            <div className="form-group">
              <label className="form-label">{t('customers.temporaryPassword')}</label>
              <input type="text" className="form-input" value={createResult.temporaryPassword} readOnly />
            </div>
            <span className="form-hint">⚠️ {t('customers.portalAccessWarning')}</span>
          </div>
        )}
      </Modal>
    </>
  );
};

export default UserManagement;

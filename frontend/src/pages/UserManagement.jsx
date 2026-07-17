import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import userService from '../services/userService';
import projectService from '../services/projectService';
import toast from 'react-hot-toast';
import { HiOutlinePlus } from 'react-icons/hi';
import { DEPARTMENTS, DEPARTMENT_LABELS, can } from '../config/permissions';
import PermissionGate from '../components/auth/PermissionGate';
import EmployeeCard from '../components/users/EmployeeCard';
import EmployeePanel from '../components/users/EmployeePanel';
import EmployeeAvatar from '../components/users/EmployeeAvatar';
import ContributionRing from '../components/users/ContributionRing';
import CreateUserModal from '../components/users/CreateUserModal';

/**
 * Eski tablo tabanlı Kullanıcı Yönetimi'nin yerini alan kart tabanlı Çalışan
 * Dizini. Rol/departman/lider atama, onay/red ve silme artık ayrı satır
 * kontrolleri değil, karta tıklayınca açılan EmployeePanel'in "Yönetim"
 * bölümünde toplanıyor (bkz. design mockup). "Projeler" sekmesi ise aynı
 * veriyi proje-merkezli, yoğun bir görünümde sunuyor.
 */
const UserManagement = () => {
  const { t } = useLanguage();
  const { user: currentUser } = useAuth();
  const isAdmin = can(currentUser.role, 'users', 'write');

  const [tab, setTab] = useState('directory');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [leadsOnly, setLeadsOnly] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);

  const [projectsOverview, setProjectsOverview] = useState(null);
  const [projectsLoading, setProjectsLoading] = useState(false);

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

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const fetchProjectsOverview = useCallback(() => {
    setProjectsLoading(true);
    projectService.getContributionsOverview()
      .then((res) => setProjectsOverview(res.data.data))
      .catch(() => { setProjectsOverview([]); toast.error(t('common.loadError')); })
      .finally(() => setProjectsLoading(false));
  }, []);

  useEffect(() => {
    if (tab === 'projects' && isAdmin) fetchProjectsOverview();
    if (tab !== 'directory') setSelectedId(null);
  }, [tab, isAdmin, fetchProjectsOverview]);

  const visibleUsers = users.filter(
    (u) => (!deptFilter || u.department === deptFilter) && (!leadsOnly || u.isDepartmentLead)
  );
  const filtered = !!(deptFilter || leadsOnly);
  const selectedEmployee = users.find((u) => u._id === selectedId) || null;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>🛡️ {t('users.title')}</h1>
          <p>{t('users.subtitle')}</p>
        </div>
        <PermissionGate resource="users" action="write">
          <button className="btn btn-primary" onClick={() => setCreateOpen(true)}>
            <HiOutlinePlus /> {t('users.createUser')}
          </button>
        </PermissionGate>
      </div>

      {isAdmin && (
        <div className="tabs">
          <button type="button" className={`tab${tab === 'directory' ? ' active' : ''}`} onClick={() => setTab('directory')}>
            <span className="tab-label">{t('users.directory.tabs.directory')}</span>
          </button>
          <button type="button" className={`tab${tab === 'projects' ? ' active' : ''}`} onClick={() => setTab('projects')}>
            <span className="tab-label">{t('users.directory.tabs.projects')}</span>
          </button>
        </div>
      )}

      {tab === 'directory' || !isAdmin ? (
        <>
          <div className="filter-bar">
            <select className="form-select compact" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">{t('users.allStatuses')}</option>
              <option value="pending">{t('users.statuses.pending')}</option>
              <option value="approved">{t('users.statuses.approved')}</option>
              <option value="rejected">{t('users.statuses.rejected')}</option>
            </select>
            <span className="filter-sep" aria-hidden="true" />
            <span className="filter-label">{t('users.directory.filterDepartment')}</span>
            <button type="button" className={`chip${!deptFilter ? ' active' : ''}`} onClick={() => setDeptFilter('')}>{t('users.directory.all')}</button>
            {DEPARTMENTS.map((d) => (
              <button key={d} type="button" className={`chip${deptFilter === d ? ' active' : ''}`} onClick={() => setDeptFilter(d)}>
                {t(DEPARTMENT_LABELS[d])}
              </button>
            ))}
            <span className="filter-sep" aria-hidden="true" />
            <button type="button" className={`chip${leadsOnly ? ' active' : ''}`} onClick={() => setLeadsOnly((v) => !v)}>
              {t('users.directory.onlyLeads')}
            </button>
          </div>

          <div className="header-meta" style={{ marginBottom: 'var(--space-md)' }}>
            <span className="count-pill">
              <strong>{filtered ? `${visibleUsers.length} / ${users.length}` : users.length}</strong>&nbsp;{t('users.directory.employeeCount')}
            </span>
          </div>

          <main className="grid" aria-label={t('users.title')}>
            {loading ? (
              <p className="empty-note">{t('common.loading')}</p>
            ) : visibleUsers.length === 0 ? (
              <p className="empty-note">{t('users.directory.noMatch')}</p>
            ) : (
              visibleUsers.map((u) => <EmployeeCard key={u._id} user={u} onClick={() => setSelectedId(u._id)} />)
            )}
          </main>
        </>
      ) : (
        <>
          <p className="subtitle" style={{ marginBottom: 'var(--space-lg)' }}>{t('users.projectsView.subtitle')}</p>
          {projectsLoading ? (
            <p className="empty-note">{t('common.loading')}</p>
          ) : !projectsOverview || projectsOverview.length === 0 ? (
            <p className="empty-note">{t('users.projectsView.empty')}</p>
          ) : (
            projectsOverview.map((project) => (
              <section key={project._id} className="project-block">
                <div className="project-head">
                  <h2 className="acc-project">
                    {project.name}
                    {project.projectLead && <span className="pill pill--accent" style={{ marginLeft: 8 }}>{t('users.directory.leadBadge')}: {project.projectLead.name}</span>}
                  </h2>
                  <span className="count-pill"><strong>{project.totalDone}</strong>&nbsp;{t('users.projectsView.completedTasks')}</span>
                </div>
                <div className="member-list">
                  {project.members.map((m) => (
                    <div
                      key={m.user._id}
                      className="member-row"
                      role="button"
                      tabIndex={0}
                      onClick={() => { setTab('directory'); setSelectedId(m.user._id); }}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setTab('directory'); setSelectedId(m.user._id); } }}
                    >
                      <EmployeeAvatar user={m.user} size="sm" />
                      <div className="member-id">
                        <div className="member-name">
                          {m.user.name}
                          {m.isLead && <span className="pill pill--accent" style={{ marginLeft: 6 }}>{t('users.directory.leadBadge')}</span>}
                        </div>
                        <div className="dept">{m.user.department ? t(DEPARTMENT_LABELS[m.user.department]) : t('departments.none')}</div>
                      </div>
                      <div className="acc-contrib">
                        <div className="contrib-frac">
                          <div className="frac-num">{m.userDone} / {project.totalDone}</div>
                          <div className="frac-label">{t('users.tree.completedOf')}</div>
                        </div>
                        <ContributionRing userDone={m.userDone} totalDone={project.totalDone} size={40} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))
          )}
        </>
      )}

      <EmployeePanel
        employee={selectedEmployee}
        isAdmin={isAdmin}
        onClose={() => setSelectedId(null)}
        onChanged={() => { fetchUsers(); if (projectsOverview) fetchProjectsOverview(); }}
      />

      <CreateUserModal isOpen={createOpen} onClose={() => setCreateOpen(false)} onCreated={fetchUsers} />
    </>
  );
};

export default UserManagement;

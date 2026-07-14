import { useState, useEffect, useCallback } from 'react';
import Modal from '../common/Modal';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { DEPARTMENTS, DEPARTMENT_LABELS, ROLES } from '../../config/permissions';
import { canManageProjects } from '../../utils/projectScope';
import { useProjects } from '../../hooks/useProjects';
import toast from 'react-hot-toast';

const initialForm = { title: '', description: '', department: '', priority: 'medium', deadline: '', assignedTo: '', projectId: '' };

/**
 * İki modda çalışır:
 *  - Normal (Tasks sayfası): department serbest seçilir (super_admin) ya da
 *    kullanıcının kendi departmanına kilitlenir; atanabilir kişi listesi
 *    `/tasks/assignable-users` API'sinden gelir; proje seçici opsiyonel.
 *  - Proje bağlamlı (`project` prop'u verilirse, bkz. ProjectDrawer "+ Görev
 *    Ekle"): projectId sabittir (gösterilmez), atanabilir kişiler AYRI bir
 *    API çağrısı yapılmadan doğrudan `project.teamMembers`'tan türetilir —
 *    "sadece bu projenin ekibi" garantisi böyle sağlanır. Departman seçimi
 *    de ekipte temsil edilen VE kullanıcının oluşturma yetkisi olduğu
 *    departmanlarla sınırlanır; hiç yoksa formu devre dışı bırakıp bunu
 *    açıkça söyler (sessizce başarısız olmak yerine).
 */
const CreateTaskModal = ({ isOpen, onClose, onCreate, getAssignableUsers, project }) => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === ROLES.SUPER_ADMIN;
  const isProjectScoped = !!project;
  const showProjectField = !isProjectScoped && canManageProjects(user);
  // Proje listesi sadece seçici görünürken çekilir — canManageProjects
  // olmayan kullanıcı zaten /api/projects'e erişemez (bkz. utils/projectScope.js).
  const { projects } = useProjects({ enabled: showProjectField });

  const [form, setForm] = useState(initialForm);
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const authorizedDepartments = isSuperAdmin ? DEPARTMENTS : user?.isDepartmentLead && user?.department ? [user.department] : [];

  // Proje bağlamında: ekipte temsil edilen VE kullanıcının yetkili olduğu
  // departmanların kesişimi. Boşsa formda açıkça gösterilir (bkz. JSX).
  const teamDepartments = isProjectScoped
    ? [...new Set(project.teamMembers.map((m) => m.department).filter(Boolean))]
    : [];
  const availableDepartments = isProjectScoped
    ? authorizedDepartments.filter((d) => teamDepartments.includes(d))
    : DEPARTMENTS;

  const projectAssignableUsers = isProjectScoped
    ? project.teamMembers.filter((m) => m.department === form.department)
    : [];

  const loadAssignableUsers = useCallback((department) => {
    if (!department) {
      setAssignableUsers([]);
      return;
    }
    getAssignableUsers(department)
      .then(setAssignableUsers)
      .catch(() => {
        setAssignableUsers([]);
        toast.error(t('common.error'));
      });
  }, [getAssignableUsers, t]);

  // Modal (Modal.jsx içinde !isOpen olduğunda sadece null dönüyor,
  // component hiç unmount olmuyor) her açıldığında formu sıfırlar ve
  // ilgili departmanın üyelerini BURADA doğrudan çeker. Bu fetch'i
  // aşağıdaki [form.department]'a bağlı effect'e bırakmıyoruz çünkü
  // departman lideri için department her açılışta AYNI string —
  // dependency değişmediği için o effect ikinci açılıştan itibaren hiç
  // çalışmaz ve assignableUsers boş kalırdı (kritik bug).
  useEffect(() => {
    if (!isOpen) return;
    if (isProjectScoped) {
      const department = availableDepartments.length === 1 ? availableDepartments[0] : '';
      setForm({ ...initialForm, department, projectId: project._id });
      return;
    }
    const department = isSuperAdmin ? '' : user?.department || '';
    setForm({ ...initialForm, department });
    loadAssignableUsers(department);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isSuperAdmin, user?.department, loadAssignableUsers, isProjectScoped, project?._id]);

  // super_admin modal açıkken departmanı formdan değiştirdiğinde de
  // yeniden çekilsin. Bilerek isOpen dependency'sine dahil edilmedi:
  // reset effect'i zaten kendi fetch'ini yukarıda yapıyor; isOpen'ı
  // buraya eklemek modal her açıldığında (department değeri aynı kalsa
  // bile) stale/eski değerle gereksiz bir fetch'in tetiklenmesine yol
  // açar. Bu effect sadece form.department GERÇEKTEN değiştiğinde
  // (kullanıcı dropdown'dan seçim yaptığında) çalışmalı. Proje bağlamında
  // hiç API çağrısı yapılmaz (assignee listesi team'den türetilir).
  useEffect(() => {
    if (!isOpen || !isSuperAdmin || isProjectScoped) return;
    loadAssignableUsers(form.department);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.department]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onCreate({
        ...form,
        deadline: form.deadline || null,
        description: form.description || undefined,
        projectId: form.projectId || undefined,
      });
      toast.success(t('tasks.createSuccess'));
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  const visibleAssignableUsers = isProjectScoped ? projectAssignableUsers : assignableUsers;
  const noEligibleDepartment = isProjectScoped && availableDepartments.length === 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('tasks.createTitle')}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
          <button type="submit" form="create-task-form" className="btn btn-primary" disabled={submitting || noEligibleDepartment}>
            {t('common.save')}
          </button>
        </>
      }
    >
      {noEligibleDepartment ? (
        <p className="form-hint">{t('tasks.form.noEligibleDepartment')}</p>
      ) : (
        <form id="create-task-form" onSubmit={handleSubmit}>
          {isProjectScoped && (
            <div className="form-group">
              <label className="form-label">{t('tasks.form.project')}</label>
              <input className="form-input" value={project.name} disabled />
            </div>
          )}
          <div className="form-group">
            <label className="form-label">{t('tasks.form.title')} *</label>
            <input
              className="form-input"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              minLength={2}
              maxLength={150}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">{t('tasks.form.description')}</label>
            <textarea
              className="form-input"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              maxLength={2000}
            />
          </div>
          <div className="form-group">
            <label className="form-label">{t('tasks.form.department')} *</label>
            <select
              className="form-select"
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value, assignedTo: '' })}
              disabled={isProjectScoped ? availableDepartments.length <= 1 : !isSuperAdmin}
              required
            >
              <option value="" disabled>{t('tasks.form.selectDepartment')}</option>
              {availableDepartments.map((dept) => (
                <option key={dept} value={dept}>{t(DEPARTMENT_LABELS[dept])}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">{t('tasks.form.assignedTo')} *</label>
            <select
              className="form-select"
              value={form.assignedTo}
              onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
              required
            >
              <option value="" disabled>{t('tasks.form.selectAssignee')}</option>
              {visibleAssignableUsers.map((u) => (
                <option key={u._id} value={u._id}>{u.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">{t('tasks.form.priority')}</label>
            <select
              className="form-select"
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
            >
              {['critical', 'high', 'medium', 'low'].map((p) => (
                <option key={p} value={p}>{t(`tasks.priority.${p}`)}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">{t('tasks.form.deadline')}</label>
            <input
              type="date"
              className="form-input"
              value={form.deadline}
              onChange={(e) => setForm({ ...form, deadline: e.target.value })}
            />
          </div>
          {showProjectField && (
            <div className="form-group">
              <label className="form-label">{t('tasks.form.project')}</label>
              <select
                className="form-select"
                value={form.projectId}
                onChange={(e) => setForm({ ...form, projectId: e.target.value })}
              >
                <option value="">{t('tasks.form.noProject')}</option>
                {projects.map((p) => (
                  <option key={p._id} value={p._id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}
        </form>
      )}
    </Modal>
  );
};

export default CreateTaskModal;

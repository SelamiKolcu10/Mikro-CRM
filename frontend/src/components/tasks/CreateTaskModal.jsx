import { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { DEPARTMENTS, DEPARTMENT_LABELS, ROLES } from '../../config/permissions';
import taskService from '../../services/taskService';
import toast from 'react-hot-toast';

const initialForm = { title: '', description: '', department: '', priority: 'medium', deadline: '', assignedTo: '' };

const CreateTaskModal = ({ isOpen, onClose, onCreate }) => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === ROLES.SUPER_ADMIN;

  const [form, setForm] = useState(initialForm);
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // Lider için departman zaten sabit — kendi departmanı. super_admin
  // formdan seçer.
  useEffect(() => {
    if (!isOpen) return;
    setForm({ ...initialForm, department: isSuperAdmin ? '' : user?.department || '' });
    setAssignableUsers([]);
  }, [isOpen, isSuperAdmin, user?.department]);

  useEffect(() => {
    if (!form.department) {
      setAssignableUsers([]);
      return;
    }
    taskService.getAssignableUsers(form.department)
      .then((res) => setAssignableUsers(res.data.data))
      .catch(() => setAssignableUsers([]));
  }, [form.department]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onCreate({
        ...form,
        deadline: form.deadline || null,
        description: form.description || undefined,
      });
      toast.success(t('tasks.createSuccess'));
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('tasks.createTitle')}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
          <button type="submit" form="create-task-form" className="btn btn-primary" disabled={submitting}>
            {t('common.save')}
          </button>
        </>
      }
    >
      <form id="create-task-form" onSubmit={handleSubmit}>
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
            disabled={!isSuperAdmin}
            required
          >
            <option value="" disabled>{t('tasks.form.selectDepartment')}</option>
            {DEPARTMENTS.map((dept) => (
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
            {assignableUsers.map((u) => (
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
      </form>
    </Modal>
  );
};

export default CreateTaskModal;

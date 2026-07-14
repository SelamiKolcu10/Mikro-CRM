import { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { useLanguage } from '../../context/LanguageContext';
import { DEPARTMENT_LABELS } from '../../config/permissions';
import projectService from '../../services/projectService';
import toast from 'react-hot-toast';

const emptyForm = { name: '', techStack: '', teamMembers: [], projectLead: '' };

/**
 * Oluştur/düzenle formu. Ekip seçimi `/projects/eligible-members` uç
 * noktasını kullanır — bir projenin ekibi departmanlar arası olabildiği
 * için (bkz. design doc: department/projectId bağımsız eksenler) sadece
 * development departmanıyla sınırlı tutulmaz, TÜM onaylı staff/super_admin
 * listelenir.
 */
const ProjectFormModal = ({ isOpen, onClose, onSubmit, project }) => {
  const { t } = useLanguage();
  const [form, setForm] = useState(emptyForm);
  const [members, setMembers] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setForm(
      project
        ? {
            name: project.name,
            techStack: project.techStack.join(', '),
            teamMembers: project.teamMembers.map((m) => m._id),
            projectLead: project.projectLead?._id || '',
          }
        : emptyForm
    );
    projectService
      .getEligibleMembers()
      .then((res) => setMembers(res.data.data))
      .catch(() => setMembers([]));
  }, [isOpen, project]);

  const toggleMember = (id) => {
    setForm((prev) => {
      const teamMembers = prev.teamMembers.includes(id)
        ? prev.teamMembers.filter((m) => m !== id)
        : [...prev.teamMembers, id];
      // Ekipten çıkarılan kişi proje lideriyse, lider seçimi de temizlenir —
      // lider her zaman ekibin bir üyesi olmalı (backend da bunu doğrular).
      const projectLead = teamMembers.includes(prev.projectLead) ? prev.projectLead : '';
      return { ...prev, teamMembers, projectLead };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({
        name: form.name,
        techStack: form.techStack.split(',').map((s) => s.trim()).filter(Boolean),
        teamMembers: form.teamMembers,
        projectLead: form.projectLead || null,
      });
      toast.success(t(project ? 'projects.updateSuccess' : 'projects.createSuccess'));
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
      title={t(project ? 'projects.editTitle' : 'projects.createTitle')}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
          <button type="submit" form="project-form" className="btn btn-primary" disabled={submitting}>
            {t('common.save')}
          </button>
        </>
      }
    >
      <form id="project-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">{t('projects.form.name')} *</label>
          <input
            className="form-input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            minLength={2}
            maxLength={100}
            required
          />
        </div>
        <div className="form-group">
          <label className="form-label">{t('projects.form.techStack')}</label>
          <input
            className="form-input"
            value={form.techStack}
            onChange={(e) => setForm({ ...form, techStack: e.target.value })}
            placeholder={t('projects.form.techStackPlaceholder')}
          />
        </div>
        <div className="form-group">
          <label className="form-label">{t('projects.form.teamMembers')}</label>
          <div className="project-form-member-list">
            {members.map((member) => (
              <label key={member._id} className="project-form-member-option">
                <input
                  type="checkbox"
                  checked={form.teamMembers.includes(member._id)}
                  onChange={() => toggleMember(member._id)}
                />
                {member.name}
                {member.department && (
                  <span className="project-form-member-dept">{t(DEPARTMENT_LABELS[member.department])}</span>
                )}
              </label>
            ))}
            {members.length === 0 && <p className="form-hint">{t('projects.form.noMembers')}</p>}
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">{t('projects.form.projectLead')}</label>
          <select
            className="form-select"
            value={form.projectLead}
            onChange={(e) => setForm({ ...form, projectLead: e.target.value })}
            disabled={form.teamMembers.length === 0}
          >
            <option value="">{t('projects.form.noLead')}</option>
            {members
              .filter((member) => form.teamMembers.includes(member._id))
              .map((member) => (
                <option key={member._id} value={member._id}>{member.name}</option>
              ))}
          </select>
          <p className="form-hint">{t('projects.form.projectLeadHint')}</p>
        </div>
      </form>
    </Modal>
  );
};

export default ProjectFormModal;

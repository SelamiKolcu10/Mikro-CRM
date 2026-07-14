import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { DEFAULT_ROUTE_BY_ROLE } from '../config/permissions';
import { canManageProjects } from '../utils/projectScope';
import { useProjects, useMyProjects } from '../hooks/useProjects';
import ProjectCard from '../components/projects/ProjectCard';
import ProjectDrawer from '../components/projects/ProjectDrawer';
import ProjectFormModal from '../components/projects/ProjectFormModal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import toast from 'react-hot-toast';

/**
 * Route seviyesinde RoleGuard sadece kaba filtre (super_admin/staff) —
 * Dev Lead koşulunu ifade edemez. Burada iki mod var:
 *  - Yönetici (canManageProjects): tam grid + CRUD (mevcut davranış).
 *  - Ekip üyesi (canManageProjects değil ama en az bir projede teamMembers
 *    içinde): sadece kendi projelerini görür, drawer'da wiki/görevler
 *    salt-okunur ama tartışma (yorum) yazabilir (bkz. ProjectDrawer
 *    canCommentOnProject). Hiçbirine girmiyorsa sayfadan atılır.
 */
const Projects = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const isManager = canManageProjects(user);

  const manager = useProjects({ enabled: isManager });
  const viewer = useMyProjects({ enabled: !isManager });
  const { projects, loading, refresh } = isManager ? manager : viewer;
  const { error, createProject, updateProject, deleteProject } = manager;

  const [selectedProject, setSelectedProject] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [deletingProject, setDeletingProject] = useState(null);
  const [deleting, setDeleting] = useState(false);

  if (!isManager && !loading && projects.length === 0) {
    return <Navigate to={DEFAULT_ROUTE_BY_ROLE[user?.role] || '/'} replace />;
  }

  const handleUpdateNotes = async (id, architectureNotes) => {
    try {
      const updated = await updateProject(id, { architectureNotes });
      setSelectedProject(updated);
      toast.success(t('projects.updateSuccess'));
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.error'));
    }
  };

  const handleEditSubmit = async (payload) => {
    const updated = await updateProject(editingProject._id, payload);
    setSelectedProject(updated);
  };

  const handleDeleteConfirm = async () => {
    setDeleting(true);
    try {
      await deleteProject(deletingProject._id);
      setSelectedProject(null);
      setDeletingProject(null);
      toast.success(t('projects.deleteSuccess'));
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.error'));
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;
  if (isManager && error) return <p className="error-text">{error}</p>;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>{t(isManager ? 'projects.title' : 'projects.myTitle')}</h1>
          <p>{t(isManager ? 'projects.subtitle' : 'projects.mySubtitle')}</p>
        </div>
        {isManager && (
          <button className="btn btn-primary" onClick={() => setFormOpen(true)}>{t('projects.createTitle')}</button>
        )}
      </div>

      {projects.length === 0 ? (
        <div className="project-grid-empty">
          <p>{t('projects.empty')}</p>
        </div>
      ) : (
        <div className="project-grid">
          {projects.map((project) => (
            <ProjectCard key={project._id} project={project} onClick={() => setSelectedProject(project)} />
          ))}
        </div>
      )}

      <ProjectDrawer
        project={selectedProject}
        onClose={() => setSelectedProject(null)}
        onUpdateNotes={handleUpdateNotes}
        onEditMeta={setEditingProject}
        onDelete={setDeletingProject}
        onTaskStatusChanged={refresh}
      />

      {isManager && (
        <>
          <ProjectFormModal
            isOpen={formOpen}
            onClose={() => setFormOpen(false)}
            onSubmit={createProject}
          />

          <ProjectFormModal
            isOpen={!!editingProject}
            onClose={() => setEditingProject(null)}
            onSubmit={handleEditSubmit}
            project={editingProject}
          />

          <ConfirmDialog
            isOpen={!!deletingProject}
            onClose={() => setDeletingProject(null)}
            onConfirm={handleDeleteConfirm}
            title={t('projects.deleteConfirmTitle')}
            message={t('projects.deleteConfirmMessage')}
            loading={deleting}
          />
        </>
      )}
    </div>
  );
};

export default Projects;

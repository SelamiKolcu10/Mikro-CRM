import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { HiOutlineX, HiOutlinePencil, HiOutlineTrash, HiOutlineDocumentText, HiOutlineUsers, HiOutlineClipboardList, HiOutlineChatAlt2, HiOutlinePlus } from 'react-icons/hi';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { canManageProjects, canEditProject, canCommentOnProject } from '../../utils/projectScope';
import { canActOnTask, canApproveTask, canCommentOnTask } from '../../utils/taskScope';
import { useProjectTasks } from '../../hooks/useProjects';
import { useProjectComments } from '../../hooks/useProjectComments';
import { useTaskComments } from '../../hooks/useTaskComments';
import TaskAvatar from '../tasks/TaskAvatar';
import TaskDetailModal from '../tasks/TaskDetailModal';
import CreateTaskModal from '../tasks/CreateTaskModal';
import ProjectTeamList from './ProjectTeamList';
import ProjectChatRoom from './ProjectChatRoom';

const NOOP_ASSIGNABLE_USERS = () => Promise.resolve([]);

const STATUSES = ['todo', 'in_progress', 'in_review', 'done'];
const TABS = [
  { id: 'notes', icon: HiOutlineDocumentText, labelKey: 'projects.drawer.tabs.notes' },
  { id: 'team', icon: HiOutlineUsers, labelKey: 'projects.drawer.tabs.team' },
  { id: 'tasks', icon: HiOutlineClipboardList, labelKey: 'projects.drawer.tabs.tasks' },
  { id: 'room', icon: HiOutlineChatAlt2, labelKey: 'projects.drawer.tabs.room' },
];

/**
 * Sağdan açılan slide-over — route değişmez, sadece state (bkz. Projects.jsx).
 * Sekmeli görünüm: Mimari Notlar / Ekip / Görevler / Proje Odası.
 */
const ProjectDrawer = ({ project, onClose, onUpdateNotes, onEditMeta, onDelete, onTaskStatusChanged }) => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const drawerRef = useRef(null);
  const [activeTab, setActiveTab] = useState('notes');
  const [editing, setEditing] = useState(false);
  const [draftNotes, setDraftNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const { tasks, loading: tasksLoading, updateStatus, createTask } = useProjectTasks(project?._id);
  const { comments, addComment } = useProjectComments(project?._id);
  const { comments: taskComments, addComment: addTaskComment } = useTaskComments(selectedTask?._id);

  // Silme her zaman global yönetici (canManageProjects) — projeye özel lider
  // bile bu kadar geniş bir yıkıcı yetkiye sahip değil. Wiki/isim/ekip
  // düzenleme ise canEditProject (yönetici + bu projenin lideri).
  const canDelete = canManageProjects(user);
  const canEdit = project ? canEditProject(user, project) : false;
  const canComment = project ? canCommentOnProject(user, project) : false;

  useEffect(() => {
    if (!project) return;
    setActiveTab('notes');
    setEditing(false);
    setDraftNotes(project.architectureNotes || '');
    setSelectedTask(null);
    drawerRef.current?.focus();
  }, [project]);

  useEffect(() => {
    if (!project) return;
    const handleKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      if (selectedTask) {
        setSelectedTask(null);
        return;
      }
      onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [project, selectedTask, onClose]);

  if (!project) return null;

  const handleTaskStatusChange = async (id, status) => {
    await updateStatus(id, status);
    onTaskStatusChanged?.();
  };

  const handleCreateTask = async (payload) => {
    await createTask(payload);
    onTaskStatusChanged?.();
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdateNotes(project._id, draftNotes);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const tasksByStatus = STATUSES.reduce((acc, status) => {
    acc[status] = tasks.filter((task) => task.status === status);
    return acc;
  }, {});

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <div className="project-drawer" role="dialog" aria-modal="true" tabIndex={-1} ref={drawerRef}>
        <div className="project-drawer-header">
          <h2>{project.name}</h2>
          <div className="project-drawer-header-actions">
            {canEdit && (
              <button type="button" className="btn-icon" onClick={() => onEditMeta(project)} aria-label={t('common.edit')}>
                <HiOutlinePencil />
              </button>
            )}
            {canDelete && (
              <button type="button" className="btn-icon" onClick={() => onDelete(project)} aria-label={t('common.delete')}>
                <HiOutlineTrash />
              </button>
            )}
            <button type="button" className="btn-icon" onClick={onClose} aria-label={t('common.close')}>
              <HiOutlineX />
            </button>
          </div>
        </div>

        <div className="project-drawer-tabs">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                className={`project-drawer-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon /> {t(tab.labelKey)}
              </button>
            );
          })}
        </div>

        <div className="project-drawer-body">
          {activeTab === 'notes' && (
            <section className="project-drawer-section">
              <div className="project-drawer-section-header">
                <span className="form-label">{t('projects.drawer.wiki')}</span>
                {canEdit && !editing && (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>
                    <HiOutlinePencil /> {t('common.edit')}
                  </button>
                )}
              </div>

              {editing ? (
                <>
                  <textarea
                    className="form-textarea project-drawer-notes-editor"
                    value={draftNotes}
                    onChange={(e) => setDraftNotes(e.target.value)}
                    maxLength={20000}
                  />
                  <div className="project-drawer-notes-actions">
                    <button type="button" className="btn btn-secondary" onClick={() => setEditing(false)} disabled={saving}>
                      {t('common.cancel')}
                    </button>
                    <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
                      {t('common.save')}
                    </button>
                  </div>
                </>
              ) : project.architectureNotes ? (
                <div className="project-drawer-markdown">
                  <ReactMarkdown>{project.architectureNotes}</ReactMarkdown>
                </div>
              ) : (
                <p className="task-comment-empty">{t('projects.drawer.wikiEmpty')}</p>
              )}
            </section>
          )}

          {activeTab === 'team' && (
            <section className="project-drawer-section">
              <span className="form-label">{t('projects.drawer.tabs.team')}</span>
              <ProjectTeamList teamMembers={project.teamMembers} projectLead={project.projectLead} />
            </section>
          )}

          {activeTab === 'tasks' && (
            <section className="project-drawer-section">
              <div className="project-drawer-section-header">
                <span className="form-label">{t('projects.drawer.tasks')}</span>
                {canEdit && (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setTaskFormOpen(true)}>
                    <HiOutlinePlus /> {t('projects.drawer.addTask')}
                  </button>
                )}
              </div>
              {tasksLoading ? (
                <div className="loading-spinner"><div className="spinner" /></div>
              ) : tasks.length === 0 ? (
                <p className="task-comment-empty">{t('projects.drawer.tasksEmpty')}</p>
              ) : (
                STATUSES.map((status) =>
                  tasksByStatus[status].length > 0 ? (
                    <div key={status} className="project-drawer-task-group">
                      <span className="pill pill-status">{t(`tasks.status.${status}`)} ({tasksByStatus[status].length})</span>
                      <div className="project-drawer-task-list">
                        {tasksByStatus[status].map((task) => (
                          <div
                            key={task._id}
                            className="project-drawer-task-row is-clickable"
                            role="button"
                            tabIndex={0}
                            onClick={() => setSelectedTask(task)}
                          >
                            <TaskAvatar user={task.assignedTo} />
                            <span>{task.title}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null
                )
              )}
            </section>
          )}

          {activeTab === 'room' && (
            <ProjectChatRoom project={project} comments={comments} canComment={canComment} onSubmit={addComment} />
          )}
        </div>
      </div>

      {/* Aynı Task, aynı TaskDetailModal, aynı yetki kuralları (canActOnTask/
          canApproveTask) — TaskBoard'daki görevden hiçbir farkı yok, sadece
          bu panelden açılıyor (bkz. design doc: proje ile task bağımsız değil). */}
      <TaskDetailModal
        task={selectedTask}
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        onStatusChange={handleTaskStatusChange}
        canAct={selectedTask ? canActOnTask(user, selectedTask) : false}
        canApprove={selectedTask ? canApproveTask(user, selectedTask) : false}
        comments={taskComments}
        onAddComment={addTaskComment}
        canComment={canCommentOnTask(user)}
      />

      <CreateTaskModal
        isOpen={taskFormOpen}
        onClose={() => setTaskFormOpen(false)}
        onCreate={handleCreateTask}
        getAssignableUsers={NOOP_ASSIGNABLE_USERS}
        project={project}
      />
    </>
  );
};

export default ProjectDrawer;

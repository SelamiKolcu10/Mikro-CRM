import { useState } from 'react';
import { useTasks, applyTaskFilters } from '../hooks/useTasks';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { ROLES } from '../config/permissions';
import TaskBoard from '../components/tasks/TaskBoard';
import TaskHistory from '../components/tasks/TaskHistory';
import TaskHeatmap from '../components/tasks/TaskHeatmap';
import TaskFilterBar from '../components/tasks/TaskFilterBar';
import CreateTaskModal from '../components/tasks/CreateTaskModal';
import toast from 'react-hot-toast';

const TABS = ['board', 'history', 'heatmap'];
const INITIAL_FILTERS = { department: '', assigneeId: '', onlyMine: false };

const Tasks = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { tasks, loading, error, createTask, updateTaskStatus, getAssignableUsers, getActivityHeatmap } = useTasks();
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('board');
  const [filters, setFilters] = useState(INITIAL_FILTERS);

  const canCreate = user?.role === ROLES.SUPER_ADMIN || user?.isDepartmentLead;
  // Sadece super_admin ve intern gerçekten tüm departmanları görebilir
  // (taskScope her ikisine de {} döner). Departman lideri/üyesi zaten
  // backend'den sadece kendi departmanının verisini alıyor, o yüzden onlara
  // "başka departman seç" seçeneği sunmak yanıltıcı — boş bir pano gösterir.
  const hasFullDepartmentAccess = user?.role === ROLES.SUPER_ADMIN || user?.role === ROLES.INTERN;
  const filteredTasks = applyTaskFilters(tasks, filters, user?._id);

  const handleStatusChange = async (id, status) => {
    try {
      await updateTaskStatus(id, status);
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.error'));
    }
  };

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;
  if (error) return <p className="error-text">{error}</p>;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>{t('tasks.title')}</h1>
          <p>{t('tasks.subtitle')}</p>
        </div>
        {canCreate && (
          <button className="btn btn-primary" onClick={() => setModalOpen(true)}>{t('tasks.createTitle')}</button>
        )}
      </div>

      <div className="task-tabs">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            className={`filter-chip ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {t(`tasks.tabs.${tab}`)}
          </button>
        ))}
      </div>

      <TaskFilterBar
        tasks={tasks}
        filters={filters}
        onChange={setFilters}
        showDepartmentFilter={hasFullDepartmentAccess}
      />

      {activeTab === 'board' && <TaskBoard tasks={filteredTasks} onStatusChange={handleStatusChange} />}
      {activeTab === 'history' && <TaskHistory tasks={filteredTasks} />}
      {activeTab === 'heatmap' && (
        <TaskHeatmap getActivityHeatmap={getActivityHeatmap} department={filters.department} assigneeId={filters.assigneeId} />
      )}

      <CreateTaskModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreate={createTask}
        getAssignableUsers={getAssignableUsers}
      />
    </div>
  );
};

export default Tasks;

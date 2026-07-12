import { useState } from 'react';
import { useTasks } from '../hooks/useTasks';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { ROLES } from '../config/permissions';
import TaskBoard from '../components/tasks/TaskBoard';
import CreateTaskModal from '../components/tasks/CreateTaskModal';
import toast from 'react-hot-toast';

const Tasks = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { tasks, loading, error, createTask, updateTaskStatus } = useTasks();
  const [modalOpen, setModalOpen] = useState(false);

  const canCreate = user?.role === ROLES.SUPER_ADMIN || user?.isDepartmentLead;

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
      <TaskBoard tasks={tasks} onStatusChange={handleStatusChange} />
      <CreateTaskModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onCreate={createTask} />
    </div>
  );
};

export default Tasks;

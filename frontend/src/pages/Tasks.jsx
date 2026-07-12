import { useTasks } from '../hooks/useTasks';
import { useLanguage } from '../context/LanguageContext';
import TaskBoard from '../components/tasks/TaskBoard';
import toast from 'react-hot-toast';

const Tasks = () => {
  const { t } = useLanguage();
  const { tasks, loading, error, updateTaskStatus } = useTasks();

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
        <h1>{t('tasks.title')}</h1>
        <p>{t('tasks.subtitle')}</p>
      </div>
      <TaskBoard tasks={tasks} onStatusChange={handleStatusChange} />
    </div>
  );
};

export default Tasks;

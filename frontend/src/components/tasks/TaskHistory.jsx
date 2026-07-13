// frontend/src/components/tasks/TaskHistory.jsx
import { useLanguage } from '../../context/LanguageContext';
import { DEPARTMENT_LABELS } from '../../config/permissions';

const TaskHistory = ({ tasks }) => {
  const { t } = useLanguage();

  const completed = tasks
    .filter((task) => task.status === 'done')
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  return (
    <div className="table-container">
      <table className="data-table">
        <thead>
          <tr>
            <th>{t('tasks.history.id')}</th>
            <th>{t('tasks.form.title')}</th>
            <th>{t('tasks.form.department')}</th>
            <th>{t('tasks.form.assignedTo')}</th>
            <th>{t('tasks.history.completedDate')}</th>
            <th>{t('tasks.history.assignedBy')}</th>
          </tr>
        </thead>
        <tbody>
          {completed.length === 0 ? (
            <tr><td colSpan={6}>{t('tasks.history.empty')}</td></tr>
          ) : (
            completed.map((task) => (
              <tr key={task._id}>
                <td>{task._id.slice(-6)}</td>
                <td>{task.title}</td>
                <td>{t(DEPARTMENT_LABELS[task.department])}</td>
                <td>{task.assignedTo?.name}</td>
                <td>{new Date(task.updatedAt).toLocaleDateString()}</td>
                <td>{task.assignedBy?.name}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default TaskHistory;

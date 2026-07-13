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
                <td data-label={t('tasks.history.id')}>{task._id.slice(-6)}</td>
                <td data-label={t('tasks.form.title')}>{task.title}</td>
                <td data-label={t('tasks.form.department')}>{t(DEPARTMENT_LABELS[task.department])}</td>
                <td data-label={t('tasks.form.assignedTo')}>{task.assignedTo?.name}</td>
                <td data-label={t('tasks.history.completedDate')}>{new Date(task.updatedAt).toLocaleDateString()}</td>
                <td data-label={t('tasks.history.assignedBy')}>{task.assignedBy?.name}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default TaskHistory;

import { useLanguage } from '../../context/LanguageContext';
import TaskCard from './TaskCard';

const TaskColumn = ({ status, tasks, mobileActive, onCardClick }) => {
  const { t } = useLanguage();

  return (
    <div className={`task-column ${mobileActive ? 'task-column-mobile-active' : ''}`}>
      <h3>{t(`tasks.status.${status}`)} <span className="task-column-count">{tasks.length}</span></h3>
      <div className="task-column-body">
        {tasks.map((task) => (
          <TaskCard key={task._id} task={task} onClick={() => onCardClick(task)} />
        ))}
      </div>
    </div>
  );
};

export default TaskColumn;

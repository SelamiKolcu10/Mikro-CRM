import { useMemo } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { DEPARTMENTS, DEPARTMENT_LABELS } from '../../config/permissions';

const TaskFilterBar = ({ tasks, filters, onChange, showDepartmentFilter }) => {
  const { t } = useLanguage();

  const assignees = useMemo(() => {
    const relevant = filters.department
      ? tasks.filter((task) => task.department === filters.department)
      : tasks;
    const map = new Map();
    relevant.forEach((task) => {
      const assignee = task.assignedTo;
      if (assignee?._id && !map.has(assignee._id)) map.set(assignee._id, assignee);
    });
    return Array.from(map.values());
  }, [tasks, filters.department]);

  return (
    <div className="task-filter-bar">
      {showDepartmentFilter && (
        <select
          className="form-select compact"
          value={filters.department}
          onChange={(e) => onChange({ ...filters, department: e.target.value, assigneeId: '' })}
        >
          <option value="">{t('tasks.filters.allDepartments')}</option>
          {DEPARTMENTS.map((dept) => (
            <option key={dept} value={dept}>{t(DEPARTMENT_LABELS[dept])}</option>
          ))}
        </select>
      )}

      <select
        className="form-select compact"
        value={filters.assigneeId}
        onChange={(e) => onChange({ ...filters, assigneeId: e.target.value })}
      >
        <option value="">{t('tasks.filters.allAssignees')}</option>
        {assignees.map((a) => (
          <option key={a._id} value={a._id}>{a.name}</option>
        ))}
      </select>

      <label className="task-filter-checkbox">
        <input
          type="checkbox"
          checked={filters.onlyMine}
          onChange={(e) => onChange({ ...filters, onlyMine: e.target.checked })}
        />
        {t('tasks.filters.onlyMine')}
      </label>
    </div>
  );
};

export default TaskFilterBar;

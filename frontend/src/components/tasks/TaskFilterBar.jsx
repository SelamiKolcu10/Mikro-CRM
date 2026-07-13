import { useMemo } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { DEPARTMENTS, DEPARTMENT_LABELS } from '../../config/permissions';

const TaskFilterBar = ({ tasks, filters, onChange }) => {
  const { t } = useLanguage();

  const assignees = useMemo(() => {
    const map = new Map();
    tasks.forEach((task) => {
      const assignee = task.assignedTo;
      if (assignee?._id && !map.has(assignee._id)) map.set(assignee._id, assignee);
    });
    return Array.from(map.values());
  }, [tasks]);

  return (
    <div className="task-filter-bar">
      <select
        className="form-select compact"
        value={filters.department}
        onChange={(e) => onChange({ ...filters, department: e.target.value })}
      >
        <option value="">{t('tasks.filters.allDepartments')}</option>
        {DEPARTMENTS.map((dept) => (
          <option key={dept} value={dept}>{t(DEPARTMENT_LABELS[dept])}</option>
        ))}
      </select>

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

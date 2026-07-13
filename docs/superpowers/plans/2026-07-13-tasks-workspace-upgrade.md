# Tasks Workspace Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `Tasks.jsx` into a 3-tab workspace (Kanban / History / Heatmap) with a shared filter bar, a 7-day done-column clutter guard, and a GitHub-style activity heatmap backed by a new history model.

**Architecture:** A new `TaskActivity` collection records every status transition (written inside the existing `updateTaskStatus` controller). A new aggregation endpoint turns that into daily heatmap buckets. All new business logic (filtering, heatmap fetch) lives in `useTasks.js`/`taskService.js`, never in components — components stay presentation-only, per this codebase's existing mobile-port separation rule.

**Tech Stack:** Existing Node/Express/Mongoose backend, React frontend, `@dnd-kit` (already installed). No new dependencies.

## Global Constraints

- No automated test framework exists in this codebase — every "verify" step is a manual `node -e` script or curl command, or (Task 10) a live browser walkthrough.
- No comments, file attachments, or task-transfer features (explicitly out of scope).
- Only mask `email`/`actorEmail` for intern where that pattern already applies — the heatmap endpoint returns no PII (dates/counts only), so it needs no masking.
- Follow existing patterns: reuse `.filter-chip`/`.data-table`/`.badge` CSS classes instead of inventing new ones wherever the existing style already fits.
- Turkish user-facing strings, added to both `tr.json` and `en.json` identically.

---

### Task 1: `TaskActivity` model + wire into status updates

**Files:**
- Create: `backend/models/TaskActivity.js`
- Modify: `backend/controllers/taskController.js` (`updateTaskStatus`)

**Interfaces:**
- Produces: `TaskActivity` Mongoose model with fields `task`, `changedBy`, `department`, `fromStatus`, `toStatus`, `createdAt`.

- [ ] **Step 1: Create the model**

```js
// backend/models/TaskActivity.js
const mongoose = require('mongoose');

const STATUSES = ['todo', 'in_progress', 'in_review', 'done'];
const DEPARTMENTS = ['development', 'design', 'hr', 'marketing'];

const taskActivitySchema = new mongoose.Schema(
  {
    task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Anlık görüntü — ısı haritası bu koleksiyondan Task'a join yapmadan
    // departmana göre filtrelenebilsin diye (bkz. taskScope.js'in aynı gerekçesi).
    department: { type: String, enum: DEPARTMENTS, required: true },
    fromStatus: { type: String, enum: STATUSES, required: true },
    toStatus: { type: String, enum: STATUSES, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

module.exports = mongoose.model('TaskActivity', taskActivitySchema);
```

- [ ] **Step 2: Wire into `updateTaskStatus`**

In `backend/controllers/taskController.js`, add the import at the top:
```js
const TaskActivity = require('../models/TaskActivity');
```

Change:
```js
    task.status = status;
    await task.save();
    await task.populate(TASK_POPULATE);

    res.json({ success: true, data: task });
```
to:
```js
    const previousStatus = task.status;
    task.status = status;
    await task.save();
    await TaskActivity.create({
      task: task._id,
      changedBy: req.user._id,
      department: task.department,
      fromStatus: previousStatus,
      toStatus: status,
    });
    await task.populate(TASK_POPULATE);

    res.json({ success: true, data: task });
```

- [ ] **Step 3: Manual verification**

```bash
node -e "
require('dotenv').config();
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGO_URI).then(async () => {
  const TaskActivity = require('./models/TaskActivity');
  const { Types } = require('mongoose');
  const doc = await TaskActivity.create({
    task: new Types.ObjectId(), changedBy: new Types.ObjectId(),
    department: 'development', fromStatus: 'todo', toStatus: 'in_progress',
  });
  console.log('created:', doc._id.toString());
  await TaskActivity.deleteOne({ _id: doc._id });
  console.log('cleaned up');
  process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });
" --cwd backend
```
(Run from `backend/`.) Expected: prints `created: <id>` then `cleaned up`, no errors.

Then, with the backend running, `PATCH /api/tasks/:id/status` on a real task (any valid transition) and confirm a matching `TaskActivity` document now exists (`db.taskactivities.find({task: ObjectId("...")})` or an equivalent `node -e` query) with the correct `fromStatus`/`toStatus`/`department`.

- [ ] **Step 4: Commit**

```bash
git add backend/models/TaskActivity.js backend/controllers/taskController.js
git commit -m "feat: add TaskActivity history model, record every status transition"
```

---

### Task 2: Activity heatmap endpoint

**Files:**
- Modify: `backend/controllers/taskController.js` (add `getActivityHeatmap`)
- Modify: `backend/routes/taskRoutes.js`
- Modify: `backend/validators/taskValidators.js`

**Interfaces:**
- Consumes: `TaskActivity` (Task 1).
- Produces: `GET /api/tasks/activity-heatmap?department=&userId=` → `{ success, data: [{ date: 'YYYY-MM-DD', total, byStatus: { todo?, in_progress?, in_review?, done? } }] }`, last 365 days, scoped like `taskScope` but via `TaskActivity`'s own `department`/`changedBy` fields.

- [ ] **Step 1: Add `mongoose` import and the controller function**

In `backend/controllers/taskController.js`, add near the top:
```js
const mongoose = require('mongoose');
const TaskActivity = require('../models/TaskActivity'); // if not already added in Task 1
```

Add this function (and add `getActivityHeatmap` to the final `module.exports`):
```js
/**
 * @route   GET /api/tasks/activity-heatmap?department=&userId=
 * @desc    Son 365 günü günlük gruplar. Görünürlük taskScope ile aynı
 *          kural, ama TaskActivity'nin kendi department/changedBy
 *          alanları üzerinden (Task'a join yok).
 */
const getActivityHeatmap = async (req, res, next) => {
  try {
    const { department, userId } = req.query;
    const since = new Date();
    since.setDate(since.getDate() - 365);

    const match = { createdAt: { $gte: since } };

    const isSuperAdmin = req.user.role === ROLES.SUPER_ADMIN;
    const isIntern = req.user.role === ROLES.INTERN;
    if (!isSuperAdmin && !isIntern) {
      if (req.user.isDepartmentLead && req.user.department) {
        match.department = req.user.department;
      } else {
        match.changedBy = req.user._id;
      }
    }

    if (department) match.department = department;
    if (userId) match.changedBy = new mongoose.Types.ObjectId(userId);

    const rows = await TaskActivity.aggregate([
      { $match: match },
      {
        $group: {
          _id: { date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, status: '$toStatus' },
          count: { $sum: 1 },
        },
      },
    ]);

    const byDate = {};
    for (const row of rows) {
      const { date, status } = row._id;
      if (!byDate[date]) byDate[date] = { date, total: 0, byStatus: {} };
      byDate[date].byStatus[status] = row.count;
      byDate[date].total += row.count;
    }

    res.json({ success: true, data: Object.values(byDate) });
  } catch (error) {
    next(error);
  }
};
```
Update the file's final line to:
```js
module.exports = { getTasks, getAssignableUsers, createTask, updateTaskStatus, getActivityHeatmap };
```

- [ ] **Step 2: Add the validator**

In `backend/validators/taskValidators.js`, add:
```js
const activityHeatmapValidators = [
  query('department').optional().isIn(DEPARTMENTS).withMessage('Geçersiz departman.'),
  query('userId').optional().isMongoId().withMessage('Geçersiz kullanıcı kimliği.'),
];
```
Add `activityHeatmapValidators` to `module.exports`.

- [ ] **Step 3: Register the route**

In `backend/routes/taskRoutes.js`, update the controller import to include `getActivityHeatmap` and the validator import to include `activityHeatmapValidators`, then add (after the `/assignable-users` route):
```js
router.get('/activity-heatmap', activityHeatmapValidators, handleValidationErrors, getActivityHeatmap);
```

- [ ] **Step 4: Manual verification**

With the backend running and a real staff/super_admin JWT (`$TOKEN`):
```bash
curl "http://localhost:5000/api/tasks/activity-heatmap" -H "Authorization: Bearer $TOKEN"
```
Expected: `200`, `{"success":true,"data":[...]}` — if Task 1's test transition is still in the DB, one entry should show today's date with `byStatus.in_progress: 1` (or whatever status you transitioned to).

- [ ] **Step 5: Commit**

```bash
git add backend/controllers/taskController.js backend/routes/taskRoutes.js backend/validators/taskValidators.js
git commit -m "feat: add task activity heatmap endpoint"
```

---

### Task 3: Frontend service + hook extensions

**Files:**
- Modify: `frontend/src/services/taskService.js`
- Modify: `frontend/src/hooks/useTasks.js`

**Interfaces:**
- Produces: `taskService.getActivityHeatmap(params)`; `useTasks()` gains `getActivityHeatmap(params)`; a new exported pure function `applyTaskFilters(tasks, filters, currentUserId)` from `useTasks.js` — `filters: { department, assigneeId, onlyMine }`.

- [ ] **Step 1: Add the service call**

In `frontend/src/services/taskService.js`, add:
```js
  getActivityHeatmap: (params) => api.get('/tasks/activity-heatmap', { params }),
```

- [ ] **Step 2: Add the hook function and the pure filter helper**

In `frontend/src/hooks/useTasks.js`, add inside `useTasks()` (alongside `getAssignableUsers`):
```js
  const getActivityHeatmap = useCallback(async (params) => {
    const res = await taskService.getActivityHeatmap(params);
    return res.data.data;
  }, []);
```
Add `getActivityHeatmap` to the returned object.

Add this pure function at the bottom of the file, outside `useTasks()`, and export it:
```js
/**
 * Saf filtre fonksiyonu — DOM'dan bağımsız, mobil port hedefiyle tutarlı.
 * assignedTo hem populate edilmiş ({_id,...}) hem ham ObjectId string
 * olabilir (bkz. frontend/src/utils/taskScope.js'in aynı deseni).
 */
export function applyTaskFilters(tasks, filters, currentUserId) {
  return tasks.filter((task) => {
    const assigneeId = task.assignedTo?._id || task.assignedTo;
    if (filters.onlyMine && assigneeId !== currentUserId) return false;
    if (filters.department && task.department !== filters.department) return false;
    if (filters.assigneeId && assigneeId !== filters.assigneeId) return false;
    return true;
  });
}
```

- [ ] **Step 3: Manual verification**

`useTasks.js` is a React hook file (JSX/ESM) — don't try to `require()` it directly in a bare `node -e` script, it will fail on syntax it doesn't need to support. Instead: `cd frontend && npm run build` and confirm it compiles with no errors, then read `applyTaskFilters` back to confirm the exported function signature matches what Task 9 will import (`applyTaskFilters(tasks, filters, currentUserId)`).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/services/taskService.js frontend/src/hooks/useTasks.js
git commit -m "feat: add activity heatmap fetch and pure task filter helper"
```

---

### Task 4: Avatar + role badge on task cards

**Files:**
- Create: `frontend/src/components/tasks/TaskAvatar.jsx`
- Modify: `frontend/src/components/tasks/TaskCard.jsx`
- Modify: `backend/controllers/taskController.js` (`TASK_POPULATE`)
- Modify: `frontend/src/index.css`

**Interfaces:**
- Produces: `<TaskAvatar user={{_id, name}} />`.
- Consumes: `task.assignedTo.role` — requires the backend populate to include it.

- [ ] **Step 1: Add `role` to the backend populate**

In `backend/controllers/taskController.js`, change:
```js
const TASK_POPULATE = [
  { path: 'assignedTo', select: 'name email department' },
  { path: 'assignedBy', select: 'name email' },
];
```
to:
```js
const TASK_POPULATE = [
  { path: 'assignedTo', select: 'name email department role' },
  { path: 'assignedBy', select: 'name email' },
];
```

- [ ] **Step 2: Create `TaskAvatar.jsx`**

```jsx
// frontend/src/components/tasks/TaskAvatar.jsx
const AVATAR_COLORS = ['#7c5cfc', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#a78bfa', '#06b6d4', '#ec4899'];

function colorForId(id) {
  const str = String(id || '');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase();
}

const TaskAvatar = ({ user }) => {
  if (!user) return null;
  return (
    <span className="task-avatar" style={{ background: colorForId(user._id) }} title={user.name}>
      {initials(user.name)}
    </span>
  );
};

export default TaskAvatar;
```

- [ ] **Step 3: Use it in `TaskCard.jsx`**

Change the imports at the top:
```jsx
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useLanguage } from '../../context/LanguageContext';
```
to:
```jsx
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useLanguage } from '../../context/LanguageContext';
import { ROLE_LABELS } from '../../config/permissions';
import TaskAvatar from './TaskAvatar';
```

Change the footer:
```jsx
      <div className="task-card-footer">
        <span>{task.assignedTo?.name}</span>
        {task.deadline && <span>{new Date(task.deadline).toLocaleDateString()}</span>}
      </div>
```
to:
```jsx
      <div className="task-card-footer">
        <span className="task-card-assignee">
          <TaskAvatar user={task.assignedTo} />
          {task.assignedTo?.name}
          {task.assignedTo?.role && (
            <span className="badge badge-role">{t(ROLE_LABELS[task.assignedTo.role])}</span>
          )}
        </span>
        {task.deadline && <span>{new Date(task.deadline).toLocaleDateString()}</span>}
      </div>
```

- [ ] **Step 4: Add CSS**

Append to `frontend/src/index.css` (near the existing `.task-card-*` rules):
```css
.task-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: var(--radius-full);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  flex-shrink: 0;
}

.task-card-assignee {
  display: flex;
  align-items: center;
  gap: 6px;
}

.badge-role {
  background: var(--bg-elevated);
  color: var(--text-secondary);
}
```

- [ ] **Step 5: Manual verification**

`cd frontend && npm run build` — confirm no errors. Then start backend+frontend, open `/tasks`, confirm task cards show a colored initials circle and a role badge next to the assignee name (visual check).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/tasks/TaskAvatar.jsx frontend/src/components/tasks/TaskCard.jsx backend/controllers/taskController.js frontend/src/index.css
git commit -m "feat: add assignee avatar and role badge to task cards"
```

---

### Task 5: 7-day done-column guard + mobile column-tab view

**Files:**
- Modify: `frontend/src/components/tasks/TaskBoard.jsx`
- Modify: `frontend/src/components/tasks/TaskColumn.jsx`
- Modify: `frontend/src/index.css`

**Interfaces:**
- Consumes: `task.updatedAt` (already present on every task from Mongoose `timestamps`).

- [ ] **Step 1: Rewrite `TaskBoard.jsx`**

Replace the full file with:
```jsx
import { useState } from 'react';
import { DndContext } from '@dnd-kit/core';
import TaskColumn from './TaskColumn';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { canActOnTask, canApproveTask } from '../../utils/taskScope';

const STATUSES = ['todo', 'in_progress', 'in_review', 'done'];
const DONE_VISIBLE_DAYS = 7;

function isVisibleOnBoard(task) {
  if (task.status !== 'done') return true;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - DONE_VISIBLE_DAYS);
  return new Date(task.updatedAt) >= cutoff;
}

/**
 * Sürükle-bırak sadece burada yaşar — veri/iş mantığı (useTasks) bu
 * bileşenden tamamen ayrı, DOM'a bağımlı değil (mobil port hedefi).
 */
const TaskBoard = ({ tasks, onStatusChange }) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [mobileColumn, setMobileColumn] = useState('todo');

  const visibleTasks = tasks.filter(isVisibleOnBoard);

  const tasksByStatus = STATUSES.reduce((acc, status) => {
    acc[status] = visibleTasks
      .filter((t) => t.status === status)
      .map((t) => ({ ...t, _canAct: canActOnTask(user, t) }));
    return acc;
  }, {});

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over) return;
    const task = tasks.find((t) => t._id === active.id);
    const targetStatus = over.id;
    if (!task || task.status === targetStatus) return;

    const allowed = targetStatus === 'done' ? canApproveTask(user, task) : canActOnTask(user, task);
    if (!allowed) return;

    onStatusChange(task._id, targetStatus);
  };

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="task-board-mobile-tabs">
        {STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            className={`filter-chip ${mobileColumn === status ? 'active' : ''}`}
            onClick={() => setMobileColumn(status)}
          >
            {t(`tasks.status.${status}`)} ({tasksByStatus[status].length})
          </button>
        ))}
      </div>
      <div className="task-board">
        {STATUSES.map((status) => (
          <TaskColumn
            key={status}
            status={status}
            tasks={tasksByStatus[status]}
            canDropHere={status !== 'done' || canApproveTask(user, { department: user?.department })}
            mobileActive={status === mobileColumn}
          />
        ))}
      </div>
    </DndContext>
  );
};

export default TaskBoard;
```

- [ ] **Step 2: Pass the mobile-active flag through `TaskColumn.jsx`**

Change:
```jsx
const TaskColumn = ({ status, tasks, canDropHere }) => {
  const { t } = useLanguage();
  const { setNodeRef, isOver } = useDroppable({ id: status, disabled: !canDropHere });

  return (
    <div ref={setNodeRef} className={`task-column ${isOver && canDropHere ? 'task-column-over' : ''}`}>
```
to:
```jsx
const TaskColumn = ({ status, tasks, canDropHere, mobileActive }) => {
  const { t } = useLanguage();
  const { setNodeRef, isOver } = useDroppable({ id: status, disabled: !canDropHere });

  return (
    <div
      ref={setNodeRef}
      className={`task-column ${isOver && canDropHere ? 'task-column-over' : ''} ${mobileActive ? 'task-column-mobile-active' : ''}`}
    >
```

- [ ] **Step 3: Add responsive CSS**

Append to `frontend/src/index.css`:
```css
.task-board-mobile-tabs {
  display: none;
  gap: var(--space-sm);
  margin-bottom: var(--space-md);
  overflow-x: auto;
}

@media (max-width: 768px) {
  .task-board-mobile-tabs {
    display: flex;
  }

  .task-board {
    display: block;
  }

  .task-column {
    display: none;
  }

  .task-column.task-column-mobile-active {
    display: block;
  }
}
```

- [ ] **Step 4: Manual verification**

`cd frontend && npm run build`. Then, in a browser at a narrow viewport (< 768px), confirm the 4-column board collapses into a single-column view with a horizontal tab row above it, and tapping a tab switches which column is shown. At desktop width, confirm the tab row is hidden and all 4 columns show side by side, unchanged from before. Also confirm any `done` task older than 7 days no longer appears on the board (create/backdate a test task's `updatedAt` via a `node -e` script if none exists naturally, then revert it).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/tasks/TaskBoard.jsx frontend/src/components/tasks/TaskColumn.jsx frontend/src/index.css
git commit -m "feat: hide done tasks older than 7 days, add mobile column-tab view"
```

---

### Task 6: Shared filter bar

**Files:**
- Create: `frontend/src/components/tasks/TaskFilterBar.jsx`
- Modify: `frontend/src/i18n/tr.json`, `frontend/src/i18n/en.json`

**Interfaces:**
- Produces: `<TaskFilterBar tasks={tasks} filters={filters} onChange={setFilters} currentUserId={user._id} />`, calling `onChange({ department, assigneeId, onlyMine })` on any control change.
- Consumes: `DEPARTMENTS`/`DEPARTMENT_LABELS` from `config/permissions.js`.

- [ ] **Step 1: Add i18n keys**

In `frontend/src/i18n/tr.json`, inside the existing `"tasks"` object, add a new `"filters"` key (alongside `"form"`):
```json
    "filters": {
      "allDepartments": "Tüm Departmanlar",
      "allAssignees": "Tüm Kişiler",
      "onlyMine": "Sadece Benim Görevlerim"
    }
```
In `frontend/src/i18n/en.json`, same structure with English text:
```json
    "filters": {
      "allDepartments": "All Departments",
      "allAssignees": "All Assignees",
      "onlyMine": "Only My Tasks"
    }
```

- [ ] **Step 2: Create the component**

```jsx
// frontend/src/components/tasks/TaskFilterBar.jsx
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
```

- [ ] **Step 3: Add CSS**

Append to `frontend/src/index.css`:
```css
.task-filter-bar {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-md);
  flex-wrap: wrap;
}

.task-filter-checkbox {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  cursor: pointer;
}
```

- [ ] **Step 4: Manual verification**

`cd frontend && npm run build` — confirm no errors (this component isn't wired into `Tasks.jsx` yet — that's Task 9 — so this is a compile-only check).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/tasks/TaskFilterBar.jsx frontend/src/i18n/tr.json frontend/src/i18n/en.json frontend/src/index.css
git commit -m "feat: add shared task filter bar component"
```

---

### Task 7: Task History (archive) table

**Files:**
- Create: `frontend/src/components/tasks/TaskHistory.jsx`
- Modify: `frontend/src/i18n/tr.json`, `frontend/src/i18n/en.json`

**Interfaces:**
- Produces: `<TaskHistory tasks={tasks} />` — expects the already-filtered task list (whatever the shared filter bar produced), renders only `status === 'done'` ones as a table, no separate fetch.

- [ ] **Step 1: Add i18n keys**

In both `tr.json` and `en.json`, inside `"tasks"`, add:
```json
    "history": {
      "id": "Kimlik",
      "assignedBy": "Atayan",
      "completedDate": "Tamamlanma Tarihi",
      "empty": "Tamamlanmış görev yok."
    }
```
(English equivalent in `en.json`: `"id": "ID", "assignedBy": "Assigned By", "completedDate": "Completed Date", "empty": "No completed tasks."`)

- [ ] **Step 2: Create the component**

```jsx
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
```

No new CSS needed — `.table-container`/`.data-table` already exist and are used the same way in `UserManagement.jsx`.

- [ ] **Step 3: Manual verification**

`cd frontend && npm run build` — confirm no errors (compile-only check, wiring happens in Task 9).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/tasks/TaskHistory.jsx frontend/src/i18n/tr.json frontend/src/i18n/en.json
git commit -m "feat: add task history archive table component"
```

---

### Task 8: Activity heatmap component

**Files:**
- Create: `frontend/src/components/tasks/TaskHeatmap.jsx`
- Modify: `frontend/src/i18n/tr.json`, `frontend/src/i18n/en.json`
- Modify: `frontend/src/index.css`

**Interfaces:**
- Consumes: `getActivityHeatmap(params)` (Task 3).
- Produces: `<TaskHeatmap getActivityHeatmap={fn} department={filters.department} assigneeId={filters.assigneeId} />`.

- [ ] **Step 1: Add i18n keys**

In both `tr.json`/`en.json`, inside `"tasks"`, add:
```json
    "heatmap": {
      "title": "Aktivite Isı Haritası",
      "tooltip": "{date}: {total} görev güncellendi"
    }
```
(English: `"title": "Activity Heatmap", "tooltip": "{date}: {total} tasks updated"`)

- [ ] **Step 2: Create the component**

```jsx
// frontend/src/components/tasks/TaskHeatmap.jsx
import { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';

function last365Days() {
  const days = [];
  const today = new Date();
  for (let i = 364; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function intensityClass(total) {
  if (!total) return 'heatmap-cell-0';
  if (total >= 4) return 'heatmap-cell-4';
  if (total >= 3) return 'heatmap-cell-3';
  if (total >= 2) return 'heatmap-cell-2';
  return 'heatmap-cell-1';
}

const STATUS_LABEL_KEY = { todo: 'tasks.status.todo', in_progress: 'tasks.status.in_progress', in_review: 'tasks.status.in_review', done: 'tasks.status.done' };

const TaskHeatmap = ({ getActivityHeatmap, department, assigneeId }) => {
  const { t } = useLanguage();
  const [byDate, setByDate] = useState({});

  useEffect(() => {
    let cancelled = false;
    const params = {};
    if (department) params.department = department;
    if (assigneeId) params.userId = assigneeId;
    getActivityHeatmap(params).then((rows) => {
      if (cancelled) return;
      const map = {};
      rows.forEach((row) => { map[row.date] = row; });
      setByDate(map);
    });
    return () => { cancelled = true; };
  }, [getActivityHeatmap, department, assigneeId]);

  const days = last365Days();

  return (
    <div className="task-heatmap">
      <h3>{t('tasks.heatmap.title')}</h3>
      <div className="task-heatmap-grid">
        {days.map((date) => {
          const entry = byDate[date];
          const total = entry?.total || 0;
          const breakdown = entry
            ? Object.entries(entry.byStatus).map(([status, count]) => `${count} ${t(STATUS_LABEL_KEY[status])}`).join(', ')
            : '';
          const title = t('tasks.heatmap.tooltip', { date, total }) + (breakdown ? ` (${breakdown})` : '');
          return <div key={date} className={`heatmap-cell ${intensityClass(total)}`} title={title} />;
        })}
      </div>
    </div>
  );
};

export default TaskHeatmap;
```

Note: `t(key, params)` interpolation — check `useLanguage`'s `t` function signature in `frontend/src/context/LanguageContext.jsx` before wiring this; if it doesn't support a `{date}`/`{total}` placeholder substitution today, replace the `title` line with plain string concatenation instead: `` `${date}: ${total} görev güncellendi` `` (skip the i18n key's placeholder syntax, keep the key only for the static parts, or drop the `tooltip` i18n key entirely and hardcode the two locales' sentence directly in the component). Use your judgment based on what `t` actually supports — don't guess.

- [ ] **Step 3: Add CSS**

Append to `frontend/src/index.css`:
```css
.task-heatmap-grid {
  display: grid;
  grid-template-columns: repeat(53, 1fr);
  gap: 3px;
  margin-top: var(--space-md);
}

.heatmap-cell {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 2px;
  background: var(--bg-elevated);
}

.heatmap-cell-1 { background: rgba(124, 92, 252, 0.25); }
.heatmap-cell-2 { background: rgba(124, 92, 252, 0.5); }
.heatmap-cell-3 { background: rgba(124, 92, 252, 0.75); }
.heatmap-cell-4 { background: var(--accent-primary); }
```

- [ ] **Step 4: Manual verification**

`cd frontend && npm run build` — confirm no errors (compile-only, wiring happens in Task 9).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/tasks/TaskHeatmap.jsx frontend/src/i18n/tr.json frontend/src/i18n/en.json frontend/src/index.css
git commit -m "feat: add activity heatmap component"
```

---

### Task 9: Wire everything into `Tasks.jsx`

**Files:**
- Modify: `frontend/src/pages/Tasks.jsx`
- Modify: `frontend/src/i18n/tr.json`, `frontend/src/i18n/en.json`

**Interfaces:**
- Consumes: everything from Tasks 3–8 (`applyTaskFilters`, `getActivityHeatmap`, `TaskFilterBar`, `TaskHistory`, `TaskHeatmap`).

- [ ] **Step 1: Add i18n keys for the tabs**

In both `tr.json`/`en.json`, inside `"tasks"`, add:
```json
    "tabs": {
      "board": "Aktif Pano",
      "history": "Görev Geçmişi",
      "heatmap": "Aktivite Isı Haritası"
    }
```
(English: `"board": "Active Board", "history": "Task History", "heatmap": "Activity Heatmap"`)

- [ ] **Step 2: Rewrite `Tasks.jsx`**

```jsx
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

      <TaskFilterBar tasks={tasks} filters={filters} onChange={setFilters} />

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
```

- [ ] **Step 3: Add tab-row CSS**

Append to `frontend/src/index.css` (reuses `.filter-chip`, so only the row wrapper needs a rule):
```css
.task-tabs {
  display: flex;
  gap: var(--space-sm);
  margin-bottom: var(--space-md);
}
```

- [ ] **Step 4: Manual verification**

`cd frontend && npm run build` — confirm no errors. Full behavioral verification happens in Task 10.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Tasks.jsx frontend/src/i18n/tr.json frontend/src/i18n/en.json frontend/src/index.css
git commit -m "feat: wire tabs, filter bar, history, and heatmap into Tasks page"
```

---

### Task 10: End-to-end manual verification

**Files:** none (verification only)

- [ ] **Step 1: Full live walkthrough**

With both `backend` and `frontend` running, log in as an existing department-lead or super_admin user and on `/tasks`:

1. Confirm 3 tabs render (Aktif Pano / Görev Geçmişi / Aktivite Isı Haritası) and switching between them works.
2. On **Aktif Pano**: confirm task cards show a colored avatar circle + role badge next to the assignee. Confirm any `done` task is visible only if completed within the last 7 days (use an existing seeded `done` task, or move one to `done` and confirm it appears; then check an older one is hidden if the seed data has one, or temporarily backdate a task's `updatedAt` via `node -e` to confirm it disappears, then revert).
3. Use the filter bar: pick a department → board/history/heatmap all narrow to that department. Pick an assignee → same. Toggle "Sadece Benim Görevlerim" → only tasks assigned to the logged-in user remain.
4. On **Görev Geçmişi**: confirm a table lists all `status: done` tasks (respecting the active filters), sorted newest-completed-first.
5. On **Aktivite Isı Haritası**: confirm a 365-day grid renders, at least one cell (from any status change made during this session's testing) shows non-zero intensity, and hovering it shows a tooltip with a date and count.
6. Resize the browser below 768px width on the Aktif Pano tab: confirm the 4-column layout collapses into a single column with a horizontal tab selector above it (`Yapılacak (N)` etc.), and tapping a tab switches the visible column with no horizontal overflow.
7. Drag a card you're allowed to act on; confirm the move succeeds and a new entry appears in the heatmap for today.

- [ ] **Step 2: No commit for this task** (verification-only, nothing to add to git).

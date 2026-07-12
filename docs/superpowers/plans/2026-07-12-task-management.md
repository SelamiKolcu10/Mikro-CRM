# Task Management Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a department-scoped, Kanban-style internal task management module to Micro-CRM, per `docs/superpowers/specs/2026-07-12-task-management-design.md`.

**Architecture:** `role` (functional: super_admin/accountant/staff/support/intern) stays untouched. Two new orthogonal `User` fields — `department` (enum) and `isDepartmentLead` (bool) — drive a new `Task` model with a `todo → in_progress → in_review → done` workflow. Visibility/approval scoping lives in one shared `taskScope()` helper (mirrored backend+frontend), never in the coarse role-based permission matrix. Frontend is a Kanban board (`@dnd-kit`) with business logic in a hook/service layer, separate from drag-and-drop components (mobile-port friendly).

**Tech Stack:** Node/Express/Mongoose (backend), React 19 + Vite + react-router-dom + axios (frontend), `@dnd-kit` for drag-and-drop (new dependency).

## Global Constraints

- No automated test framework exists in this codebase (confirmed: no jest/mocha in `backend/package.json`, no vitest in `frontend/package.json`). Per user decision, this plan does **not** introduce one — every task's "verify" step is a manual command (curl) or browser walkthrough instead of an automated test run.
- Follow existing patterns exactly: controllers return `{ success, data }` / `{ success: false, error }`; validators use `express-validator` + `handleValidationErrors`; routes are `protect` + `authorize(...)`; audit-worthy writes call `auditService.record(...)`.
- Departments are a fixed code-level enum: `['development', 'design', 'hr', 'marketing']`. No department CRUD UI.
- `Task.department` is set once at creation and is immutable — no reassignment/transfer flow in this plan.
- `assignedBy` on Task is audit metadata only — never used in any authorization check.
- Turkish user-facing strings throughout (error messages, i18n), matching existing files.

---

### Task 1: User model — `department` / `isDepartmentLead` fields + shared constants

**Files:**
- Modify: `backend/models/User.js`
- Modify: `backend/config/permissions.js`

**Interfaces:**
- Produces: `User.department` (`String|null`, enum `DEPARTMENTS`), `User.isDepartmentLead` (`Boolean`), `DEPARTMENTS`, `TASK_PRIORITIES`, `TASK_STATUSES` exported from `backend/config/permissions.js`, and a new `PERMISSIONS.tasks` resource (`read`/`write`/`assign`/`approve`).

- [ ] **Step 1: Add `DEPARTMENTS`, `TASK_PRIORITIES`, `TASK_STATUSES` and the `tasks` permission entry**

Edit `backend/config/permissions.js` — add near the top (after `ALL_ROLES`) and inside `PERMISSIONS`:

```js
const DEPARTMENTS = ['development', 'design', 'hr', 'marketing'];
const TASK_PRIORITIES = ['critical', 'high', 'medium', 'low'];
const TASK_STATUSES = ['todo', 'in_progress', 'in_review', 'done'];
```

Add to the `PERMISSIONS` object (alongside `chat`, before `approvals`):

```js
  // Task modülü — rol seviyesinde sadece kaba bir filtredir (kimi endpoint'e
  // hiç sokmaz). Asıl kural: departman görünürlüğü backend/utils/taskScope.js
  // içinde, "kim oluşturabilir/onaylayabilir" kontrolü ise controller'da
  // isDepartmentLead + department eşleşmesine bakılarak yapılır — bkz.
  // taskController.js. accountant/support/intern departman taşımadığı için
  // pratikte board'ları hep boş görünür, reddedilmezler.
  tasks: {
    read: ALL_ROLES,
    write: [ROLES.SUPER_ADMIN, ROLES.STAFF],
    assign: [ROLES.SUPER_ADMIN, ROLES.STAFF],
    approve: [ROLES.SUPER_ADMIN, ROLES.STAFF],
  },
```

Update the final export line to:

```js
module.exports = { ROLES, ALL_ROLES, PERMISSIONS, OVERRIDABLE_RESOURCES, DEPARTMENTS, TASK_PRIORITIES, TASK_STATUSES };
```

- [ ] **Step 2: Add `department` / `isDepartmentLead` fields to the User schema**

In `backend/models/User.js`, add these fields to the schema object (right after the existing `tokenVersion` field, before the closing `},` of the schema definition — i.e. right before the `{ timestamps: true }` options object):

```js
    // Task modülü için — role'den bağımsız, opsiyonel. Rol "ne yapabilirsin"
    // sorusuna cevap verir, department/isDepartmentLead "hangi ekipte ve ne
    // yetkiyle" sorusuna. Bir kullanıcı aynı anda role:'staff' VE
    // isDepartmentLead:true olabilir.
    department: {
      type: String,
      enum: ['development', 'design', 'hr', 'marketing'],
      default: null,
    },
    isDepartmentLead: {
      type: Boolean,
      default: false,
    },
```

Then add this validation hook right after the existing `userSchema.pre('save', ...)` password-hashing hook (so it reads top-to-bottom: password hash, then this):

```js
// Lider olmak departman gerektirir — department:null + isDepartmentLead:true
// geçersiz bir durumdur (taskScope bu durumda ne yapacağını bilemez).
userSchema.pre('validate', function (next) {
  if (this.isDepartmentLead && !this.department) {
    this.invalidate('department', 'Departman lideri olabilmek için bir departman seçilmelidir.');
  }
  next();
});
```

- [ ] **Step 3: Manual verification**

Run: `node -e "const mongoose=require('mongoose'); require('dotenv').config(); mongoose.connect(process.env.MONGO_URI).then(async()=>{const User=require('./models/User'); const u=new User({name:'Test Lead',email:'test-lead-verify@example.com',password:'password123',role:'staff',isDepartmentLead:true}); try{await u.validate(); console.log('UNEXPECTED: validation passed without department');}catch(e){console.log('OK - rejected as expected:', e.errors.department.message);} process.exit(0);})"` from the `backend/` directory.

Expected output: `OK - rejected as expected: Departman lideri olabilmek için bir departman seçilmelidir.`

- [ ] **Step 4: Commit**

```bash
git add backend/models/User.js backend/config/permissions.js
git commit -m "feat: add department/isDepartmentLead fields and tasks permission entry"
```

---

### Task 2: User department/lead management endpoint (backend)

**Files:**
- Modify: `backend/validators/userValidators.js`
- Modify: `backend/controllers/userController.js`
- Modify: `backend/routes/userRoutes.js`

**Interfaces:**
- Consumes: `DEPARTMENTS` from `backend/config/permissions.js` (Task 1), `user.bumpTokenVersion()` (existing method, `backend/models/User.js:123-125`).
- Produces: `PATCH /api/users/:id/department` — body `{ department: string|null, isDepartmentLead: boolean }` → `{ success: true, data: <User> }`.

- [ ] **Step 1: Add validators**

In `backend/validators/userValidators.js`, change line 2 from:

```js
const { ALL_ROLES, ROLES } = require('../config/permissions');
```

to:

```js
const { ALL_ROLES, ROLES, DEPARTMENTS } = require('../config/permissions');
```

Add this validator array and export it:

```js
const updateUserDepartmentValidators = [
  body('department').optional({ nullable: true }).isIn(DEPARTMENTS).withMessage('Geçersiz departman.'),
  body('isDepartmentLead').optional().isBoolean().withMessage('isDepartmentLead boolean olmalıdır.'),
];
```

Update the final `module.exports` line to include it:

```js
module.exports = { createUserValidators, approveUserValidators, updateUserRoleValidators, rejectUserValidators, updateUserDepartmentValidators };
```

- [ ] **Step 2: Add the controller action**

In `backend/controllers/userController.js`, add this function right after `updateUserRole` (the function ending at line ~230 per the existing file):

```js
/**
 * @route   PATCH /api/users/:id/department
 * @desc    Departman ataması ve/veya lider bayrağını değiştirir. Rol
 *          alanına dokunmaz — department/isDepartmentLead role'den bağımsız.
 */
const updateUserDepartment = async (req, res, next) => {
  try {
    const { department, isDepartmentLead } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Kullanıcı bulunamadı.' });
    }
    const before = { department: user.department, isDepartmentLead: user.isDepartmentLead };

    if (department !== undefined) user.department = department;
    if (isDepartmentLead !== undefined) user.isDepartmentLead = isDepartmentLead;
    user.bumpTokenVersion();
    await user.save();

    await auditService.record({
      req,
      collectionName: 'User',
      documentId: user._id,
      action: 'update',
      before,
      after: { department: user.department, isDepartmentLead: user.isDepartmentLead },
      watchedFields: ['department', 'isDepartmentLead'],
    });

    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};
```

Update the `module.exports` at the bottom of the file to:

```js
module.exports = {
  createUser,
  getAllUsers,
  getPendingUsers,
  getUserById,
  approveUser,
  rejectUser,
  updateUserRole,
  updateUserDepartment,
  deleteUser,
};
```

- [ ] **Step 3: Wire the route**

In `backend/routes/userRoutes.js`, change the two destructured `require` blocks (lines 6-21) to:

```js
const {
  createUserValidators,
  approveUserValidators,
  updateUserRoleValidators,
  rejectUserValidators,
  updateUserDepartmentValidators,
} = require('../validators/userValidators');
const {
  createUser,
  getAllUsers,
  getPendingUsers,
  getUserById,
  approveUser,
  rejectUser,
  updateUserRole,
  updateUserDepartment,
  deleteUser,
} = require('../controllers/userController');
```

Add this line right after the existing `router.patch('/:id/role', updateUserRoleValidators, handleValidationErrors, updateUserRole);` line:

```js
router.patch('/:id/department', updateUserDepartmentValidators, handleValidationErrors, updateUserDepartment);
```

- [ ] **Step 4: Manual verification**

With the backend running (`npm run dev` in `backend/`) and a super_admin JWT (`$TOKEN`) and an existing staff user id (`$USER_ID`):

```bash
curl -X PATCH http://localhost:5000/api/users/$USER_ID/department \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"department":"development","isDepartmentLead":true}'
```

Expected: `200` with `"data": { ..., "department": "development", "isDepartmentLead": true, ... }`. Then, on the same user (still `isDepartmentLead: true` from the previous call), send `{"department":null}` alone (omit `isDepartmentLead`): this trips the Task 1 Mongoose guard on `.save()` since the document would end up `isDepartmentLead: true` with no department. Expected: `400` with `"error": "Departman lideri olabilmek için bir departman seçilmelidir."` (the global `errorHandler.js` maps Mongoose `ValidationError` to status 400).

- [ ] **Step 5: Commit**

```bash
git add backend/validators/userValidators.js backend/controllers/userController.js backend/routes/userRoutes.js
git commit -m "feat: add PATCH /api/users/:id/department endpoint"
```

---

### Task 3: Task model

**Files:**
- Create: `backend/models/Task.js`

**Interfaces:**
- Produces: `Task` Mongoose model — fields `title, description, department, priority, deadline, status, assignedTo (ref User), assignedBy (ref User), createdAt, updatedAt`.

- [ ] **Step 1: Write the model**

```js
const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Başlık zorunludur.'],
      trim: true,
      maxlength: [150, 'Başlık en fazla 150 karakter olabilir.'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, 'Açıklama en fazla 2000 karakter olabilir.'],
      default: '',
    },
    // Oluşturulunca sabitlenir — reassignment/transfer akışı bu modülde yok
    // (bkz. docs/superpowers/specs/2026-07-12-task-management-design.md).
    department: {
      type: String,
      enum: ['development', 'design', 'hr', 'marketing'],
      required: true,
      immutable: true,
    },
    priority: {
      type: String,
      enum: ['critical', 'high', 'medium', 'low'],
      default: 'medium',
    },
    deadline: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['todo', 'in_progress', 'in_review', 'done'],
      default: 'todo',
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Audit/metadata amaçlı — hiçbir yetkilendirme kararında kullanılmaz
    // (bkz. spec Bölüm 2). Onay yetkisi her zaman task.department'ın GÜNCEL
    // liderlerine/super_admin'e bakılarak taskScope üzerinden hesaplanır.
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Task', taskSchema);
```

- [ ] **Step 2: Manual verification**

Run: `node -e "require('dotenv').config(); const mongoose=require('mongoose'); mongoose.connect(process.env.MONGO_URI).then(async()=>{const Task=require('./models/Task'); const t=new Task({title:'Deneme', department:'development', assignedTo:new mongoose.Types.ObjectId(), assignedBy:new mongoose.Types.ObjectId()}); await t.validate(); console.log('OK - valid task, default status:', t.status, 'default priority:', t.priority); process.exit(0);})"` from `backend/`.

Expected: `OK - valid task, default status: todo default priority: medium`

- [ ] **Step 3: Commit**

```bash
git add backend/models/Task.js
git commit -m "feat: add Task model"
```

---

### Task 4: `taskScope` helper (backend)

**Files:**
- Create: `backend/utils/taskScope.js`

**Interfaces:**
- Consumes: a `user` object with `.role`, `.department`, `.isDepartmentLead`, `._id` (shape of `req.user`, set by `backend/middleware/authMiddleware.js`).
- Produces: `taskScope(user)` → a Mongoose-compatible filter object, and `canApproveTask(user, task)` / `canActOnTask(user, task)` boolean helpers used by the controller in Task 5.

- [ ] **Step 1: Write the helper**

```js
const { ROLES } = require('../config/permissions');

/**
 * Departman bazlı görünürlük — izin matrisinde ifade edilemeyen tek yer
 * burasıdır (satır/veri bazlı filtreleme, rol→aksiyon eşlemesi değil).
 * Hem backend controller'ı hem frontend'deki aynası (bkz.
 * frontend/src/utils/taskScope.js) bu kuralı birebir uygular.
 *
 * department:undefined'ı $or'a koymak Mongoose'un undefined alanları
 * query'den silmesi yüzünden "hepsini getir" gibi davranır — bu yüzden
 * department yoksa o dal $or'a hiç eklenmez (departmansız kullanıcı sadece
 * kendine atanmış görevleri görür, ki zaten hiç olamaz çünkü assignedTo hep
 * kendi departmanıyla eşleşmek zorunda — bkz. taskController.createTask).
 */
function taskScope(user) {
  if (user.role === ROLES.SUPER_ADMIN) return {};

  if (user.isDepartmentLead && user.department) {
    return { department: user.department };
  }

  const or = [{ assignedTo: user._id }];
  if (user.department) or.push({ department: user.department });
  return { $or: or };
}

/** in_review -> done onay yetkisi: task'ın GÜNCEL departmanının lideri ya da super_admin. */
function canApproveTask(user, task) {
  if (user.role === ROLES.SUPER_ADMIN) return true;
  return !!(user.isDepartmentLead && user.department && user.department === task.department);
}

/** todo/in_progress/in_review arası serbest geçiş: assignee, lider veya super_admin. */
function canActOnTask(user, task) {
  if (canApproveTask(user, task)) return true;
  return task.assignedTo.toString() === user._id.toString();
}

module.exports = { taskScope, canApproveTask, canActOnTask };
```

- [ ] **Step 2: Manual verification**

Run: `node -e "const {taskScope}=require('./utils/taskScope'); const {Types}=require('mongoose'); const admin={role:'super_admin'}; const lead={role:'staff',isDepartmentLead:true,department:'development',_id:new Types.ObjectId()}; const plain={role:'staff',isDepartmentLead:false,department:'design',_id:new Types.ObjectId()}; const noDept={role:'support',isDepartmentLead:false,department:null,_id:new Types.ObjectId()}; console.log('admin:',JSON.stringify(taskScope(admin))); console.log('lead:',JSON.stringify(taskScope(lead))); console.log('plain:',JSON.stringify(taskScope(plain))); console.log('noDept:',JSON.stringify(taskScope(noDept)));"` from `backend/`.

Expected:
```
admin: {}
lead: {"department":"development"}
plain: {"$or":[{"assignedTo":"<id>"},{"department":"design"}]}
noDept: {"$or":[{"assignedTo":"<id>"}]}
```
(confirms the department-less user does NOT get a broad match — the security fix this helper exists for)

- [ ] **Step 3: Commit**

```bash
git add backend/utils/taskScope.js
git commit -m "feat: add taskScope authorization/visibility helper"
```

---

### Task 5: Task controller, validators, routes

**Files:**
- Create: `backend/validators/taskValidators.js`
- Create: `backend/controllers/taskController.js`
- Create: `backend/routes/taskRoutes.js`
- Modify: `backend/server.js`

**Interfaces:**
- Consumes: `Task` model (Task 3), `taskScope`/`canApproveTask`/`canActOnTask` (Task 4), `DEPARTMENTS`/`TASK_PRIORITIES`/`TASK_STATUSES`/`PERMISSIONS`/`ROLES` (Task 1), `User` model.
- Produces: `GET /api/tasks`, `POST /api/tasks`, `PATCH /api/tasks/:id/status`, `GET /api/tasks/assignable-users?department=`.

- [ ] **Step 1: Validators**

```js
const { body, param, query } = require('express-validator');
const { DEPARTMENTS, TASK_PRIORITIES, TASK_STATUSES } = require('../config/permissions');

const createTaskValidators = [
  body('title').trim().isLength({ min: 2, max: 150 }).withMessage('Başlık 2-150 karakter olmalıdır.').escape(),
  body('description').optional({ nullable: true }).trim().isLength({ max: 2000 }).withMessage('Açıklama en fazla 2000 karakter olabilir.').escape(),
  body('department').isIn(DEPARTMENTS).withMessage('Geçersiz departman.'),
  body('priority').optional().isIn(TASK_PRIORITIES).withMessage('Geçersiz öncelik.'),
  body('deadline').optional({ nullable: true }).isISO8601().withMessage('Geçersiz tarih.'),
  body('assignedTo').isMongoId().withMessage('Geçersiz kullanıcı kimliği.'),
];

const taskIdValidators = [
  param('id').isMongoId().withMessage('Geçersiz görev kimliği.'),
];

const updateTaskStatusValidators = [
  param('id').isMongoId().withMessage('Geçersiz görev kimliği.'),
  body('status').isIn(TASK_STATUSES).withMessage('Geçersiz durum.'),
];

const assignableUsersValidators = [
  query('department').optional().isIn(DEPARTMENTS).withMessage('Geçersiz departman.'),
];

module.exports = { createTaskValidators, taskIdValidators, updateTaskStatusValidators, assignableUsersValidators };
```

- [ ] **Step 2: Controller**

```js
const Task = require('../models/Task');
const User = require('../models/User');
const { ROLES, DEPARTMENTS } = require('../config/permissions');
const { taskScope, canApproveTask, canActOnTask } = require('../utils/taskScope');

const TASK_POPULATE = [
  { path: 'assignedTo', select: 'name email department' },
  { path: 'assignedBy', select: 'name email' },
];

/**
 * @route   GET /api/tasks
 */
const getTasks = async (req, res, next) => {
  try {
    const tasks = await Task.find(taskScope(req.user)).populate(TASK_POPULATE).sort({ createdAt: -1 });
    res.json({ success: true, data: tasks });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/tasks/assignable-users?department=development
 * @desc    Görev oluşturma formundaki "kime atansın" listesi. Lider sadece
 *          kendi departmanını, super_admin `department` query'siyle
 *          istediği departmanı sorgulayabilir — userRoutes zaten
 *          super_admin-only olduğu için bu ayrı, dar kapsamlı endpoint var.
 */
const getAssignableUsers = async (req, res, next) => {
  try {
    const isSuperAdmin = req.user.role === ROLES.SUPER_ADMIN;
    if (!isSuperAdmin && !(req.user.isDepartmentLead && req.user.department)) {
      return res.status(403).json({ success: false, error: 'Bu işlem için yetkiniz yok.' });
    }

    const targetDepartment = isSuperAdmin ? req.query.department : req.user.department;
    if (!targetDepartment) {
      return res.status(400).json({ success: false, error: 'Departman belirtilmedi.' });
    }
    if (!isSuperAdmin && targetDepartment !== req.user.department) {
      return res.status(403).json({ success: false, error: 'Sadece kendi departmanınızın üyelerini görebilirsiniz.' });
    }
    if (!DEPARTMENTS.includes(targetDepartment)) {
      return res.status(400).json({ success: false, error: 'Geçersiz departman.' });
    }

    const users = await User.find({ department: targetDepartment, status: 'approved' }).select('name email department');
    res.json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/tasks
 * @desc    Sadece o departmanın lideri veya super_admin oluşturabilir.
 *          department, atanan kullanıcının departmanıyla birebir eşleşmek
 *          zorunda (department oluşturulunca sabitlenir, bkz. Task modeli).
 */
const createTask = async (req, res, next) => {
  try {
    const { title, description, department, priority, deadline, assignedTo } = req.body;

    const isSuperAdmin = req.user.role === ROLES.SUPER_ADMIN;
    const isLeadOfThisDepartment = req.user.isDepartmentLead && req.user.department === department;
    if (!isSuperAdmin && !isLeadOfThisDepartment) {
      return res.status(403).json({ success: false, error: 'Bu departmana görev atama yetkiniz yok.' });
    }

    const assignee = await User.findById(assignedTo).select('department');
    if (!assignee || assignee.department !== department) {
      return res.status(400).json({ success: false, error: 'Atanan kullanıcı bu departmanda değil.' });
    }

    const task = await Task.create({
      title,
      description,
      department,
      priority,
      deadline,
      assignedTo,
      assignedBy: req.user._id,
    });
    await task.populate(TASK_POPULATE);

    res.status(201).json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/tasks/:id/status
 * @desc    todo/in_progress/in_review arası: assignee, lider veya
 *          super_admin. in_review -> done: SADECE task.department'ın GÜNCEL
 *          liderleri veya super_admin (assignedBy hiç kullanılmaz).
 */
const updateTaskStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    const task = await Task.findOne({ _id: req.params.id, ...taskScope(req.user) });
    if (!task) {
      return res.status(404).json({ success: false, error: 'Görev bulunamadı.' });
    }

    const authorized = status === 'done' ? canApproveTask(req.user, task) : canActOnTask(req.user, task);
    if (!authorized) {
      return res.status(403).json({ success: false, error: 'Bu görevi güncelleme yetkiniz yok.' });
    }

    task.status = status;
    await task.save();
    await task.populate(TASK_POPULATE);

    res.json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
};

module.exports = { getTasks, getAssignableUsers, createTask, updateTaskStatus };
```

- [ ] **Step 3: Routes**

```js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/authorize');
const { handleValidationErrors } = require('../middleware/validate');
const {
  createTaskValidators,
  taskIdValidators,
  updateTaskStatusValidators,
  assignableUsersValidators,
} = require('../validators/taskValidators');
const { PERMISSIONS } = require('../config/permissions');
const { getTasks, getAssignableUsers, createTask, updateTaskStatus } = require('../controllers/taskController');

// Görev modülü — super_admin, staff (bkz. config/permissions.js — asıl
// departman/lider kontrolü taskController + taskScope içinde yapılır)
router.use(protect, authorize(...PERMISSIONS.tasks.read));

router.get('/', getTasks);
router.get('/assignable-users', assignableUsersValidators, handleValidationErrors, getAssignableUsers);
router.post('/', authorize(...PERMISSIONS.tasks.write), createTaskValidators, handleValidationErrors, createTask);
router.patch(
  '/:id/status',
  taskIdValidators,
  updateTaskStatusValidators,
  handleValidationErrors,
  updateTaskStatus
);

module.exports = router;
```

- [ ] **Step 4: Register the route in `server.js`**

Add this line in `backend/server.js` next to the other `app.use('/api/...', ...)` lines (e.g. right after `app.use('/api/chat', require('./routes/chatRoutes'));`):

```js
app.use('/api/tasks', require('./routes/taskRoutes'));
```

- [ ] **Step 5: Manual verification**

With the backend running, a super_admin token `$TOKEN`, and a department-lead user (`department: development`) plus a second `development` staff user to assign to (`$ASSIGNEE_ID`):

```bash
curl http://localhost:5000/api/tasks/assignable-users?department=development -H "Authorization: Bearer $TOKEN"
```
Expected: `200`, list including `$ASSIGNEE_ID`.

```bash
curl -X POST http://localhost:5000/api/tasks -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"title\":\"Test görevi\",\"department\":\"development\",\"assignedTo\":\"$ASSIGNEE_ID\",\"priority\":\"high\"}"
```
Expected: `201`, `data.status === "todo"`. Save the returned `_id` as `$TASK_ID`.

```bash
curl -X PATCH http://localhost:5000/api/tasks/$TASK_ID/status -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"done"}'
```
Expected (as super_admin): `200`, `data.status === "done"`. Then log in as a plain `staff` (not lead, not assignee) in a different department and repeat the same call against `$TASK_ID` — expected `404` (out of scope, never sees the task at all).

- [ ] **Step 6: Commit**

```bash
git add backend/validators/taskValidators.js backend/controllers/taskController.js backend/routes/taskRoutes.js backend/server.js
git commit -m "feat: add task CRUD/status API"
```

---

### Task 6: Frontend config mirror + UserManagement department/lead UI

**Files:**
- Modify: `frontend/src/config/permissions.js`
- Modify: `frontend/src/services/userService.js`
- Modify: `frontend/src/pages/UserManagement.jsx`
- Modify: `frontend/src/i18n/tr.json`
- Modify: `frontend/src/i18n/en.json`

**Interfaces:**
- Produces: `DEPARTMENTS`, `DEPARTMENT_LABELS` exported from `frontend/src/config/permissions.js`; `userService.updateDepartment(id, { department, isDepartmentLead })`.

- [ ] **Step 1: Mirror the new constants in the frontend permission config**

In `frontend/src/config/permissions.js`, add after `ROLE_LABELS`:

```js
export const DEPARTMENTS = ['development', 'design', 'hr', 'marketing'];

export const DEPARTMENT_LABELS = {
  development: 'departments.development',
  design: 'departments.design',
  hr: 'departments.hr',
  marketing: 'departments.marketing',
};
```

Add to the `PERMISSIONS` object (mirroring the backend exactly):

```js
  tasks: {
    read: ALL_ROLES,
    write: [ROLES.SUPER_ADMIN, ROLES.STAFF],
    assign: [ROLES.SUPER_ADMIN, ROLES.STAFF],
    approve: [ROLES.SUPER_ADMIN, ROLES.STAFF],
  },
```

- [ ] **Step 2: Add the service call**

In `frontend/src/services/userService.js`, add (mirroring the existing `updateRole`):

```js
  updateDepartment: (id, data) => api.patch(`/users/${id}/department`, data),
```

- [ ] **Step 3: Add i18n keys**

In `frontend/src/i18n/tr.json`, add a new top-level `"departments"` object (alongside the existing `"roles"` object) and two new keys under `"users"`:

```json
  "departments": {
    "none": "Departman yok",
    "development": "Geliştirme",
    "design": "Tasarım",
    "hr": "İnsan Kaynakları",
    "marketing": "Pazarlama"
  },
```

Under the existing `"users"` object, add:
```json
    "department": "Departman",
    "isDepartmentLead": "Departman Lideri"
```

Mirror the same structure in `frontend/src/i18n/en.json` with English values (`"development": "Development"`, `"design": "Design"`, `"hr": "HR"`, `"marketing": "Marketing"`, `"none": "No department"`, `"department": "Department"`, `"isDepartmentLead": "Department Lead"`).

- [ ] **Step 4: Add department/lead controls to the UserManagement table**

In `frontend/src/pages/UserManagement.jsx`:

Add the import:
```js
import { DEPARTMENTS, DEPARTMENT_LABELS } from '../config/permissions';
```

Add two handlers right after the existing `handleRoleChange` (`frontend/src/pages/UserManagement.jsx:72-80`), matching its exact toast/refresh pattern:

```js
  const handleDepartmentChange = async (id, department) => {
    try {
      await userService.updateDepartment(id, { department: department || null });
      toast.success(t('common.update') + ' ✅');
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.error'));
    }
  };

  const handleLeadToggle = async (id, isDepartmentLead) => {
    try {
      await userService.updateDepartment(id, { isDepartmentLead });
      toast.success(t('common.update') + ' ✅');
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.error'));
    }
  };
```

Add two new `<th>` header cells next to the existing `<th>{t('users.role')}</th>`:
```jsx
                <th>{t('users.department')}</th>
                <th>{t('users.isDepartmentLead')}</th>
```

Add corresponding `<td>` cells next to the existing role `<select>` cell (same row, same `u` loop variable):
```jsx
                      <td>
                        <select
                          className="form-select compact"
                          value={u.department || ''}
                          onChange={(e) => handleDepartmentChange(u._id, e.target.value)}
                        >
                          <option value="">{t('departments.none')}</option>
                          {DEPARTMENTS.map((dept) => (
                            <option key={dept} value={dept}>{t(DEPARTMENT_LABELS[dept])}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={!!u.isDepartmentLead}
                          onChange={(e) => handleLeadToggle(u._id, e.target.checked)}
                        />
                      </td>
```

- [ ] **Step 5: Manual verification**

Start the frontend (`npm run dev` in `frontend/`), log in as `super_admin`, open `/users`, pick a staff user, set their department to "Geliştirme" via the new dropdown, check the lead checkbox. Confirm no console error and (after a page refresh) the dropdown/checkbox retain the saved values.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/config/permissions.js frontend/src/services/userService.js frontend/src/pages/UserManagement.jsx frontend/src/i18n/tr.json frontend/src/i18n/en.json
git commit -m "feat: add department/lead management UI to UserManagement"
```

---

### Task 7: Frontend `taskScope` mirror + `taskService` + `useTasks` hook

**Files:**
- Create: `frontend/src/utils/taskScope.js`
- Create: `frontend/src/services/taskService.js`
- Create: `frontend/src/hooks/useTasks.js`

**Interfaces:**
- Produces: `canApproveTask(user, task)`, `canActOnTask(user, task)` (frontend mirror of Task 4, used for disabling drag targets in Task 8); `taskService.{getAll, create, updateStatus, getAssignableUsers}`; `useTasks()` hook → `{ tasks, loading, error, createTask, updateTaskStatus, refresh }`.

- [ ] **Step 1: Frontend `taskScope` mirror**

```js
import { ROLES } from '../config/permissions';

/**
 * UI tarafı aynası — backend/utils/taskScope.js ile birebir aynı kural.
 * Burada veri filtrelemek için değil, "bu sürükleme/aksiyon bu kullanıcı
 * için gösterilsin mi" kararı için kullanılır; gerçek yetki her zaman
 * backend'de zorlanır.
 */
export function canApproveTask(user, task) {
  if (!user || !task) return false;
  if (user.role === ROLES.SUPER_ADMIN) return true;
  return !!(user.isDepartmentLead && user.department && user.department === task.department);
}

export function canActOnTask(user, task) {
  if (!user || !task) return false;
  if (canApproveTask(user, task)) return true;
  return task.assignedTo?._id === user._id || task.assignedTo === user._id;
}
```

- [ ] **Step 2: `taskService`**

```js
import api from './api';

const taskService = {
  getAll: () => api.get('/tasks'),
  create: (data) => api.post('/tasks', data),
  updateStatus: (id, status) => api.patch(`/tasks/${id}/status`, { status }),
  getAssignableUsers: (department) => api.get('/tasks/assignable-users', { params: department ? { department } : {} }),
};

export default taskService;
```

- [ ] **Step 3: `useTasks` hook**

```js
import { useState, useEffect, useCallback } from 'react';
import taskService from '../services/taskService';

/**
 * Tüm task veri/iş mantığı burada yaşar — Tasks.jsx ve alt bileşenleri
 * (TaskBoard/TaskColumn/TaskCard) sadece görüntüleme + sürükle-bırak
 * yapar, hiçbiri doğrudan taskService'e dokunmaz. Bu ayrım, mobil
 * (React Native) porta ileride bu hook'un aynen taşınabilmesi içindir.
 */
export function useTasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await taskService.getAll();
      setTasks(res.data.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Görevler yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createTask = useCallback(async (payload) => {
    const res = await taskService.create(payload);
    setTasks((prev) => [res.data.data, ...prev]);
    return res.data.data;
  }, []);

  const updateTaskStatus = useCallback(async (id, status) => {
    const res = await taskService.updateStatus(id, status);
    setTasks((prev) => prev.map((t) => (t._id === id ? res.data.data : t)));
    return res.data.data;
  }, []);

  return { tasks, loading, error, createTask, updateTaskStatus, refresh };
}
```

- [ ] **Step 4: Manual verification**

This hook has no UI yet — verification happens end-to-end in Task 8's step. Skip standalone verification here; proceed directly to commit (the code is inert without a consumer, so there's nothing to exercise in isolation).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/taskScope.js frontend/src/services/taskService.js frontend/src/hooks/useTasks.js
git commit -m "feat: add frontend taskScope mirror, taskService, useTasks hook"
```

---

### Task 8: Kanban board UI

**Files:**
- Modify: `frontend/package.json` (add `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`)
- Create: `frontend/src/components/tasks/TaskCard.jsx`
- Create: `frontend/src/components/tasks/TaskColumn.jsx`
- Create: `frontend/src/components/tasks/TaskBoard.jsx`
- Create: `frontend/src/pages/Tasks.jsx`

**Interfaces:**
- Consumes: `useTasks()` (Task 7), `canApproveTask`/`canActOnTask` (Task 7), `useAuth()` (existing), `PermissionGate` (existing).
- Produces: `<Tasks />` page component (wired into routing in Task 10).

- [ ] **Step 1: Install the drag-and-drop library**

```bash
cd frontend && npm install @dnd-kit/core @dnd-kit/utilities
```

- [ ] **Step 2: `TaskCard`**

```jsx
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useLanguage } from '../../context/LanguageContext';

const PRIORITY_CLASS = { critical: 'badge-critical', high: 'badge-high', medium: 'badge-medium', low: 'badge-low' };

const TaskCard = ({ task, draggable }) => {
  const { t } = useLanguage();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task._id,
    disabled: !draggable,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    cursor: draggable ? 'grab' : 'default',
  };

  return (
    <div ref={setNodeRef} style={style} {...(draggable ? listeners : {})} {...(draggable ? attributes : {})} className="task-card">
      <div className="task-card-header">
        <span className={`badge ${PRIORITY_CLASS[task.priority]}`}>{t(`tasks.priority.${task.priority}`)}</span>
      </div>
      <h4>{task.title}</h4>
      {task.description && <p className="task-card-description">{task.description}</p>}
      <div className="task-card-footer">
        <span>{task.assignedTo?.name}</span>
        {task.deadline && <span>{new Date(task.deadline).toLocaleDateString()}</span>}
      </div>
    </div>
  );
};

export default TaskCard;
```

- [ ] **Step 3: `TaskColumn`**

```jsx
import { useDroppable } from '@dnd-kit/core';
import { useLanguage } from '../../context/LanguageContext';
import TaskCard from './TaskCard';

const TaskColumn = ({ status, tasks, canDropHere }) => {
  const { t } = useLanguage();
  const { setNodeRef, isOver } = useDroppable({ id: status, disabled: !canDropHere });

  return (
    <div ref={setNodeRef} className={`task-column ${isOver && canDropHere ? 'task-column-over' : ''}`}>
      <h3>{t(`tasks.status.${status}`)} <span className="task-column-count">{tasks.length}</span></h3>
      <div className="task-column-body">
        {tasks.map((task) => (
          <TaskCard key={task._id} task={task} draggable={task._canAct} />
        ))}
      </div>
    </div>
  );
};

export default TaskColumn;
```

- [ ] **Step 4: `TaskBoard`**

```jsx
import { DndContext } from '@dnd-kit/core';
import TaskColumn from './TaskColumn';
import { useAuth } from '../../context/AuthContext';
import { canActOnTask, canApproveTask } from '../../utils/taskScope';

const STATUSES = ['todo', 'in_progress', 'in_review', 'done'];

/**
 * Sürükle-bırak sadece burada yaşar — veri/iş mantığı (useTasks) bu
 * bileşenden tamamen ayrı, DOM'a bağımlı değil (mobil port hedefi).
 */
const TaskBoard = ({ tasks, onStatusChange }) => {
  const { user } = useAuth();

  const tasksByStatus = STATUSES.reduce((acc, status) => {
    acc[status] = tasks
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
      <div className="task-board">
        {STATUSES.map((status) => (
          <TaskColumn
            key={status}
            status={status}
            tasks={tasksByStatus[status]}
            canDropHere={status !== 'done' || canApproveTask(user, { department: user?.department })}
          />
        ))}
      </div>
    </DndContext>
  );
};

export default TaskBoard;
```

- [ ] **Step 5: `Tasks` page**

```jsx
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
```

> **Note for the implementer:** this page deliberately has no "create task" button yet — that lands in Task 9. Wiring it into routing/nav happens in Task 10. Until then this component has no route pointing at it, so browser verification isn't possible yet; skip to the commit step.

- [ ] **Step 6: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/components/tasks frontend/src/pages/Tasks.jsx
git commit -m "feat: add Kanban TaskBoard/TaskColumn/TaskCard and Tasks page"
```

---

### Task 9: Create Task modal

**Files:**
- Create: `frontend/src/components/tasks/CreateTaskModal.jsx`
- Modify: `frontend/src/pages/Tasks.jsx`

**Interfaces:**
- Consumes: `Modal` (existing, `frontend/src/components/common/Modal.jsx`), `taskService.getAssignableUsers` (Task 7), `useTasks().createTask` (Task 7), `DEPARTMENTS`/`DEPARTMENT_LABELS` (Task 6).

- [ ] **Step 1: `CreateTaskModal`**

```jsx
import { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { DEPARTMENTS, DEPARTMENT_LABELS, ROLES } from '../../config/permissions';
import taskService from '../../services/taskService';
import toast from 'react-hot-toast';

const initialForm = { title: '', description: '', department: '', priority: 'medium', deadline: '', assignedTo: '' };

const CreateTaskModal = ({ isOpen, onClose, onCreate }) => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === ROLES.SUPER_ADMIN;

  const [form, setForm] = useState(initialForm);
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // Lider için departman zaten sabit — kendi departmanı. super_admin
  // formdan seçer.
  useEffect(() => {
    if (!isOpen) return;
    setForm({ ...initialForm, department: isSuperAdmin ? '' : user?.department || '' });
    setAssignableUsers([]);
  }, [isOpen, isSuperAdmin, user?.department]);

  useEffect(() => {
    if (!form.department) {
      setAssignableUsers([]);
      return;
    }
    taskService.getAssignableUsers(form.department)
      .then((res) => setAssignableUsers(res.data.data))
      .catch(() => setAssignableUsers([]));
  }, [form.department]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onCreate({
        ...form,
        deadline: form.deadline || null,
        description: form.description || undefined,
      });
      toast.success(t('tasks.createSuccess'));
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('tasks.createTitle')}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
          <button type="submit" form="create-task-form" className="btn btn-primary" disabled={submitting}>
            {t('common.save')}
          </button>
        </>
      }
    >
      <form id="create-task-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">{t('tasks.form.title')} *</label>
          <input
            className="form-input"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            minLength={2}
            maxLength={150}
            required
          />
        </div>
        <div className="form-group">
          <label className="form-label">{t('tasks.form.description')}</label>
          <textarea
            className="form-input"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            maxLength={2000}
          />
        </div>
        <div className="form-group">
          <label className="form-label">{t('tasks.form.department')} *</label>
          <select
            className="form-select"
            value={form.department}
            onChange={(e) => setForm({ ...form, department: e.target.value, assignedTo: '' })}
            disabled={!isSuperAdmin}
            required
          >
            <option value="" disabled>{t('tasks.form.selectDepartment')}</option>
            {DEPARTMENTS.map((dept) => (
              <option key={dept} value={dept}>{t(DEPARTMENT_LABELS[dept])}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">{t('tasks.form.assignedTo')} *</label>
          <select
            className="form-select"
            value={form.assignedTo}
            onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
            required
          >
            <option value="" disabled>{t('tasks.form.selectAssignee')}</option>
            {assignableUsers.map((u) => (
              <option key={u._id} value={u._id}>{u.name}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">{t('tasks.form.priority')}</label>
          <select
            className="form-select"
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value })}
          >
            {['critical', 'high', 'medium', 'low'].map((p) => (
              <option key={p} value={p}>{t(`tasks.priority.${p}`)}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">{t('tasks.form.deadline')}</label>
          <input
            type="date"
            className="form-input"
            value={form.deadline}
            onChange={(e) => setForm({ ...form, deadline: e.target.value })}
          />
        </div>
      </form>
    </Modal>
  );
};

export default CreateTaskModal;
```

- [ ] **Step 2: Wire it into `Tasks.jsx`**

Update `frontend/src/pages/Tasks.jsx` to add the "create task" button (gated to `isDepartmentLead` or `super_admin`) and the modal:

```jsx
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
```

- [ ] **Step 3: Add i18n keys**

In `frontend/src/i18n/tr.json`, add a new top-level `"tasks"` object:

```json
  "tasks": {
    "title": "Görevler",
    "subtitle": "Departmanınıza ait görevleri takip edin",
    "createTitle": "Görev Oluştur",
    "createSuccess": "Görev oluşturuldu.",
    "status": {
      "todo": "Yapılacak",
      "in_progress": "Yapılıyor",
      "in_review": "İncelemede",
      "done": "Tamamlandı"
    },
    "priority": {
      "critical": "Kritik",
      "high": "Yüksek",
      "medium": "Orta",
      "low": "Düşük"
    },
    "form": {
      "title": "Başlık",
      "description": "Açıklama",
      "department": "Departman",
      "selectDepartment": "Departman seçin",
      "assignedTo": "Atanan Kişi",
      "selectAssignee": "Kişi seçin",
      "priority": "Öncelik",
      "deadline": "Bitiş Tarihi"
    }
  },
```

Mirror the same structure with English strings in `frontend/src/i18n/en.json`.

- [ ] **Step 4: Manual verification**

(Deferred to Task 10 — the page has no route yet.)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/tasks/CreateTaskModal.jsx frontend/src/pages/Tasks.jsx frontend/src/i18n/tr.json frontend/src/i18n/en.json
git commit -m "feat: add create-task modal"
```

---

### Task 10: Navigation, routing, and end-to-end verification

**Files:**
- Modify: `frontend/src/config/navigation.js`
- Modify: `frontend/src/App.jsx`

**Interfaces:**
- Produces: `/tasks` route reachable from the sidebar for `super_admin`/`staff`.

- [ ] **Step 1: Add the nav item**

In `frontend/src/config/navigation.js`, add the import:
```js
import { HiOutlineViewBoards } from 'react-icons/hi';
```

Add a new item to the `main` section's `items` array (right after the `/feedbacks` entry):
```js
      { path: '/tasks', icon: HiOutlineViewBoards, labelKey: 'nav.tasks', roles: [ROLES.SUPER_ADMIN, ROLES.STAFF] },
```

- [ ] **Step 2: Add the `nav.tasks` i18n key**

In `frontend/src/i18n/tr.json`, add `"tasks": "Görevler"` inside the existing `"nav"` object. Mirror in `frontend/src/i18n/en.json` with `"tasks": "Tasks"`.

- [ ] **Step 3: Register the route**

In `frontend/src/App.jsx`, add the import:
```js
import Tasks from './pages/Tasks';
```

Add the route inside the staff-app `<Route>` block (right after the `/feedbacks` route):
```jsx
              <Route path="/tasks" element={
                <RoleGuard allow={[ROLES.SUPER_ADMIN, ROLES.STAFF]}><Tasks /></RoleGuard>
              } />
```

- [ ] **Step 4: End-to-end manual verification**

With both backend (`npm run dev` in `backend/`) and frontend (`npm run dev` in `frontend/`) running:

1. Log in as `super_admin`. Go to `/users`, set a staff user (User A) to `department: development, isDepartmentLead: true`, and another staff user (User B) to `department: development` (no lead).
2. Navigate to `/tasks` (should now appear in the sidebar under "main"). Click "Görev Oluştur", pick department "Geliştirme", assignee User B, submit. Confirm the card appears in the "Yapılacak" column.
3. Log out, log in as User B. Confirm the same task is visible on `/tasks`. Drag it from "Yapılacak" to "İncelemede" — confirm it moves. Attempt to drag it to "Tamamlandı" — confirm the drop is rejected (card stays in place, since User B is not a lead).
4. Log out, log in as User A (the lead). Confirm the task shows in "İncelemede". Drag it to "Tamamlandı" — confirm it moves and stays after a page refresh.
5. Log in as a `staff` user in a different department (or `support`/`accountant`) — confirm `/tasks` either doesn't appear in nav (for support/accountant, since nav `roles` excludes them) or shows an empty board (for a staff in a different department, since `taskScope` excludes it).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/config/navigation.js frontend/src/App.jsx frontend/src/i18n/tr.json frontend/src/i18n/en.json
git commit -m "feat: wire up /tasks route and navigation"
```

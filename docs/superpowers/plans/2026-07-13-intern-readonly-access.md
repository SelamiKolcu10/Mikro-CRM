# Intern Read-Only Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the `intern` role to read-only access across nearly every panel (Users, Audit Log, Approvals, Access Control Matrix, Chat, Spending Report, cross-department Tasks) while keeping Invoices fully closed and masking employee email addresses server-side, per `docs/superpowers/specs/2026-07-12-intern-readonly-access-design.md`.

**Architecture:** Extend the existing single-source-of-truth `PERMISSIONS` matrix (backend + frontend mirror) with `INTERN` added to `read` actions on the newly-opened resources, plus a new `permissionOverrides` resource. Split each affected route file's blanket `authorize('super_admin')` into per-route read/write authorization. A single shared backend utility+middleware masks `email`/`actorEmail` fields in any response for intern requests — never a frontend-only hide, since that wouldn't stop a real API response from leaking the value. Frontend pages that had zero read-only concept before (they were 100% super_admin-gated) get `PermissionGate`-wrapped action controls, and two data-displaying controls (role/department selects, override checkboxes) get a plain-text/disabled fallback instead of disappearing — so intern still sees the data, just can't change it.

**Tech Stack:** Existing Node/Express/Mongoose backend, React frontend — no new dependencies.

## Global Constraints

- No automated test framework exists in this codebase — every task's "verify" step is a manual command (curl / `node -e`) or browser walkthrough, per the established project convention.
- Only `email` and `actorEmail` fields are masked (as `'******'`) for intern — name, role, department, status, and every other field stay visible unchanged.
- Masking happens **only** server-side (the middleware described in Task 2) — the frontend must never rely on hiding a real value it already received.
- `invoices` (and `invoices-v2`, which shares the same `PERMISSIONS.invoices` entry) is **not** touched anywhere in this plan — intern must stay fully excluded.
- Turkish user-facing strings, matching existing files. No new i18n keys are needed anywhere in this plan (every label used already exists).

---

### Task 1: Permission matrix — backend + frontend

**Files:**
- Modify: `backend/config/permissions.js`
- Modify: `frontend/src/config/permissions.js`

**Interfaces:**
- Produces: `PERMISSIONS.users.read`, `.spendingReport.read`, `.auditLog.read`, `.chat.read`, `.approvals.read` now include `ROLES.INTERN`. New resource `PERMISSIONS.permissionOverrides` (`read: [SUPER_ADMIN, INTERN]`, `write: [SUPER_ADMIN]`).

- [ ] **Step 1: Edit `backend/config/permissions.js`**

Change the `users` block:
```js
  users: {
    read: [ROLES.SUPER_ADMIN],
    write: [ROLES.SUPER_ADMIN],
    approve: [ROLES.SUPER_ADMIN],
  },
```
to:
```js
  users: {
    read: [ROLES.SUPER_ADMIN, ROLES.INTERN],
    write: [ROLES.SUPER_ADMIN],
    approve: [ROLES.SUPER_ADMIN],
  },
```

Change the `spendingReport` and `auditLog` blocks:
```js
  spendingReport: {
    read: [ROLES.SUPER_ADMIN, ROLES.ACCOUNTANT],
  },
  auditLog: {
    read: [ROLES.SUPER_ADMIN],
  },
```
to:
```js
  spendingReport: {
    read: [ROLES.SUPER_ADMIN, ROLES.ACCOUNTANT, ROLES.INTERN],
  },
  auditLog: {
    read: [ROLES.SUPER_ADMIN, ROLES.INTERN],
  },
```

Change the `chat` block (including its now-outdated comment):
```js
  // Live customer chat — a separate channel from `feedbacks` (support
  // tickets). Intern is deliberately excluded: unlike knowledge base/tickets
  // (read-only for them), unsupervised live back-and-forth with a customer
  // is a bigger blast radius for a trainee account.
  chat: {
    read: [ROLES.SUPER_ADMIN, ROLES.STAFF, ROLES.SUPPORT],
    write: [ROLES.SUPER_ADMIN, ROLES.STAFF, ROLES.SUPPORT],
    assign: [ROLES.SUPER_ADMIN],
  },
```
to:
```js
  // Live customer chat — a separate channel from `feedbacks` (support
  // tickets). Intern can read (see conversations) but never write — sending
  // messages to a customer stays limited to staff/support/super_admin.
  chat: {
    read: [ROLES.SUPER_ADMIN, ROLES.STAFF, ROLES.SUPPORT, ROLES.INTERN],
    write: [ROLES.SUPER_ADMIN, ROLES.STAFF, ROLES.SUPPORT],
    assign: [ROLES.SUPER_ADMIN],
  },
```

Change the `approvals` block and add a new `permissionOverrides` block right after it (still inside the `PERMISSIONS` object, before the closing `};`):
```js
  // The Pending Approvals queue itself — reviewing/deciding stays
  // super_admin only, regardless of what overrides exist, otherwise a user
  // could grant themselves more access. Reading the queue (who requested
  // what) is opened to intern as part of the read-only visibility rollout.
  approvals: {
    read: [ROLES.SUPER_ADMIN, ROLES.INTERN],
    review: [ROLES.SUPER_ADMIN],
  },
  // Access Control Matrix — granting/revoking a PermissionOverride is always
  // super_admin only (same "no exceptions" rule as before). Reading the
  // matrix (who has what override) is opened to intern.
  permissionOverrides: {
    read: [ROLES.SUPER_ADMIN, ROLES.INTERN],
    write: [ROLES.SUPER_ADMIN],
  },
};
```

Update the final export line to include the new resource is unnecessary — `permissionOverrides` lives inside `PERMISSIONS`, already exported as part of that object. No change to `module.exports` needed.

- [ ] **Step 2: Mirror the exact same edits in `frontend/src/config/permissions.js`**

Apply the identical five block changes (users, spendingReport, auditLog, chat, approvals+permissionOverrides) to this file — same before/after content as Step 1.

- [ ] **Step 3: Manual verification**

Run: `node -e "const {PERMISSIONS} = require('./backend/config/permissions'); console.log(JSON.stringify({users: PERMISSIONS.users, chat: PERMISSIONS.chat, approvals: PERMISSIONS.approvals, permissionOverrides: PERMISSIONS.permissionOverrides}, null, 2))"` from the repo root.

Expected: `users.read` and `chat.read` and `approvals.read` all include `"intern"`; `permissionOverrides` object exists with `read: ["super_admin","intern"]` and `write: ["super_admin"]`.

- [ ] **Step 4: Commit**

```bash
git add backend/config/permissions.js frontend/src/config/permissions.js
git commit -m "feat: open read access to users/auditLog/chat/approvals/permissionOverrides for intern"
```

---

### Task 2: Backend PII redaction utility + middleware

**Files:**
- Create: `backend/utils/redactPII.js`
- Create: `backend/middleware/redactForIntern.js`

**Interfaces:**
- Produces: `redactEmails(data)` (from `redactPII.js`) and the `redactForIntern` Express middleware (from `redactForIntern.js`), both consumed by Task 3's route files.

- [ ] **Step 1: Write the redaction utility**

```js
// backend/utils/redactPII.js

const EMAIL_KEYS = new Set(['email', 'actorEmail']);

/**
 * Cevap gövdesini (iç içe/populate edilmiş nesneler dahil) derinlemesine
 * gezip her `email`/`actorEmail` alanının değerini '******' ile değiştirir.
 * Mongoose belgelerini JSON round-trip ile düz nesneye çevirip öyle gezer —
 * doğrudan Mongoose doküman iç yapısına (getter'lar, _doc vb.) takılmamak
 * için. Sadece intern rolü için çağrılır (bkz. middleware/redactForIntern.js).
 */
function redactEmails(data) {
  const plain = JSON.parse(JSON.stringify(data));

  const walk = (node) => {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (node && typeof node === 'object') {
      for (const key of Object.keys(node)) {
        if (EMAIL_KEYS.has(key) && typeof node[key] === 'string') {
          node[key] = '******';
        } else {
          walk(node[key]);
        }
      }
    }
  };

  walk(plain);
  return plain;
}

module.exports = { redactEmails };
```

- [ ] **Step 2: Write the middleware**

```js
// backend/middleware/redactForIntern.js

const { ROLES } = require('../config/permissions');
const { redactEmails } = require('../utils/redactPII');

/**
 * Sadece intern rolü için: `res.json({..., data})` çağrısındaki `data`
 * alanını göndermeden önce maskeler. Diğer roller hiç etkilenmez — bu route
 * zaten intern dışındaki roller için normal davranır.
 */
const redactForIntern = (req, res, next) => {
  if (!req.user || req.user.role !== ROLES.INTERN) {
    return next();
  }

  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (body && Object.prototype.hasOwnProperty.call(body, 'data')) {
      body.data = redactEmails(body.data);
    }
    return originalJson(body);
  };
  next();
};

module.exports = { redactForIntern };
```

- [ ] **Step 3: Manual verification**

Run: `node -e "const {redactEmails}=require('./backend/utils/redactPII'); const input={data:[{name:'A',email:'a@x.com',nested:{grantedBy:{name:'B',email:'b@x.com'}}},{actorEmail:'c@x.com',changes:[{field:'role',before:'staff',after:'intern'}]}]}; console.log(JSON.stringify(redactEmails(input.data), null, 2))"` from the repo root.

Expected: both `email` values and the `actorEmail` value are `"******"`; `name`, `field`, `before`, `after` values are all unchanged.

- [ ] **Step 4: Commit**

```bash
git add backend/utils/redactPII.js backend/middleware/redactForIntern.js
git commit -m "feat: add email redaction utility and intern response middleware"
```

---

### Task 3: Route authorization — split blanket super_admin gates, wire in redaction

**Files:**
- Modify: `backend/routes/userRoutes.js`
- Modify: `backend/routes/auditRoutes.js`
- Modify: `backend/routes/approvalRoutes.js`
- Modify: `backend/routes/permissionOverrideRoutes.js`

**Interfaces:**
- Consumes: `PERMISSIONS` (Task 1), `redactForIntern` (Task 2).

- [ ] **Step 1: Rewrite `backend/routes/userRoutes.js`**

Replace the entire file content with:
```js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/authorize');
const { handleValidationErrors } = require('../middleware/validate');
const { redactForIntern } = require('../middleware/redactForIntern');
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
const { PERMISSIONS } = require('../config/permissions');

// Kullanıcı yönetimi — okuma: super_admin + intern (e-postalar maskeli),
// yazma/onay: sadece super_admin.
router.use(protect);

router.post('/', authorize(...PERMISSIONS.users.write), createUserValidators, handleValidationErrors, createUser);
router.get('/', authorize(...PERMISSIONS.users.read), redactForIntern, getAllUsers);
router.get('/pending', authorize(...PERMISSIONS.users.read), redactForIntern, getPendingUsers);
router.get('/:id', authorize(...PERMISSIONS.users.read), redactForIntern, getUserById);
router.patch('/:id/approve', authorize(...PERMISSIONS.users.approve), approveUserValidators, handleValidationErrors, approveUser);
router.patch('/:id/reject', authorize(...PERMISSIONS.users.approve), rejectUserValidators, handleValidationErrors, rejectUser);
router.patch('/:id/role', authorize(...PERMISSIONS.users.write), updateUserRoleValidators, handleValidationErrors, updateUserRole);
router.patch('/:id/department', authorize(...PERMISSIONS.users.write), updateUserDepartmentValidators, handleValidationErrors, updateUserDepartment);
router.delete('/:id', authorize(...PERMISSIONS.users.write), deleteUser);

module.exports = router;
```

- [ ] **Step 2: Rewrite `backend/routes/auditRoutes.js`**

Replace the entire file content with:
```js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/authorize');
const { redactForIntern } = require('../middleware/redactForIntern');
const { getAuditLogs, getAuditLog } = require('../controllers/auditController');
const { PERMISSIONS } = require('../config/permissions');

// Denetim kaydı — okuma: super_admin + intern (aktör e-postası maskeli).
router.use(protect);

router.get('/', authorize(...PERMISSIONS.auditLog.read), redactForIntern, getAuditLogs);
router.get('/:id', authorize(...PERMISSIONS.auditLog.read), redactForIntern, getAuditLog);

module.exports = router;
```

- [ ] **Step 3: Rewrite `backend/routes/approvalRoutes.js`**

Replace the entire file content with:
```js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/authorize');
const { handleValidationErrors } = require('../middleware/validate');
const { redactForIntern } = require('../middleware/redactForIntern');
const { rejectApprovalValidators } = require('../validators/approvalValidators');
const { PERMISSIONS } = require('../config/permissions');
const { getApprovals, getMyApprovals, approveRequest, rejectRequest } = require('../controllers/approvalController');

router.use(protect);

// Any authenticated staff user can see their own queued requests.
router.get('/mine', getMyApprovals);

// The full review queue: read opened to intern (e-postalar maskeli), the
// actions themselves (approve/reject) stay super_admin only.
router.get('/', authorize(...PERMISSIONS.approvals.read), redactForIntern, getApprovals);
router.patch('/:id/approve', authorize(...PERMISSIONS.approvals.review), approveRequest);
router.patch('/:id/reject', authorize(...PERMISSIONS.approvals.review), rejectApprovalValidators, handleValidationErrors, rejectRequest);

module.exports = router;
```

- [ ] **Step 4: Rewrite `backend/routes/permissionOverrideRoutes.js`**

Replace the entire file content with:
```js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/authorize');
const { handleValidationErrors } = require('../middleware/validate');
const { redactForIntern } = require('../middleware/redactForIntern');
const { grantOverrideValidators } = require('../validators/permissionOverrideValidators');
const { PERMISSIONS } = require('../config/permissions');
const { getOverrides, grantOverride, revokeOverride } = require('../controllers/permissionOverrideController');

router.use(protect);

// Matrisi okumak (kimde hangi override var) intern'a da açık (e-postalar
// maskeli). Grant/revoke etmek her zaman super_admin only kalıyor — aksi
// halde bir kullanıcı kendine yetki verebilirdi.
router.get('/', authorize(...PERMISSIONS.permissionOverrides.read), redactForIntern, getOverrides);
router.post('/', authorize(...PERMISSIONS.permissionOverrides.write), grantOverrideValidators, handleValidationErrors, grantOverride);
router.delete('/:id', authorize(...PERMISSIONS.permissionOverrides.write), revokeOverride);

module.exports = router;
```

- [ ] **Step 5: Manual verification**

With the backend running (`npm run dev` in `backend/`), an intern JWT (`$INTERN_TOKEN`) and a super_admin JWT (`$ADMIN_TOKEN`):

```bash
curl http://localhost:5000/api/users -H "Authorization: Bearer $INTERN_TOKEN"
```
Expected: `200`, every user object's `"email"` field is `"******"`, other fields (name/role/department/status) unchanged.

```bash
curl -X POST http://localhost:5000/api/users -H "Authorization: Bearer $INTERN_TOKEN" -H "Content-Type: application/json" -d '{"name":"Test","email":"t@t.com","role":"staff"}'
```
Expected: `403` (`Bu işlem için yetkiniz yok.`) — intern cannot create users.

```bash
curl http://localhost:5000/api/audit-logs -H "Authorization: Bearer $INTERN_TOKEN"
```
Expected: `200`, every entry's `"actorEmail"` is `"******"`.

```bash
curl http://localhost:5000/api/permission-overrides -H "Authorization: Bearer $INTERN_TOKEN"
```
Expected: `200`, `user.email`/`grantedBy.email` (where present) are `"******"`.

```bash
curl -X POST http://localhost:5000/api/permission-overrides -H "Authorization: Bearer $INTERN_TOKEN" -H "Content-Type: application/json" -d '{"userId":"000000000000000000000000","resource":"customers","action":"write"}'
```
Expected: `403` — intern cannot grant overrides.

Then repeat the first `GET /api/users` call with `$ADMIN_TOKEN` instead and confirm real email addresses are returned unmasked (proves the middleware only touches intern requests).

- [ ] **Step 6: Commit**

```bash
git add backend/routes/userRoutes.js backend/routes/auditRoutes.js backend/routes/approvalRoutes.js backend/routes/permissionOverrideRoutes.js
git commit -m "feat: split route authorization into read/write, wire intern email redaction"
```

---

### Task 4: Task visibility — intern sees all departments

**Files:**
- Modify: `backend/utils/taskScope.js`

**Interfaces:**
- Produces: `taskScope(user)` returns `{}` for `role === ROLES.INTERN` (in addition to `SUPER_ADMIN`). `canApproveTask`/`canActOnTask` are unchanged.

- [ ] **Step 1: Edit `taskScope`**

Change:
```js
function taskScope(user) {
  if (user.role === ROLES.SUPER_ADMIN) return {};

  if (user.isDepartmentLead && user.department) {
```
to:
```js
function taskScope(user) {
  // Intern: tüm departmanları OKUYABİLİR (super_admin gibi), ama
  // canApproveTask/canActOnTask hiç değişmedi — sadece kendine atanan
  // görevde işlem yapabilir, lider olmadığı için onaylayamaz.
  if (user.role === ROLES.SUPER_ADMIN || user.role === ROLES.INTERN) return {};

  if (user.isDepartmentLead && user.department) {
```

(the rest of the function body is unchanged)

- [ ] **Step 2: Manual verification**

Run: `node -e "const {taskScope}=require('./backend/utils/taskScope'); const {Types}=require('mongoose'); const intern={role:'intern',isDepartmentLead:false,department:'hr',_id:new Types.ObjectId()}; console.log(JSON.stringify(taskScope(intern)));"` from `backend/`.

Expected: `{}` (empty object — sees every department, not just `hr`).

- [ ] **Step 3: Commit**

```bash
git add backend/utils/taskScope.js
git commit -m "feat: give intern cross-department read visibility on tasks"
```

---

### Task 5: Frontend navigation + routing

**Files:**
- Modify: `frontend/src/config/navigation.js`
- Modify: `frontend/src/App.jsx`

**Interfaces:**
- Produces: intern-visible nav items and reachable routes for `/tasks`, `/chat`, `/reports/spending`, `/users`, `/access-control`, `/approvals`, `/audit-log`.

- [ ] **Step 1: Edit `frontend/src/config/navigation.js`**

Change these 7 lines (add `ROLES.INTERN` to each array — `/customers` and `/feedbacks` already include it, leave those two alone):

```js
      { path: '/tasks', icon: HiOutlineViewBoards, labelKey: 'nav.tasks', roles: [ROLES.SUPER_ADMIN, ROLES.STAFF] },
      { path: '/chat', icon: HiOutlineChat, labelKey: 'nav.chat', roles: [ROLES.SUPER_ADMIN, ROLES.STAFF, ROLES.SUPPORT] },
```
to:
```js
      { path: '/tasks', icon: HiOutlineViewBoards, labelKey: 'nav.tasks', roles: [ROLES.SUPER_ADMIN, ROLES.STAFF, ROLES.INTERN] },
      { path: '/chat', icon: HiOutlineChat, labelKey: 'nav.chat', roles: [ROLES.SUPER_ADMIN, ROLES.STAFF, ROLES.SUPPORT, ROLES.INTERN] },
```

```js
      { path: '/reports/spending', icon: HiOutlineChartBar, labelKey: 'nav.spendingReport', roles: [ROLES.SUPER_ADMIN, ROLES.ACCOUNTANT] },
```
to:
```js
      { path: '/reports/spending', icon: HiOutlineChartBar, labelKey: 'nav.spendingReport', roles: [ROLES.SUPER_ADMIN, ROLES.ACCOUNTANT, ROLES.INTERN] },
```

(leave `/invoices` and `/invoices-v2` in the same `finance` section completely untouched)

```js
      { path: '/users', icon: HiOutlineShieldCheck, labelKey: 'nav.users', roles: [ROLES.SUPER_ADMIN], badgeKey: 'pendingUsers' },
      { path: '/access-control', icon: HiOutlineKey, labelKey: 'nav.accessControl', roles: [ROLES.SUPER_ADMIN] },
      { path: '/approvals', icon: HiOutlineClipboardCheck, labelKey: 'nav.approvals', roles: [ROLES.SUPER_ADMIN], badgeKey: 'pendingApprovals' },
      { path: '/audit-log', icon: HiOutlineClipboardList, labelKey: 'nav.auditLog', roles: [ROLES.SUPER_ADMIN] },
```
to:
```js
      { path: '/users', icon: HiOutlineShieldCheck, labelKey: 'nav.users', roles: [ROLES.SUPER_ADMIN, ROLES.INTERN], badgeKey: 'pendingUsers' },
      { path: '/access-control', icon: HiOutlineKey, labelKey: 'nav.accessControl', roles: [ROLES.SUPER_ADMIN, ROLES.INTERN] },
      { path: '/approvals', icon: HiOutlineClipboardCheck, labelKey: 'nav.approvals', roles: [ROLES.SUPER_ADMIN, ROLES.INTERN], badgeKey: 'pendingApprovals' },
      { path: '/audit-log', icon: HiOutlineClipboardList, labelKey: 'nav.auditLog', roles: [ROLES.SUPER_ADMIN, ROLES.INTERN] },
```

- [ ] **Step 2: Edit `frontend/src/App.jsx`**

Change these 7 `RoleGuard allow` arrays (same pattern — add `ROLES.INTERN`, leave `/invoices`/`/invoices-v2` untouched):

```jsx
              <Route path="/tasks" element={
                <RoleGuard allow={[ROLES.SUPER_ADMIN, ROLES.STAFF]}><Tasks /></RoleGuard>
              } />
```
to:
```jsx
              <Route path="/tasks" element={
                <RoleGuard allow={[ROLES.SUPER_ADMIN, ROLES.STAFF, ROLES.INTERN]}><Tasks /></RoleGuard>
              } />
```

```jsx
              <Route path="/reports/spending" element={
                <RoleGuard allow={[ROLES.SUPER_ADMIN, ROLES.ACCOUNTANT]}><SpendingDashboard /></RoleGuard>
              } />
```
to:
```jsx
              <Route path="/reports/spending" element={
                <RoleGuard allow={[ROLES.SUPER_ADMIN, ROLES.ACCOUNTANT, ROLES.INTERN]}><SpendingDashboard /></RoleGuard>
              } />
```

```jsx
              <Route path="/users" element={
                <RoleGuard allow={[ROLES.SUPER_ADMIN]}><UserManagement /></RoleGuard>
              } />
              <Route path="/audit-log" element={
                <RoleGuard allow={[ROLES.SUPER_ADMIN]}><AuditLog /></RoleGuard>
              } />
              <Route path="/chat" element={
                <RoleGuard allow={[ROLES.SUPER_ADMIN, ROLES.STAFF, ROLES.SUPPORT]}><ChatDashboard /></RoleGuard>
              } />
              <Route path="/access-control" element={
                <RoleGuard allow={[ROLES.SUPER_ADMIN]}><AccessControlMatrix /></RoleGuard>
              } />
              <Route path="/approvals" element={
                <RoleGuard allow={[ROLES.SUPER_ADMIN]}><PendingApprovals /></RoleGuard>
              } />
```
to:
```jsx
              <Route path="/users" element={
                <RoleGuard allow={[ROLES.SUPER_ADMIN, ROLES.INTERN]}><UserManagement /></RoleGuard>
              } />
              <Route path="/audit-log" element={
                <RoleGuard allow={[ROLES.SUPER_ADMIN, ROLES.INTERN]}><AuditLog /></RoleGuard>
              } />
              <Route path="/chat" element={
                <RoleGuard allow={[ROLES.SUPER_ADMIN, ROLES.STAFF, ROLES.SUPPORT, ROLES.INTERN]}><ChatDashboard /></RoleGuard>
              } />
              <Route path="/access-control" element={
                <RoleGuard allow={[ROLES.SUPER_ADMIN, ROLES.INTERN]}><AccessControlMatrix /></RoleGuard>
              } />
              <Route path="/approvals" element={
                <RoleGuard allow={[ROLES.SUPER_ADMIN, ROLES.INTERN]}><PendingApprovals /></RoleGuard>
              } />
```

- [ ] **Step 3: Manual verification**

Run `cd frontend && npm run build` and confirm it compiles with no errors (no route/page has been created or removed, only role arrays changed, so a clean build is sufficient here — full behavioral verification happens in Task 10).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/config/navigation.js frontend/src/App.jsx
git commit -m "feat: expose users/auditLog/approvals/accessControl/chat/spendingReport nav+routes to intern"
```

---

### Task 6: Chat — read-only for intern

**Files:**
- Modify: `frontend/src/pages/ChatDashboard.jsx`

**Interfaces:**
- Consumes: `PermissionGate` (already imported in this file), `PERMISSIONS.chat.write` (Task 1 — intern excluded).

- [ ] **Step 1: Wrap the message composer**

Change (around line 348):
```jsx
              <MessageInput onSend={send} disabled={!selectedId} />
```
to:
```jsx
              <PermissionGate resource="chat" action="write">
                <MessageInput onSend={send} disabled={!selectedId} />
              </PermissionGate>
```

- [ ] **Step 2: Manual verification**

Run `cd frontend && npm run build` to confirm no syntax errors. Full behavioral check (intern sees conversations but no message box) happens in Task 10's live walkthrough.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/ChatDashboard.jsx
git commit -m "feat: hide chat message composer from intern"
```

---

### Task 7: UserManagement — read-only treatment for intern

**Files:**
- Modify: `frontend/src/pages/UserManagement.jsx`

**Interfaces:**
- Consumes: `PermissionGate`, `can` (from `frontend/src/config/permissions.js`).

- [ ] **Step 1: Add imports**

Change:
```jsx
import { ALL_ROLES, ROLE_LABELS, DEPARTMENTS, DEPARTMENT_LABELS } from '../config/permissions';
```
to:
```jsx
import { ALL_ROLES, ROLE_LABELS, DEPARTMENTS, DEPARTMENT_LABELS, can } from '../config/permissions';
import PermissionGate from '../components/auth/PermissionGate';
```

- [ ] **Step 2: Gate the "create user" button**

Change:
```jsx
        <button className="btn btn-primary" onClick={() => setCreateModalOpen(true)}>
          <HiOutlinePlus /> {t('users.createUser')}
        </button>
```
to:
```jsx
        <PermissionGate resource="users" action="write">
          <button className="btn btn-primary" onClick={() => setCreateModalOpen(true)}>
            <HiOutlinePlus /> {t('users.createUser')}
          </button>
        </PermissionGate>
```

- [ ] **Step 3: Make the role cell read-only-aware**

Change:
```jsx
                    <td>
                      <select
                        className="form-select compact"
                        value={u.role}
                        disabled={u._id === currentUser._id}
                        onChange={(e) => handleRoleChange(u._id, e.target.value)}
                      >
                        {ALL_ROLES.map((role) => (
                          <option key={role} value={role}>{t(ROLE_LABELS[role])}</option>
                        ))}
                      </select>
                    </td>
```
to:
```jsx
                    <td>
                      {can(currentUser.role, 'users', 'write') ? (
                        <select
                          className="form-select compact"
                          value={u.role}
                          disabled={u._id === currentUser._id}
                          onChange={(e) => handleRoleChange(u._id, e.target.value)}
                        >
                          {ALL_ROLES.map((role) => (
                            <option key={role} value={role}>{t(ROLE_LABELS[role])}</option>
                          ))}
                        </select>
                      ) : (
                        <span>{t(ROLE_LABELS[u.role])}</span>
                      )}
                    </td>
```

- [ ] **Step 4: Make the department cell read-only-aware**

Change:
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
```
to:
```jsx
                    <td>
                      {can(currentUser.role, 'users', 'write') ? (
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
                      ) : (
                        <span>{u.department ? t(DEPARTMENT_LABELS[u.department]) : t('departments.none')}</span>
                      )}
                    </td>
```

- [ ] **Step 5: Make the lead checkbox cell read-only-aware**

Change:
```jsx
                    <td>
                      <input
                        type="checkbox"
                        checked={!!u.isDepartmentLead}
                        onChange={(e) => handleLeadToggle(u._id, e.target.checked)}
                      />
                    </td>
```
to:
```jsx
                    <td>
                      {can(currentUser.role, 'users', 'write') ? (
                        <input
                          type="checkbox"
                          checked={!!u.isDepartmentLead}
                          onChange={(e) => handleLeadToggle(u._id, e.target.checked)}
                        />
                      ) : (
                        <span>{u.isDepartmentLead ? '✓' : '—'}</span>
                      )}
                    </td>
```

- [ ] **Step 6: Gate approve/reject and delete buttons**

Change:
```jsx
                        {u.status === 'pending' && (
                          <>
                            <button className="btn-icon" title={t('users.approve')} onClick={() => handleApprove(u._id)}>
                              <HiOutlineCheck style={{ color: 'var(--color-success)' }} />
                            </button>
                            <button className="btn-icon" title={t('users.reject')} onClick={() => handleReject(u._id)}>
                              <HiOutlineX style={{ color: 'var(--color-danger)' }} />
                            </button>
                          </>
                        )}
                        {u._id !== currentUser._id && (
                          <button className="btn-icon" title={t('common.delete')} onClick={() => setDeleteId(u._id)}>
                            <HiOutlineTrash />
                          </button>
                        )}
```
to:
```jsx
                        {u.status === 'pending' && (
                          <PermissionGate resource="users" action="approve">
                            <button className="btn-icon" title={t('users.approve')} onClick={() => handleApprove(u._id)}>
                              <HiOutlineCheck style={{ color: 'var(--color-success)' }} />
                            </button>
                            <button className="btn-icon" title={t('users.reject')} onClick={() => handleReject(u._id)}>
                              <HiOutlineX style={{ color: 'var(--color-danger)' }} />
                            </button>
                          </PermissionGate>
                        )}
                        {u._id !== currentUser._id && (
                          <PermissionGate resource="users" action="write">
                            <button className="btn-icon" title={t('common.delete')} onClick={() => setDeleteId(u._id)}>
                              <HiOutlineTrash />
                            </button>
                          </PermissionGate>
                        )}
```

- [ ] **Step 7: Manual verification**

Run `cd frontend && npm run build` to confirm no syntax errors. Full behavioral check happens in Task 10.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/pages/UserManagement.jsx
git commit -m "feat: read-only treatment for UserManagement (intern sees data, no controls)"
```

---

### Task 8: PendingApprovals — read-only treatment for intern

**Files:**
- Modify: `frontend/src/pages/PendingApprovals.jsx`

**Interfaces:**
- Consumes: `PermissionGate` (not yet imported in this file).

- [ ] **Step 1: Add the import**

Change:
```jsx
import { HiOutlineCheck, HiOutlineX, HiOutlineExclamation } from 'react-icons/hi';
```
to:
```jsx
import { HiOutlineCheck, HiOutlineX, HiOutlineExclamation } from 'react-icons/hi';
import PermissionGate from '../components/auth/PermissionGate';
```

- [ ] **Step 2: Gate the approve/reject action cell**

Change:
```jsx
                <td>
                  {a.status === 'pending' && (
                    <div className="cell-actions">
                      <button
                        className="btn-icon"
                        onClick={() => handleApprove(a._id)}
                        disabled={busyId === a._id}
                        title={t('approvals.approve')}
                        style={{ color: 'var(--color-success)' }}
                      >
                        <HiOutlineCheck />
                      </button>
                      <button
                        className="btn-icon"
                        onClick={() => openReject(a._id)}
                        disabled={busyId === a._id}
                        title={t('approvals.reject')}
                        style={{ color: 'var(--color-danger)' }}
                      >
                        <HiOutlineX />
                      </button>
                    </div>
                  )}
                </td>
```
to:
```jsx
                <td>
                  {a.status === 'pending' && (
                    <PermissionGate resource="approvals" action="review">
                      <div className="cell-actions">
                        <button
                          className="btn-icon"
                          onClick={() => handleApprove(a._id)}
                          disabled={busyId === a._id}
                          title={t('approvals.approve')}
                          style={{ color: 'var(--color-success)' }}
                        >
                          <HiOutlineCheck />
                        </button>
                        <button
                          className="btn-icon"
                          onClick={() => openReject(a._id)}
                          disabled={busyId === a._id}
                          title={t('approvals.reject')}
                          style={{ color: 'var(--color-danger)' }}
                        >
                          <HiOutlineX />
                        </button>
                      </div>
                    </PermissionGate>
                  )}
                </td>
```

- [ ] **Step 3: Manual verification**

Run `cd frontend && npm run build` to confirm no syntax errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/PendingApprovals.jsx
git commit -m "feat: hide approve/reject controls from intern on Pending Approvals"
```

---

### Task 9: AccessControlMatrix — read-only treatment for intern

**Files:**
- Modify: `frontend/src/pages/AccessControlMatrix.jsx`

**Interfaces:**
- Consumes: `useAuth` (not yet imported in this file), `can` (from `frontend/src/config/permissions.js`).

- [ ] **Step 1: Add imports and read the current user**

Change:
```jsx
import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext';
import userService from '../services/userService';
import permissionOverrideService from '../services/permissionOverrideService';
import Modal from '../components/common/Modal';
import toast from 'react-hot-toast';
import { ROLES, ROLE_LABELS, OVERRIDABLE_RESOURCES } from '../config/permissions';
```
to:
```jsx
import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import userService from '../services/userService';
import permissionOverrideService from '../services/permissionOverrideService';
import Modal from '../components/common/Modal';
import toast from 'react-hot-toast';
import { ROLES, ROLE_LABELS, OVERRIDABLE_RESOURCES, can } from '../config/permissions';
```

Change:
```jsx
const AccessControlMatrix = () => {
  const { t } = useLanguage();
  const [users, setUsers] = useState([]);
```
to:
```jsx
const AccessControlMatrix = () => {
  const { t } = useLanguage();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
```

- [ ] **Step 2: Extend the checkbox's disabled condition**

Change:
```jsx
                        <td key={`${resource}-${action}`} style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={!!(staticGrant || override)}
                            disabled={staticGrant}
                            title={staticGrant ? t('accessControl.grantedByRole') : (override?.rationale || '')}
                            onChange={() => handleToggle(u, resource, action)}
                          />
                        </td>
```
to:
```jsx
                        <td key={`${resource}-${action}`} style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={!!(staticGrant || override)}
                            disabled={staticGrant || !can(currentUser.role, 'permissionOverrides', 'write')}
                            title={staticGrant ? t('accessControl.grantedByRole') : (override?.rationale || '')}
                            onChange={() => handleToggle(u, resource, action)}
                          />
                        </td>
```

This shows the intern the real granted/not-granted state (checkbox reflects actual data — same as any other viewer) but the `disabled` attribute prevents them from clicking it, so `handleToggle`/the grant modal are never reachable. No changes needed to `handleToggle`, `confirmGrant`, or the modal itself.

- [ ] **Step 3: Manual verification**

Run `cd frontend && npm run build` to confirm no syntax errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/AccessControlMatrix.jsx
git commit -m "feat: make Access Control Matrix checkboxes read-only for intern"
```

---

### Task 10: End-to-end manual verification

**Files:** none (verification only)

- [ ] **Step 1: Full live walkthrough**

With both `backend` and `frontend` running (`npm run dev` in each, or root `npm run dev:all`), log in as an existing intern user with a known password (e.g. `salih10@gmail.com` / `12345678`, department `hr`, per the demo data already seeded) and walk through:

1. **Sidebar:** confirm these items are now visible: Müşteriler, Geri Bildirimler, Görevler, Canlı Sohbet, Genel Harcama, Kullanıcı Yönetimi, Erişim Kontrol Matrisi, Onaylar, Denetim Kaydı. Confirm **Faturalar** and **Faturalar v2** are **not** in the sidebar, and typing `/invoices` directly in the URL bar redirects away (via `RoleGuard`).
2. **Kullanıcı Yönetimi (`/users`):** every user's email column shows `******`. No "Yeni Kullanıcı Ekle" button. Role and Departman columns show plain text (not dropdowns). Lider column shows `✓`/`—` (not a checkbox). No approve/reject/delete icons on any row.
3. **Denetim Kaydı (`/audit-log`):** entries load; any actor-email-shaped value shown is `******`.
4. **Onaylar (`/approvals`):** list loads (may be empty); if any pending request exists, `requestedBy`'s email shows `******` and there are no approve/reject buttons on that row.
5. **Erişim Kontrol Matrisi (`/access-control`):** table loads with real checked/unchecked states per user/resource/action, every checkbox is disabled (clicking does nothing), emails in the user column show `******`.
6. **Canlı Sohbet (`/chat`):** conversation list and message history load normally; no text box / send button appears at the bottom of a selected conversation.
7. **Genel Harcama (`/reports/spending`):** page loads with real data (no redirect).
8. **Görevler (`/tasks`):** all 4 departments' columns show cards (not just HR). Only the task actually assigned to this intern (`İzin taleplerinin Excel'den sisteme aktarılması`, HR, in_progress) is draggable; cards belonging to other users/departments are not draggable.

- [ ] **Step 2: Confirm super_admin is unaffected**

Log in as `admin@microcrm.com` and spot-check `/users` and `/access-control` — confirm real emails are shown (not masked) and all action buttons/controls still work exactly as before.

- [ ] **Step 3: No commit for this task** (verification-only, nothing to add to git).

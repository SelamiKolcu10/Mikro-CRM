const mongoose = require('mongoose');
const Task = require('../models/Task');
const User = require('../models/User');
const Project = require('../models/Project');
const TaskActivity = require('../models/TaskActivity');
const { ROLES, DEPARTMENTS } = require('../config/permissions');
const { taskScope, canApproveTask, canActOnTask } = require('../utils/taskScope');
const { computeWorkload } = require('../utils/workloadCalculator');

const COMMENT_USER_POPULATE = { path: 'comments.user', select: 'name email role' };

const TASK_POPULATE = [
  { path: 'assignedTo', select: 'name email department role' },
  { path: 'assignedBy', select: 'name email' },
  { path: 'projectId', select: 'name' },
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
 * @route   GET /api/tasks/workload-status?department=development
 * @desc    Algorithmic Workload Balancer — per-user active-task load score
 *          for the assignee dropdown in CreateTaskModal. Same gating as
 *          getAssignableUsers above (only the department's own lead or
 *          super_admin may see it) since it's shown at the exact same
 *          decision point. Read-only, additive — never blocks task creation.
 */
const getWorkloadStatus = async (req, res, next) => {
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
      return res.status(403).json({ success: false, error: 'Sadece kendi departmanınızın verilerini görebilirsiniz.' });
    }
    if (!DEPARTMENTS.includes(targetDepartment)) {
      return res.status(400).json({ success: false, error: 'Geçersiz departman.' });
    }

    const users = await User.find({ department: targetDepartment, status: 'approved' }).select('name email');
    const userIds = users.map((u) => u._id);

    const activeTasks = await Task.find({ assignedTo: { $in: userIds }, status: { $ne: 'done' } }).select('assignedTo priority deadline');
    const tasksByUser = new Map();
    for (const task of activeTasks) {
      const key = task.assignedTo.toString();
      if (!tasksByUser.has(key)) tasksByUser.set(key, []);
      tasksByUser.get(key).push(task);
    }

    const now = Date.now();
    const data = users.map((u) => {
      const { activeTaskCount, workloadScore, loadStatus } = computeWorkload(tasksByUser.get(u._id.toString()) || [], now);
      return { _id: u._id, name: u.name, email: u.email, activeTaskCount, workloadScore, loadStatus };
    });

    res.json({ success: true, data });
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
    const { title, description, department, priority, deadline, assignedTo, projectId } = req.body;

    const isSuperAdmin = req.user.role === ROLES.SUPER_ADMIN;
    const isLeadOfThisDepartment = req.user.isDepartmentLead && req.user.department === department;
    if (!isSuperAdmin && !isLeadOfThisDepartment) {
      return res.status(403).json({ success: false, error: 'Bu departmana görev atama yetkiniz yok.' });
    }

    const assignee = await User.findById(assignedTo).select('department status');
    if (!assignee || assignee.department !== department || assignee.status !== 'approved') {
      return res.status(400).json({ success: false, error: 'Atanan kullanıcı bu departmanda değil.' });
    }

    if (projectId) {
      const project = await Project.findById(projectId).select('_id');
      if (!project) {
        return res.status(400).json({ success: false, error: 'Proje bulunamadı.' });
      }
    }

    const task = await Task.create({
      title,
      description,
      department,
      priority,
      deadline,
      assignedTo,
      assignedBy: req.user._id,
      projectId: projectId || null,
    });

    // Record task creation as an activity for the contribution heatmap
    await TaskActivity.create({
      task: task._id,
      changedBy: req.user._id,
      changedByName: req.user.name,
      taskTitle: task.title,
      department: task.department,
      action: 'created',
      toStatus: 'todo',
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

    const previousStatus = task.status;
    task.status = status;
    await task.save();
    await TaskActivity.create({
      task: task._id,
      changedBy: req.user._id,
      changedByName: req.user.name,
      taskTitle: task.title,
      department: task.department,
      action: 'status_changed',
      fromStatus: previousStatus,
      toStatus: status,
    });
    await task.populate(TASK_POPULATE);

    res.json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/tasks/:id/deadline
 * @desc    Takvimde sürükle-bırak ile (veya tarih-seçiciden) deadline
 *          taşıma. Yetki durum onayıyla aynı çizgide: yalnızca görevin
 *          departman lideri ya da super_admin taşıyabilir — assignee'ye
 *          açık değil (tasarım kararı: deadline planlama bir liderlik
 *          işlemi, "durumu ilerletme" değil).
 *
 *          İki liderin aynı görevi eşzamanlı taşıması: Task şemasında
 *          optimisticConcurrency açık, `expectedVersion` (istemcinin son
 *          gördüğü __v) uyuşmazsa Mongoose VersionError fırlatır, burada
 *          409'a çevrilir — istemci "başkası güncelledi, yenile" gösterir.
 */
const updateTaskDeadline = async (req, res, next) => {
  try {
    const { deadline, expectedVersion } = req.body;

    const task = await Task.findOne({ _id: req.params.id, ...taskScope(req.user) });
    if (!task) {
      return res.status(404).json({ success: false, error: 'Görev bulunamadı.' });
    }

    if (!canApproveTask(req.user, task)) {
      return res.status(403).json({ success: false, error: 'Bu görevin tarihini değiştirme yetkiniz yok.' });
    }

    if (expectedVersion !== undefined && task.__v !== expectedVersion) {
      return res.status(409).json({
        success: false,
        error: 'Bu görev başka biri tarafından güncellendi. Lütfen sayfayı yenileyin.',
      });
    }

    const previousDeadline = task.deadline;
    const nextDeadline = deadline ? new Date(deadline) : null;
    task.deadline = nextDeadline;

    try {
      await task.save();
    } catch (saveError) {
      if (saveError.name === 'VersionError') {
        return res.status(409).json({
          success: false,
          error: 'Bu görev başka biri tarafından güncellendi. Lütfen sayfayı yenileyin.',
        });
      }
      throw saveError;
    }

    await TaskActivity.create({
      task: task._id,
      changedBy: req.user._id,
      changedByName: req.user.name,
      taskTitle: task.title,
      department: task.department,
      action: 'deadline_changed',
      fromDeadline: previousDeadline,
      toDeadline: nextDeadline,
    });
    await task.populate(TASK_POPULATE);

    res.json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/tasks/activity-heatmap?department=&userId=
 * @desc    Son 365 günü günlük gruplar. Returns a pre-aggregated dictionary
 *          keyed by date with both summary counts and a capped detail array
 *          for rich heatmap tooltips. Görünürlük taskScope ile aynı kural,
 *          ama TaskActivity'nin kendi department/changedBy alanları
 *          üzerinden (Task'a join yok).
 */
const getActivityHeatmap = async (req, res, next) => {
  try {
    const { department, userId } = req.query;
    const since = new Date();
    since.setDate(since.getDate() - 365);

    const match = { createdAt: { $gte: since } };

    const isSuperAdmin = req.user.role === ROLES.SUPER_ADMIN;
    const isIntern = req.user.role === ROLES.INTERN;
    const hasFullAccess = isSuperAdmin || isIntern;

    if (!hasFullAccess) {
      if (department && department !== req.user.department) {
        return res.status(403).json({ success: false, error: 'Bu departmanın verilerini görüntüleme yetkiniz yok.' });
      }
      if (!req.user.department && userId && userId !== req.user._id.toString()) {
        return res.status(403).json({ success: false, error: 'Bu kullanıcının verilerini görüntüleme yetkiniz yok.' });
      }
      if (req.user.department) {
        // Lider veya normal üye — departmanı varsa taskScope ile aynı şekilde
        // tüm departmanın aktivitesini görür, sadece kendi işlemlerini değil.
        match.department = req.user.department;
      } else {
        match.changedBy = req.user._id;
      }
    }

    if (department) match.department = department;
    if (userId) match.changedBy = new mongoose.Types.ObjectId(userId);

    // Single aggregation with $facet: one branch for daily summary counts,
    // another for per-day detail rows (capped at 10 per day to limit payload).
    const pipeline = [
      { $match: match },
      {
        $facet: {
          summary: [
            {
              $group: {
                _id: { date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, status: '$toStatus' },
                count: { $sum: 1 },
              },
            },
          ],
          details: [
            { $sort: { createdAt: -1 } },
            {
              $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                total: { $sum: 1 },
                items: {
                  $push: {
                    user: '$changedByName',
                    action: '$action',
                    task: '$taskTitle',
                    from: '$fromStatus',
                    to: '$toStatus',
                    fromDeadline: { $dateToString: { format: '%Y-%m-%d', date: '$fromDeadline', onNull: null } },
                    toDeadline: { $dateToString: { format: '%Y-%m-%d', date: '$toDeadline', onNull: null } },
                    time: { $dateToString: { format: '%H:%M', date: '$createdAt' } },
                  },
                },
              },
            },
            // Cap details to 10 per day
            { $project: { total: 1, items: { $slice: ['$items', 10] } } },
          ],
        },
      },
    ];

    const [result] = await TaskActivity.aggregate(pipeline);

    // Build the dictionary response
    const byDate = {};

    // Process details first (creates the date entries with detail arrays)
    for (const row of result.details) {
      byDate[row._id] = {
        date: row._id,
        total: row.total,
        byStatus: {},
        details: row.items,
      };
    }

    // Merge summary counts into the same entries
    for (const row of result.summary) {
      const { date, status } = row._id;
      if (!byDate[date]) {
        byDate[date] = { date, total: 0, byStatus: {}, details: [] };
      }
      byDate[date].byStatus[status] = row.count;
    }

    res.json({ success: true, data: byDate });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/tasks/:id/comments
 * @desc    Görevi taskScope ile görebilen herkes yorumları okuyabilir.
 */
const getTaskComments = async (req, res, next) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, ...taskScope(req.user) })
      .select('comments')
      .populate(COMMENT_USER_POPULATE);
    if (!task) {
      return res.status(404).json({ success: false, error: 'Görev bulunamadı.' });
    }
    res.json({ success: true, data: task.comments });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/tasks/:id/comments
 * @desc    Yorum yazma intern'e kapalı (uygulama genelindeki read-only intern
 *          kuralıyla tutarlı, bkz. design doc Bölüm 4). Düzenleme/silme yok.
 */
const addTaskComment = async (req, res, next) => {
  try {
    if (req.user.role === ROLES.INTERN) {
      return res.status(403).json({ success: false, error: 'Yorum yazma yetkiniz yok.' });
    }

    const task = await Task.findOne({ _id: req.params.id, ...taskScope(req.user) });
    if (!task) {
      return res.status(404).json({ success: false, error: 'Görev bulunamadı.' });
    }

    task.comments.push({ user: req.user._id, text: req.body.text });
    await task.save();
    await task.populate(COMMENT_USER_POPULATE);

    res.status(201).json({ success: true, data: task.comments[task.comments.length - 1] });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTasks,
  getAssignableUsers,
  getWorkloadStatus,
  createTask,
  updateTaskStatus,
  updateTaskDeadline,
  getActivityHeatmap,
  getTaskComments,
  addTaskComment,
};

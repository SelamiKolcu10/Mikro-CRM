const mongoose = require('mongoose');
const Task = require('../models/Task');
const User = require('../models/User');
const TaskActivity = require('../models/TaskActivity');
const { ROLES, DEPARTMENTS } = require('../config/permissions');
const { taskScope, canApproveTask, canActOnTask } = require('../utils/taskScope');

const TASK_POPULATE = [
  { path: 'assignedTo', select: 'name email department role' },
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

    const assignee = await User.findById(assignedTo).select('department status');
    if (!assignee || assignee.department !== department || assignee.status !== 'approved') {
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
  } catch (error) {
    next(error);
  }
};

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

module.exports = { getTasks, getAssignableUsers, createTask, updateTaskStatus, getActivityHeatmap };

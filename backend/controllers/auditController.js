const AuditLog = require('../models/AuditLog');

/**
 * @route   GET /api/audit-logs
 * @desc    Filterable, paginated audit trail — super_admin only. Lets an
 *          admin verify that a customer's self-edit or another admin's
 *          user-management action actually persisted to the DB.
 */
const getAuditLogs = async (req, res, next) => {
  try {
    const {
      collectionName,
      documentId,
      actor,
      action,
      dateFrom,
      dateTo,
      page = 1,
      limit = 25,
    } = req.query;

    const filter = {};
    if (collectionName) filter.collectionName = collectionName;
    if (documentId) filter.documentId = documentId;
    if (actor) filter.actor = actor;
    if (action) filter.action = action;
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [logs, total] = await Promise.all([
      AuditLog.find(filter).sort('-createdAt').skip(skip).limit(parseInt(limit)),
      AuditLog.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/audit-logs/:id
 */
const getAuditLog = async (req, res, next) => {
  try {
    const log = await AuditLog.findById(req.params.id);
    if (!log) {
      return res.status(404).json({ success: false, error: 'Kayıt bulunamadı.' });
    }
    res.json({ success: true, data: log });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAuditLogs, getAuditLog };

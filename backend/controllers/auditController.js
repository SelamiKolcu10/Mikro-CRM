const AuditLog = require('../models/AuditLog');
const { verifyChain } = require('../utils/auditChain');
const { ROLES } = require('../config/permissions');

const SEVERITIES = ['info', 'sensitive', 'critical'];

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * `maskActorIdentity` (intern) drops every actor-identity axis from the
 * query — the actor/actorEmail filters and the email fields of the free-text
 * search. Otherwise the output masking (redactForIntern) is defeated by an
 * enumeration oracle: an intern could filter/search by a guessed email and
 * learn from the result count whether that actor has audit activity, even
 * though the emails render as ******. Non-email search axes (snapshot
 * name/title) stay available so search still works.
 */
function buildFilter(
  { collectionName, documentId, actor, actorEmail, action, severity, dateFrom, dateTo, search },
  { maskActorIdentity = false } = {}
) {
  const filter = {};
  if (collectionName) filter.collectionName = collectionName;
  if (documentId) filter.documentId = documentId;
  if (!maskActorIdentity && actor) filter.actor = actor;
  if (!maskActorIdentity && actorEmail) filter.actorEmail = actorEmail;
  if (action) filter.action = action;
  if (severity) filter.severity = severity;
  if (dateFrom || dateTo) {
    filter.createdAt = {};
    if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
    if (dateTo) filter.createdAt.$lte = new Date(dateTo);
  }
  if (search) {
    const re = new RegExp(escapeRegex(search), 'i');
    filter.$or = maskActorIdentity
      ? [{ 'snapshot.name': re }, { 'snapshot.title': re }]
      : [
          { actorEmail: re },
          { 'snapshot.name': re },
          { 'snapshot.title': re },
          { 'snapshot.email': re },
        ];
  }
  return filter;
}

/**
 * @route   GET /api/audit-logs
 * @desc    Filterable, paginated audit trail — super_admin + intern (actor
 *          email masked for intern via redactForIntern). Also returns
 *          severityCounts for the filter bar's segmented-chip counts,
 *          computed with the same filter minus `severity` itself.
 */
const getAuditLogs = async (req, res, next) => {
  try {
    const { page = 1, limit = 25 } = req.query;
    // Intern's audit view masks actor emails on output — also strip the
    // actor-identity axes from the query so result counts can't be used as an
    // enumeration oracle (see buildFilter).
    const maskActorIdentity = req.user.role === ROLES.INTERN;
    const filter = buildFilter(req.query, { maskActorIdentity });
    const countFilter = buildFilter({ ...req.query, severity: undefined }, { maskActorIdentity });

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [logs, total, severityAgg] = await Promise.all([
      // Sorted by sequence, not createdAt: sequence is the chain's
      // authoritative order (the synthetic genesis row has sequence=1 but a
      // createdAt of "when the migration ran", which would otherwise sort
      // it out of chain order).
      AuditLog.find(filter).sort('-sequence').skip(skip).limit(parseInt(limit)),
      AuditLog.countDocuments(filter),
      AuditLog.aggregate([
        { $match: countFilter },
        { $group: { _id: '$severity', count: { $sum: 1 } } },
      ]),
    ]);

    const severityCounts = SEVERITIES.reduce((acc, s) => ({ ...acc, [s]: 0 }), {});
    for (const row of severityAgg) {
      if (row._id) severityCounts[row._id] = row.count;
    }

    res.json({
      success: true,
      data: logs,
      severityCounts,
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
 * @route   GET /api/audit-logs/verify
 * @desc    Walks the hash chain and reports whether it's intact, and if not,
 *          the sequence number where it first breaks.
 */
const getAuditChainStatus = async (req, res, next) => {
  try {
    const result = await verifyChain();
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/audit-logs/actors
 * @desc    Distinct actor emails for the actor filter — super_admin only,
 *          since intern access to the audit log always masks actor identity
 *          (see redactForIntern); an actor picklist would defeat that.
 */
const getAuditActors = async (req, res, next) => {
  try {
    const actors = await AuditLog.distinct('actorEmail', { actorEmail: { $ne: null } });
    res.json({ success: true, data: actors.sort() });
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

module.exports = { getAuditLogs, getAuditLog, getAuditChainStatus, getAuditActors };

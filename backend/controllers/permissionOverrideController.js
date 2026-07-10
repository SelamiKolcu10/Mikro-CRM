const PermissionOverride = require('../models/PermissionOverride');
const auditService = require('../utils/auditService');

const OVERRIDE_WATCHED_FIELDS = ['active', 'rationale'];

/**
 * @route   GET /api/permission-overrides
 * @desc    All currently active overrides — the Access Control Matrix reads
 *          this to know which checkboxes are checked.
 */
const getOverrides = async (req, res, next) => {
  try {
    const overrides = await PermissionOverride.find({ active: true })
      .populate('user', 'name email role')
      .populate('grantedBy', 'name email');

    res.json({ success: true, data: overrides });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/permission-overrides
 * @desc    Grant a user extra permission beyond their static role. Upserts
 *          on the (user, resource, action) unique index — re-granting a
 *          previously revoked override flips it active again rather than
 *          erroring on the duplicate key.
 */
const grantOverride = async (req, res, next) => {
  try {
    const { userId, resource, action, rationale } = req.body;

    const before = await PermissionOverride.findOne({ user: userId, resource, action });

    const override = await PermissionOverride.findOneAndUpdate(
      { user: userId, resource, action },
      { active: true, rationale: rationale || null, grantedBy: req.user._id },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
    );
    await override.populate('user', 'name email role');
    await override.populate('grantedBy', 'name email');

    await auditService.record({
      req,
      collectionName: 'PermissionOverride',
      documentId: override._id,
      action: before ? 'update' : 'create',
      before: before ? { active: before.active, rationale: before.rationale } : undefined,
      after: before ? { active: override.active, rationale: override.rationale } : override.toObject(),
      watchedFields: before ? OVERRIDE_WATCHED_FIELDS : [],
    });

    res.status(201).json({ success: true, data: override });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   DELETE /api/permission-overrides/:id
 * @desc    Revoke — sets active:false rather than deleting, so the grant's
 *          history (and who granted it, and why) survives in the collection
 *          itself as well as in AuditLog.
 */
const revokeOverride = async (req, res, next) => {
  try {
    const override = await PermissionOverride.findById(req.params.id);
    if (!override) {
      return res.status(404).json({ success: false, error: 'Yetki kaydı bulunamadı.' });
    }
    if (!override.active) {
      return res.json({ success: true, data: override }); // already revoked — no-op
    }

    override.active = false;
    await override.save();

    await auditService.record({
      req,
      collectionName: 'PermissionOverride',
      documentId: override._id,
      action: 'update',
      before: { active: true },
      after: { active: false },
      watchedFields: ['active'],
    });

    res.json({ success: true, data: override });
  } catch (error) {
    next(error);
  }
};

module.exports = { getOverrides, grantOverride, revokeOverride };

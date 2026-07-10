const AuditLog = require('../models/AuditLog');

const NEVER_LOG_VALUES = new Set(['password']);

/**
 * Diffs `before`/`after` over a fixed list of fields (only fields we
 * explicitly care about — avoids noise from internal/derived fields like
 * `updatedAt`). Password-shaped fields are always masked, never stored,
 * even hashed.
 */
function computeDiff(before, after, watchedFields) {
  const changes = [];
  for (const field of watchedFields) {
    const b = before ? before[field] : undefined;
    const a = after ? after[field] : undefined;
    if (JSON.stringify(b) === JSON.stringify(a)) continue;

    changes.push({
      field,
      before: NEVER_LOG_VALUES.has(field) ? '***' : b,
      after: NEVER_LOG_VALUES.has(field) ? '***' : a,
    });
  }
  return changes;
}

function resolveActor(req) {
  if (req.user) return { actor: req.user._id, actorType: 'internal', actorEmail: req.user.email };
  if (req.customerUser) return { actor: req.customerUser._id, actorType: 'customer', actorEmail: req.customerUser.email };
  return { actor: null, actorType: 'system', actorEmail: null };
}

/**
 * @param {object} opts
 * @param {object} opts.req - Express request (to resolve actor/ip/UA)
 * @param {string} opts.collectionName - 'User'|'Customer'|'CustomerUser'|'Feedback'
 * @param {string} opts.documentId
 * @param {'create'|'update'|'delete'} opts.action
 * @param {object} [opts.before] - Plain object/doc state before the write (update/delete)
 * @param {object} [opts.after] - Plain object/doc state after the write (create/update)
 * @param {string[]} [opts.watchedFields] - Which fields to diff on update
 */
async function record({ req, collectionName, documentId, action, before, after, watchedFields = [] }) {
  try {
    const { actor, actorType, actorEmail } = resolveActor(req);

    const changes = action === 'update' ? computeDiff(before, after, watchedFields) : [];
    if (action === 'update' && changes.length === 0) return; // nothing actually changed — skip noise

    await AuditLog.create({
      collectionName,
      documentId,
      action,
      actor,
      actorType,
      actorEmail,
      changes,
      snapshot: action !== 'update' ? after || before : null,
      ip: req.ip,
      userAgent: req.headers['user-agent'] || null,
    });
  } catch (err) {
    // Audit logging must never break the actual request it's observing.
    console.error('AuditLog kaydı başarısız:', err.message);
  }
}

module.exports = { record, computeDiff };

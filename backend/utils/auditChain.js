const crypto = require('crypto');
const mongoose = require('mongoose');
const AuditLog = require('../models/AuditLog');
const AuditSequenceCounter = require('../models/AuditSequenceCounter');

const GENESIS_HASH = '0'.repeat(64);
const COUNTER_ID = 'singleton';

// Exactly the fields that go into a record's hash. Write (writeChainedLog)
// and verify (verifyChain) both build their payload through buildHashPayload
// so they can never drift apart.
const HASH_FIELDS = [
  'collectionName', 'documentId', 'action', 'actor', 'actorType', 'actorEmail',
  'changes', 'snapshot', 'ip', 'userAgent', 'severity', 'sequence', 'prevHash',
  '_id', 'createdAt',
];

function isObjectId(value) {
  return value instanceof mongoose.Types.ObjectId || (value && value._bsontype === 'ObjectID');
}

// Deterministic stringify: sorted object keys, explicit ObjectId/Date
// serialization, undefined coerced to null (so "missing" and "explicit
// null" never hash the same as two different payloads).
function canonicalize(value) {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (isObjectId(value)) return value.toString();
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = canonicalize(value[key]);
    }
    return out;
  }
  return value;
}

function sha256(payload) {
  return crypto.createHash('sha256').update(JSON.stringify(canonicalize(payload))).digest('hex');
}

function buildHashPayload(doc) {
  const out = {};
  for (const field of HASH_FIELDS) {
    out[field] = doc[field] !== undefined ? doc[field] : null;
  }
  return out;
}

function computeHash(doc) {
  return sha256(buildHashPayload(doc));
}

/**
 * Severity classification for the security timeline. Fails closed: anything
 * not explicitly recognized as low-risk ('info') is 'sensitive', never
 * silently 'info'.
 */
function computeSeverity({ action, collectionName, changes = [] }) {
  if (action === 'delete') return 'critical';
  if (collectionName === 'PermissionOverride') return 'critical';
  if (collectionName === 'User' && changes.some((c) => c.field === 'role' || c.field === 'status')) {
    return 'critical';
  }
  if (collectionName === 'Feedback') return 'info';
  return 'sensitive';
}

/**
 * Reserves the next chain slot, computes this record's hash against the
 * previous record's hash, and inserts — all inside one transaction so
 * concurrent writers serialize instead of racing on the counter/prevHash
 * read (safe because MONGO_URI is an Atlas replica set; see plan).
 */
async function writeChainedLog(payload) {
  const session = await mongoose.startSession();
  try {
    let created;
    await session.withTransaction(async () => {
      const counter = await AuditSequenceCounter.findOneAndUpdate(
        { _id: COUNTER_ID },
        { $inc: { value: 1 } },
        { new: true, upsert: true, session }
      );
      const sequence = counter.value;

      let prevHash = GENESIS_HASH;
      if (sequence > 1) {
        const prevLog = await AuditLog.findOne({ sequence: sequence - 1 }, 'hash', { session }).lean();
        if (!prevLog) {
          throw new Error(`Zincirde önceki kayıt bulunamadı (sequence=${sequence - 1})`);
        }
        prevHash = prevLog.hash;
      }

      const _id = new mongoose.Types.ObjectId();
      const createdAt = new Date();
      const hash = computeHash({ ...payload, sequence, prevHash, _id, createdAt });

      const docs = await AuditLog.create(
        [{ ...payload, _id, createdAt, sequence, prevHash, hash }],
        { session }
      );
      created = docs[0];
    });
    return created;
  } finally {
    await session.endSession();
  }
}

/**
 * Walks the full chain in sequence order, recomputing and comparing every
 * hash. Full walk every time (not incremental/cached) — at this app's scale
 * this is single-digit milliseconds, and a cached checkpoint would itself
 * need integrity protection, which isn't worth it here.
 */
async function verifyChain() {
  const logs = await AuditLog.find({}).sort('sequence').select([...HASH_FIELDS, 'hash'].join(' ')).lean();

  let expectedPrevHash = GENESIS_HASH;
  for (const log of logs) {
    if (log.prevHash !== expectedPrevHash) {
      return {
        intact: false,
        brokenAtSequence: log.sequence,
        totalChecked: logs.length,
        checkedAt: new Date(),
        expected: expectedPrevHash,
        found: log.prevHash,
      };
    }
    const recomputedHash = computeHash(log);
    if (recomputedHash !== log.hash) {
      return {
        intact: false,
        brokenAtSequence: log.sequence,
        totalChecked: logs.length,
        checkedAt: new Date(),
        expected: recomputedHash,
        found: log.hash,
      };
    }
    expectedPrevHash = log.hash;
  }

  return { intact: true, brokenAtSequence: null, totalChecked: logs.length, checkedAt: new Date() };
}

module.exports = {
  GENESIS_HASH,
  canonicalize,
  sha256,
  computeHash,
  computeSeverity,
  writeChainedLog,
  verifyChain,
};

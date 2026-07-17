const mongoose = require('mongoose');

/**
 * Single-document counter used only to atomically reserve the next chain
 * position for a new AuditLog row (see utils/auditChain.js). Not a general
 * purpose counter — one fixed document, id 'singleton'.
 */
const auditSequenceCounterSchema = new mongoose.Schema({
  _id: { type: String, default: 'singleton' },
  value: { type: Number, default: 0 },
});

module.exports = mongoose.model('AuditSequenceCounter', auditSequenceCounterSchema);

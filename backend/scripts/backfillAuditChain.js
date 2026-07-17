/**
 * One-time migration: assigns hash-chain fields (sequence/prevHash/hash/
 * severity) to AuditLog rows written before the chain existed, then seeds
 * AuditSequenceCounter so new writes continue the chain.
 *
 * Pre-migration rows are unverifiable by construction — nothing before the
 * chain existed could have been hash-protected — so this writes a synthetic
 * genesis marker (collectionName: 'System') documenting that fact, rather
 * than silently implying full history is covered.
 *
 * Idempotent: rows that already have `sequence` set are left untouched, and
 * re-running after a full migration is a no-op.
 *
 * Usage: node scripts/backfillAuditChain.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { computeHash, computeSeverity, GENESIS_HASH } = require('../utils/auditChain');

async function migrate() {
  await mongoose.connect(process.env.MONGO_URI);
  const auditLogs = mongoose.connection.collection('auditlogs');
  const counters = mongoose.connection.collection('auditsequencecounters');

  const existingCounter = await counters.findOne({ _id: 'singleton' });
  if (existingCounter && existingCounter.value > 0) {
    console.log('Zincir zaten başlatılmış (counter mevcut). Göç atlanıyor.');
    await mongoose.disconnect();
    return;
  }

  const legacyRows = await auditLogs
    .find({ sequence: { $exists: false } })
    .sort({ createdAt: 1, _id: 1 })
    .toArray();

  if (legacyRows.length === 0) {
    console.log('Göç edilecek eski denetim kaydı bulunamadı.');
  }

  let sequence = 0;
  let prevHash = GENESIS_HASH;

  // Synthetic genesis marker documenting the migration itself.
  sequence += 1;
  const genesisId = new mongoose.Types.ObjectId();
  const genesisCreatedAt = new Date();
  const genesisPayload = {
    collectionName: 'System',
    documentId: genesisId,
    action: 'create',
    actor: null,
    actorType: 'system',
    actorEmail: null,
    changes: [],
    snapshot: {
      note: `Hash zinciri başlatıldı — ${legacyRows.length} eski kayıt bu noktadan önce oluşturuldu ve doğrulanamaz.`,
      legacyRecordCount: legacyRows.length,
    },
    ip: null,
    userAgent: null,
    severity: 'info',
  };
  const genesisHash = computeHash({
    ...genesisPayload,
    sequence,
    prevHash,
    _id: genesisId,
    createdAt: genesisCreatedAt,
  });
  await auditLogs.insertOne({
    _id: genesisId,
    createdAt: genesisCreatedAt,
    updatedAt: genesisCreatedAt,
    ...genesisPayload,
    sequence,
    prevHash,
    hash: genesisHash,
  });
  prevHash = genesisHash;
  console.log(`✅ Genesis kaydı oluşturuldu (sequence=${sequence}).`);

  for (const row of legacyRows) {
    sequence += 1;
    const severity = computeSeverity({
      action: row.action,
      collectionName: row.collectionName,
      changes: row.changes || [],
    });
    const hash = computeHash({
      collectionName: row.collectionName,
      documentId: row.documentId,
      action: row.action,
      actor: row.actor,
      actorType: row.actorType,
      actorEmail: row.actorEmail,
      changes: row.changes || [],
      snapshot: row.snapshot,
      ip: row.ip,
      userAgent: row.userAgent,
      severity,
      sequence,
      prevHash,
      _id: row._id,
      createdAt: row.createdAt,
    });

    await auditLogs.updateOne(
      { _id: row._id },
      { $set: { sequence, prevHash, hash, severity } }
    );
    prevHash = hash;
  }

  await counters.updateOne(
    { _id: 'singleton' },
    { $set: { value: sequence } },
    { upsert: true }
  );

  console.log(`\nToplam ${legacyRows.length} eski kayıt + 1 genesis kaydı göç ettirildi (son sequence=${sequence}).`);
  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error('❌ Göç hatası:', err);
  process.exit(1);
});

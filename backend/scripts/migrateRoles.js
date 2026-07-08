/**
 * One-time migration: old role enum ['admin','member'] → new RBAC roles.
 * Existing users predate the approval workflow, so they are grandfathered in
 * as 'approved' rather than being locked out as 'pending'.
 *
 *   admin  → super_admin (+ approved)
 *   member → staff       (+ approved)
 *
 * Usage: node scripts/migrateRoles.js
 */
require('dotenv').config();
const mongoose = require('mongoose');

const ROLE_MAP = {
  admin: 'super_admin',
  member: 'staff',
};

async function migrate() {
  await mongoose.connect(process.env.MONGO_URI);

  // Bypass Mongoose schema validation (old enum values would be rejected by
  // the new schema) by talking to the raw collection.
  const collection = mongoose.connection.collection('users');

  const legacyUsers = await collection.find({ role: { $in: Object.keys(ROLE_MAP) } }).toArray();

  if (legacyUsers.length === 0) {
    console.log('Göç edilecek eski rollü kullanıcı bulunamadı.');
    await mongoose.disconnect();
    return;
  }

  for (const user of legacyUsers) {
    const newRole = ROLE_MAP[user.role];
    await collection.updateOne(
      { _id: user._id },
      {
        $set: {
          role: newRole,
          status: 'approved',
          approvedBy: null,
          approvedAt: user.createdAt || new Date(),
          rejectionReason: null,
        },
      }
    );
    console.log(`✅ ${user.email}: ${user.role} → ${newRole} (approved)`);
  }

  // Herhangi bir sebeple status alanı hiç olmayan (RBAC öncesi) kullanıcılar
  // için de güvenli bir varsayım: onaylı say.
  const result = await collection.updateMany(
    { status: { $exists: false } },
    { $set: { status: 'approved', approvedBy: null, approvedAt: new Date(), rejectionReason: null } }
  );
  if (result.modifiedCount > 0) {
    console.log(`✅ ${result.modifiedCount} kullanıcıya varsayılan 'approved' durumu atandı.`);
  }

  console.log(`\nToplam ${legacyUsers.length} kullanıcı göç ettirildi.`);
  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error('❌ Göç hatası:', err);
  process.exit(1);
});

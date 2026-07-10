const mongoose = require('mongoose');

/**
 * Read-only projection of backend/models/User.js — this service only ever
 * reads role/status/mustChangePassword/tokenVersion to verify a token is
 * still current (see middleware/auth.js); it never writes to this
 * collection. Deliberately excludes password/bcrypt — not needed here and
 * keeping it out means a bug in this file can never touch credentials.
 *
 * Points at the same `users` collection as the main backend (shared
 * MongoDB — see .env MONGO_URI) via the default 'User' → 'users' mapping.
 * Keep the field list here in sync with backend/models/User.js whenever
 * role/status/tokenVersion semantics change there.
 */
const userSchema = new mongoose.Schema(
  {
    role: String,
    status: String,
    mustChangePassword: Boolean,
    tokenVersion: Number,
  },
  { collection: 'users', strict: false }
);

module.exports = mongoose.model('User', userSchema);

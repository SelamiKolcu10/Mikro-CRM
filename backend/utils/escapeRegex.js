/**
 * Escapes regex metacharacters so a user-supplied search string is matched
 * as a literal substring, never interpreted as a pattern. Without this, a
 * crafted value (e.g. `(a+)+$`) fed straight into `$regex` causes catastrophic
 * backtracking (ReDoS) that pins the event loop, and metacharacters silently
 * change search semantics. Length-capped — a search box never needs more, and
 * it bounds worst-case matching cost.
 */
module.exports = function escapeRegex(input) {
  return String(input).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 100);
};

// Simple in-memory rate limiter — prevents button spam and abuse
// Not persisted across restarts (that's fine — cooldowns are short-lived)
const cooldowns = new Map();

/**
 * Check if a user is currently on cooldown for a given action.
 * @param {string} uid - User ID
 * @param {string} action - Action key (e.g. "bug_report", "vote")
 * @returns {number} 0 if not on cooldown, else seconds remaining
 */
function remaining(uid, action) {
  const key = `${uid}_${action}`;
  const until = cooldowns.get(key);
  if (!until) return 0;
  const remainingMs = until - Date.now();
  if (remainingMs <= 0) {
    cooldowns.delete(key);
    return 0;
  }
  return Math.ceil(remainingMs / 1000);
}

/**
 * Start a cooldown for the given user + action.
 * @param {string} uid
 * @param {string} action
 * @param {number} seconds
 */
function set(uid, action, seconds) {
  const key = `${uid}_${action}`;
  cooldowns.set(key, Date.now() + seconds * 1000);
}

/**
 * Convenience: check + set in one call. Returns seconds remaining (0 = allowed).
 */
function check(uid, action, seconds) {
  const left = remaining(uid, action);
  if (left > 0) return left;
  set(uid, action, seconds);
  return 0;
}

// Periodic cleanup of expired entries (every 5 min)
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of cooldowns.entries()) {
    if (v <= now) cooldowns.delete(k);
  }
}, 5 * 60 * 1000).unref();

module.exports = { remaining, set, check };

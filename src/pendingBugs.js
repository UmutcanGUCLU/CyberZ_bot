// Short-lived pending bug storage — used during duplicate detection flow.
// When a user submits a bug modal, if similar bugs are found we stash the
// submission here while they decide to vote-on-existing or proceed anyway.
const PENDING_TTL_MS = 5 * 60 * 1000;
const pending = new Map(); // uid → { data, expiresAt }

function put(uid, data) {
  pending.set(uid, { data, expiresAt: Date.now() + PENDING_TTL_MS });
}

function take(uid) {
  const entry = pending.get(uid);
  if (!entry) return null;
  pending.delete(uid);
  if (entry.expiresAt < Date.now()) return null;
  return entry.data;
}

function clear(uid) {
  pending.delete(uid);
}

// Periodic cleanup of expired entries (every minute)
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of pending.entries()) {
    if (v.expiresAt < now) pending.delete(k);
  }
}, 60 * 1000).unref();

module.exports = { put, take, clear };

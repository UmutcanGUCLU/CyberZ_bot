// Auto slow-mode — monitors message rate per channel; enables Discord's
// built-in rate limit when messages burst, and restores to 0 when things calm down.
const logger = require("./logger");

const DEFAULTS = {
  burstWindow: 10_000,  // look at last 10 seconds
  burstThreshold: 20,   // 20+ messages triggers slowmode
  slowmodeSeconds: 5,   // use 5-second rate limit
  coolDownMs: 60_000,   // keep slowmode on for at least 1 minute after calm
  maxSlowmodeSec: 30,
};

// channel_id → { recent: [ts], slowmodeUntil: number, originalRateLimit: number }
const state = new Map();

function entry(chId) {
  let e = state.get(chId);
  if (!e) {
    e = { recent: [], slowmodeUntil: 0, originalRateLimit: null };
    state.set(chId, e);
  }
  return e;
}

function prune(e, window) {
  const cutoff = Date.now() - window;
  e.recent = e.recent.filter(ts => ts > cutoff);
}

/**
 * Called for every non-bot message. Returns true if a slow-mode toggle happened.
 */
async function tick(message, config = DEFAULTS) {
  if (!message.guild || !message.channel?.setRateLimitPerUser) return false;
  // Ignore channels that already have manual slowmode set that we didn't set
  const ch = message.channel;
  const e = entry(ch.id);
  const now = Date.now();
  e.recent.push(now);
  prune(e, config.burstWindow);

  // Already in slowmode? Check if cooldown passed.
  if (e.slowmodeUntil > 0) {
    if (now >= e.slowmodeUntil && e.recent.length < config.burstThreshold / 2) {
      // Restore
      try {
        await ch.setRateLimitPerUser(e.originalRateLimit ?? 0, "Auto-slowmode cooled down");
      } catch (err) {
        logger.warn("[autoSlowMode] restore failed:", err.message);
      }
      e.slowmodeUntil = 0;
      e.originalRateLimit = null;
      return true;
    }
    return false;
  }

  // Check burst threshold
  if (e.recent.length >= config.burstThreshold) {
    // Enable slowmode
    try {
      e.originalRateLimit = ch.rateLimitPerUser || 0;
      // Don't override existing manual slowmode that's higher
      if (e.originalRateLimit >= config.slowmodeSeconds) return false;
      const newRate = Math.min(config.slowmodeSeconds, config.maxSlowmodeSec);
      await ch.setRateLimitPerUser(newRate, "Auto-slowmode: message burst detected");
      e.slowmodeUntil = now + config.coolDownMs;
      return true;
    } catch (err) {
      logger.warn("[autoSlowMode] enable failed:", err.message);
      // Clear state so we don't think slowmode is active
      e.slowmodeUntil = 0;
      e.originalRateLimit = null;
    }
  }
  return false;
}

module.exports = { tick, DEFAULTS };

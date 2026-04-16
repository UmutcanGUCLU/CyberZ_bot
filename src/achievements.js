// Achievement system — tracks unlocked badges per user
const { db } = require("./db");
const i18n = require("./i18n");
const logger = require("./logger");

// Each achievement: key → { emoji, bonus xp, check(member) → bool }
// Names/descriptions live in locale files under "achievements.<key>.name" / ".desc"
const ACHIEVEMENTS = {
  first_bug:        { emoji: "🐛", bonus: 50,  check: m => (m.bugs || 0) >= 1 },
  bug_hunter:       { emoji: "🔍", bonus: 100, check: m => (m.bugs || 0) >= 10 },
  bug_slayer:       { emoji: "⚔️",  bonus: 500, check: m => (m.bugs || 0) >= 50 },
  first_invite:     { emoji: "📨", bonus: 50,  check: m => (m.invs || 0) >= 1 },
  recruiter:        { emoji: "🎯", bonus: 200, check: m => (m.invs || 0) >= 10 },
  ambassador:       { emoji: "🌟", bonus: 500, check: m => (m.invs || 0) >= 25 },
  chatty:           { emoji: "💬", bonus: 50,  check: m => (m.msgs || 0) >= 100 },
  social_butterfly: { emoji: "🦋", bonus: 300, check: m => (m.msgs || 0) >= 1000 },
  level_10:         { emoji: "⭐", bonus: 100, check: m => (m.lvl || 0) >= 10 },
  level_25:         { emoji: "🌠", bonus: 250, check: m => (m.lvl || 0) >= 25 },
  level_50:         { emoji: "🏆", bonus: 500, check: m => (m.lvl || 0) >= 50 },
  verified:         { emoji: "✅", bonus: 10,  check: m => !!m.verified },
  beta_tester:      { emoji: "🔑", bonus: 100, check: m => !!m.beta },
};

function getOrder() {
  return Object.keys(ACHIEVEMENTS);
}

function getMeta(key) {
  return ACHIEVEMENTS[key] || null;
}

/**
 * Check all achievements against the current member state.
 * Grants newly earned ones and returns the list of keys that were just unlocked.
 * Does NOT send DMs — caller is responsible for notifying the user.
 */
function checkAndGrant(uid) {
  const member = db.getMem(uid);
  const earned = member.achievements || [];
  const newlyEarned = [];

  for (const [key, def] of Object.entries(ACHIEVEMENTS)) {
    if (earned.includes(key)) continue;
    if (!def.check(member)) continue;
    earned.push(key);
    newlyEarned.push(key);
  }

  if (newlyEarned.length) {
    db.updMem(uid, { achievements: earned });
  }
  return newlyEarned;
}

/**
 * Attempt to DM the user about the freshly unlocked achievements.
 * Silently ignores DM failures (closed DMs).
 */
async function notifyUnlocked(client, uid, guildId, keys) {
  if (!keys?.length) return;
  const lang = i18n.langForUser(uid, guildId);
  try {
    const user = await client.users.fetch(uid);
    for (const key of keys) {
      const meta = ACHIEVEMENTS[key];
      const name = i18n.t(`achievements.${key}.name`, lang);
      const desc = i18n.t(`achievements.${key}.desc`, lang);
      const title = i18n.t("achievements.unlocked_title", lang, { emoji: meta.emoji, name });
      await user.send({
        content: title,
        embeds: [{
          color: 0xf39c12,
          title,
          description: desc,
          footer: { text: i18n.t("achievements.xp_bonus", lang, { xp: meta.bonus }) },
        }],
      }).catch(() => {});
    }
  } catch (e) {
    logger.warn("Achievement DM failed:", e.message);
  }
}

/**
 * One-stop: check + grant + DM. Returns list of newly unlocked keys.
 */
async function trigger(client, uid, guildId) {
  const newly = checkAndGrant(uid);
  if (newly.length) await notifyUnlocked(client, uid, guildId, newly);
  return newly;
}

module.exports = {
  ACHIEVEMENTS,
  getOrder, getMeta,
  checkAndGrant, notifyUnlocked, trigger,
};

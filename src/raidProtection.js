// Raid protection — detects suspicious join bursts via sliding window.
// On trigger: alerts admins and optionally activates lockdown.
const { db } = require("./db");
const logger = require("./logger");
const i18n = require("./i18n");
const { EmbedBuilder, PermissionsBitField } = require("discord.js");

// Defaults — can be overridden per-guild in db.config in the future
const DEFAULTS = {
  windowMs: 10_000,  // 10-second window
  threshold: 5,      // 5 joins in window triggers alert
  lockdownCooldownMs: 10 * 60_000,  // don't re-alert within 10 min
  minAccountAgeDays: 7,  // accounts younger than this are "suspicious"
};

// Per-guild sliding window of recent join timestamps + suspicious member IDs
const recent = new Map(); // guildId → { joins: number[], suspicious: string[], lastAlertAt: number }

function entry(guildId) {
  let e = recent.get(guildId);
  if (!e) {
    e = { joins: [], suspicious: [], lastAlertAt: 0 };
    recent.set(guildId, e);
  }
  return e;
}

function prune(e, windowMs) {
  const cutoff = Date.now() - windowMs;
  e.joins = e.joins.filter(ts => ts > cutoff);
  // keep suspicious list as long as it could still be part of a raid window
  e.suspicious = e.suspicious.slice(-20);
}

function accountAgeDays(user) {
  if (!user?.createdTimestamp) return Infinity;
  return (Date.now() - user.createdTimestamp) / (1000 * 60 * 60 * 24);
}

/**
 * Record a new member join and check for raid.
 * Returns { triggered, reason, suspicious: [member] } if raid detected.
 */
function recordJoin(member, config = DEFAULTS) {
  const e = entry(member.guild.id);
  const now = Date.now();
  prune(e, config.windowMs);
  e.joins.push(now);

  const age = accountAgeDays(member.user);
  const isSuspicious = age < config.minAccountAgeDays;
  if (isSuspicious) {
    e.suspicious.push({ uid: member.id, name: member.displayName, age: Math.floor(age) });
  }

  // Check threshold
  if (e.joins.length >= config.threshold) {
    // Debounce alerts
    if (now - e.lastAlertAt < config.lockdownCooldownMs) {
      return { triggered: false, alreadyAlerted: true };
    }
    e.lastAlertAt = now;
    return {
      triggered: true,
      joinsInWindow: e.joins.length,
      windowSec: Math.round(config.windowMs / 1000),
      suspicious: e.suspicious.slice(-config.threshold),
    };
  }

  return { triggered: false, suspicious: isSuspicious };
}

/**
 * Alert staff via bot-log channel (or admin-panel) with details + lockdown button.
 * Does NOT auto-kick/ban — admins must decide.
 */
async function alertStaff(guild, detection) {
  const lang = i18n.resolveLang(null, guild.id);
  const cfg = db.getCfg(guild.id);
  const channelId = cfg?.logCh || cfg?.adminCh;
  if (!channelId) {
    logger.warn("[raid] No log channel configured for alert");
    return;
  }
  const channel = guild.channels.cache.get(channelId);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle(i18n.t("raid.alert_title", lang))
    .setDescription(i18n.t("raid.alert_desc", lang, {
      joins: detection.joinsInWindow,
      sec: detection.windowSec,
    }));

  if (detection.suspicious?.length) {
    embed.addFields({
      name: i18n.t("raid.suspicious_field", lang),
      value: detection.suspicious
        .map(s => i18n.t("raid.suspicious_line", lang, { uid: s.uid, name: s.name, age: s.age }))
        .join("\n")
        .slice(0, 1024),
    });
  }

  embed.setFooter({ text: i18n.t("raid.footer", lang) });
  embed.setTimestamp();

  try {
    await channel.send({
      content: "@here",
      embeds: [embed],
      allowedMentions: { parse: ["everyone"] },
    });
  } catch (e) {
    logger.error("[raid] Alert send failed:", e.message);
  }
}

module.exports = { recordJoin, alertStaff, DEFAULTS };

// Audit log — writes moderation events to configured bot-log channel
const { db } = require("./db");
const logger = require("./logger");

async function audit(guild, message) {
  try {
    const cfg = db.getCfg(guild.id);
    if (!cfg?.logCh) return;
    const channel = guild.channels.cache.get(cfg.logCh);
    if (!channel) return;
    const ts = new Date().toISOString().slice(0, 19);
    await channel.send(`\`${ts}\` ${message}`);
  } catch (e) {
    logger.warn("Audit log failed:", e.message);
  }
}

module.exports = { audit };

// Timer persistence for giveaways and polls — survives restarts
const { db } = require("./db");
const embedsFor = require("./embedsFor");
const logger = require("./logger");
const i18n = require("./i18n");

let client = null;

function init(discordClient) {
  client = discordClient;
}

async function endGiveawayNow(gid) {
  const result = db.endGiv(gid);
  if (!result) return;
  const g = db.getGiv(gid);
  if (!g || !g.chId || !g.msgId) return;
  try {
    const guild = g.gid ? client.guilds.cache.get(g.gid) : client.guilds.cache.first();
    if (!guild) return;
    const lang = i18n.resolveLang(null, guild.id);
    const E = embedsFor(lang);
    const channel = guild.channels.cache.get(g.chId);
    if (!channel) return;
    const msg = await channel.messages.fetch(g.msgId).catch(() => null);
    if (msg) await msg.edit({ embeds: [E.givE(g)], components: [] }).catch(() => {});
    const winners = result.winners.map(w => `<@${w}>`).join(", ") || i18n.t("giveaway.no_entries", lang);
    await channel.send(i18n.t("giveaway.winner", lang, { prize: g.prize, winners }));
  } catch (e) {
    logger.error("Giveaway end failed:", e.message);
  }
}

function scheduleGiveawayEnd(gid) {
  const g = db.getGiv(gid);
  if (!g || g.status !== "active") return;
  const remaining = new Date(g.ends).getTime() - Date.now();
  if (remaining <= 0) { endGiveawayNow(gid); return; }
  setTimeout(() => endGiveawayNow(gid), remaining);
}

async function endPollNow(pid) {
  const p = db.endPoll(pid);
  if (!p || !p.chId || !p.msgId) return;
  try {
    const guild = p.gid ? client.guilds.cache.get(p.gid) : client.guilds.cache.first();
    if (!guild) return;
    const lang = i18n.resolveLang(null, guild.id);
    const E = embedsFor(lang);
    const channel = guild.channels.cache.get(p.chId);
    if (!channel) return;
    const msg = await channel.messages.fetch(p.msgId).catch(() => null);
    if (msg) await msg.edit({ embeds: [E.polE(p)], components: [] }).catch(() => {});
  } catch (e) {
    logger.error("Poll end failed:", e.message);
  }
}

function schedulePollEnd(pid) {
  const p = db.getPoll(pid);
  if (!p || p.status !== "active" || !p.ends) return;
  const remaining = new Date(p.ends).getTime() - Date.now();
  if (remaining <= 0) { endPollNow(pid); return; }
  setTimeout(() => endPollNow(pid), remaining);
}

function restoreAll() {
  const givs = db.activeGivs();
  givs.forEach(g => scheduleGiveawayEnd(g.id));
  const polls = db.activePolls();
  polls.forEach(p => schedulePollEnd(p.id));
  return { giveaways: givs.length, polls: polls.length };
}

module.exports = { init, scheduleGiveawayEnd, schedulePollEnd, restoreAll };

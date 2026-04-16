// Crisis Mode — escalates critical/high severity bugs that remain unclaimed
// past their SLA window. Survives bot restarts (rehydrates from DB on ready).
const { db } = require("./db");
const logger = require("./logger");
const i18n = require("./i18n");

// SLA windows in milliseconds — critical bugs escalate faster
const SLA_MS = {
  critical: 30 * 60 * 1000,  // 30 min
  high:     2 * 60 * 60 * 1000,  // 2 hours
};

let client = null;
const pending = new Map(); // bugId → { timer, escalateAt }

function init(discordClient) {
  client = discordClient;
}

function slaFor(severity) {
  return SLA_MS[severity] || null;
}

/**
 * Schedule an escalation for a specific bug. Idempotent — if already scheduled, replaces.
 */
function schedule(bugId) {
  const bug = db.getBug(bugId);
  if (!bug) return;
  if (bug.status !== "open") return;  // already claimed / resolved / closed
  const sla = slaFor(bug.sev);
  if (!sla) return;  // only critical/high

  // Cancel any existing timer
  cancel(bugId);

  const createdAt = new Date(bug.at.replace(" ", "T")).getTime();
  const escalateAt = createdAt + sla;
  const delay = escalateAt - Date.now();

  if (delay <= 0) {
    // Already past SLA — escalate immediately
    escalate(bugId);
    return;
  }

  const timer = setTimeout(() => escalate(bugId), delay);
  pending.set(bugId, { timer, escalateAt });
}

function cancel(bugId) {
  const entry = pending.get(bugId);
  if (entry) {
    clearTimeout(entry.timer);
    pending.delete(bugId);
  }
}

/**
 * Actually send the escalation ping. Only triggers if the bug is still unclaimed.
 */
async function escalate(bugId) {
  pending.delete(bugId);
  const bug = db.getBug(bugId);
  if (!bug) return;

  // Re-check conditions: must still be unclaimed, unresolved, and high-priority
  if (bug.status !== "open" || bug.to) return;
  if (!slaFor(bug.sev)) return;
  if (bug.escalated) return;  // already escalated once

  try {
    db.markEscalated(bugId);
    const lang = i18n.resolveLang(null, null);  // server-default; bug carries no guildId
    const cfg = bug.chId ? null : null;
    // Fetch guild from channel
    if (!bug.chId || !bug.msgId) return;

    // Find the guild that owns this channel
    let guild = null;
    for (const [gid, g] of client.guilds.cache) {
      if (g.channels.cache.has(bug.chId)) { guild = g; break; }
    }
    if (!guild) return;

    const guildLang = i18n.resolveLang(null, guild.id);
    const guildCfg = db.getCfg(guild.id);
    if (!guildCfg?.leadRole) {
      logger.warn(`[crisis] ${bug.tag} would escalate but no leadRole configured`);
      return;
    }

    const channel = guild.channels.cache.get(bug.chId);
    if (!channel) return;

    const minutes = Math.floor(slaFor(bug.sev) / 60000);
    await channel.send({
      content: i18n.t("crisis.escalation_ping", guildLang, {
        role: guildCfg.leadRole,
        tag: bug.tag,
        sev: i18n.t(`bug.severity.${bug.sev}`, guildLang),
        minutes,
      }),
      allowedMentions: { roles: [guildCfg.leadRole] },
    });

    logger.info(`[crisis] Escalated ${bug.tag} after ${minutes}min unclaimed`);
  } catch (e) {
    logger.error("[crisis] Escalation failed:", e.message);
  }
}

/**
 * On bot ready, re-schedule timers for all active critical/high unassigned bugs.
 */
function restoreAll() {
  const eligible = db.bugsActive()
    .filter(b => b.status === "open" && !b.to && slaFor(b.sev) && !b.escalated);
  eligible.forEach(b => schedule(b.id));
  return eligible.length;
}

module.exports = { init, schedule, cancel, escalate, restoreAll, SLA_MS };

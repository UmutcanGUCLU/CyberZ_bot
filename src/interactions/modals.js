// Modal submit dispatcher
const {
  ChannelType: CH, EmbedBuilder: EB,
  ActionRowBuilder: AR, ButtonBuilder: BB, ButtonStyle: BS
} = require("discord.js");
const { db } = require("../db");
const embedsFor = require("../embedsFor");
const { audit } = require("../audit");
const i18n = require("../i18n");
const rateLimit = require("../rateLimit");
const achievements = require("../achievements");
const pendingBugs = require("../pendingBugs");
const { isDevOrMod } = require("../permissions");
const crisisMode = require("../crisisMode");

const SEVERITIES = ["critical", "high", "medium", "low"];
const PLATFORMS  = ["pc", "playstation", "ps", "xbox", "mobile", "all"];

// Spam prevention cooldowns
const BUG_COOLDOWN_S = 30;

// Shared: actually create the bug (posts to channel, audits, pings, achievements).
// Used by the fresh-report path AND the "create new anyway" duplicate resolution path.
//
// Ticket-style privacy: every bug gets its own dedicated channel under "Bug Tickets".
// Permissions start as { reporter, bot } + admin bypass. When a crew member claims the bug,
// they're added via ensureBugMember(). Non-claiming crew cannot see other members' bug tickets.
async function createBugFromData(client, ix, data) {
  const bug = db.mkBug({
    title: data.title, desc: data.desc, steps: data.steps,
    sev: data.severity, plat: data.platform,
    cat: "gameplay", uid: ix.user.id, name: ix.user.displayName,
  });
  db.incBugs(ix.user.id);

  const cfg = db.getCfg(ix.guildId);
  const chLang = i18n.resolveLang(null, ix.guildId);
  const chE = embedsFor(chLang);
  const chT = (k, p) => i18n.t(k, chLang, p);

  // Try to create a private "Bug Tickets" channel for this report. If it fails
  // (bot missing ManageChannels, Discord outage, etc.) fall back to admin-panel so the bug
  // isn't stranded — the DB row is already saved and we need somewhere to post the embed.
  let bugCh = null;
  try {
    let bugCat = ix.guild.channels.cache.find(
      c => c.name === "Bug Tickets" && c.type === CH.GuildCategory
    );
    if (!bugCat) {
      bugCat = await ix.guild.channels.create({
        name: "Bug Tickets",
        type: CH.GuildCategory,
        permissionOverwrites: [
          { id: ix.guild.id,    deny:  ["ViewChannel"] },
          { id: client.user.id, allow: ["ViewChannel", "ManageChannels"] },
        ],
      });
    }
    const sanitized = (ix.user.displayName || ix.user.username).toLowerCase().replace(/[^a-z0-9]/g, "") || "user";
    bugCh = await ix.guild.channels.create({
      name: `${bug.tag.toLowerCase()}-${sanitized}`,
      type: CH.GuildText,
      parent: bugCat.id,
      topic: `${bug.tag} — ${data.title.slice(0, 80)}`,
      permissionOverwrites: [
        { id: ix.guild.id,    deny:  ["ViewChannel"] },
        { id: client.user.id, allow: ["ViewChannel", "SendMessages", "ManageChannels", "ManageMessages"] },
        { id: ix.user.id,     allow: ["ViewChannel", "SendMessages", "ReadMessageHistory", "AttachFiles", "EmbedLinks"] },
      ],
    });
  } catch (e) {
    // Logged to audit so staff know the ticket flow degraded.
    await audit(ix.guild, `⚠️ ${bug.tag}: bug channel creation failed — ${e.message}`);
  }

  const adminCh = cfg?.adminCh ? ix.guild.channels.cache.get(cfg.adminCh) : null;
  const postCh = bugCh || adminCh || ix.channel;
  // Full button set on every post. Non-crew clicks on staff actions are rejected at the
  // handler level with an ephemeral English "no permission" response — Discord can't hide
  // components per-viewer, so runtime gating is the cleanest we can do.
  const msg = await postCh.send({
    content: chT("bug.new_bug", { tag: bug.tag, uid: ix.user.id }),
    embeds: [chE.bugE(bug, db.getHist(bug.id))],
    components: chE.bugBB(bug),
  });
  db.setRef(bug.id, postCh.id, msg.id);

  // Summary in admin-panel (only when we have a separate dedicated channel to link to).
  if (adminCh && bugCh && adminCh.id !== bugCh.id) {
    try {
      await adminCh.send(chT("bug.admin_notify", {
        tag: bug.tag, uid: ix.user.id, channel: `<#${bugCh.id}>`, sev: data.severity,
      }));
      if (data.severity === "critical" && cfg?.devRole) {
        await adminCh.send(chT("bug.critical_alert", { role: cfg.devRole, tag: bug.tag }));
      }
    } catch {}
  }

  await audit(ix.guild, `🐛 ${bug.tag} — ${data.title} (${data.severity})`);

  achievements.trigger(client, ix.user.id, ix.guildId).catch(() => {});
  crisisMode.schedule(bug.id);
  return bug;
}

// Refresh the bug's ticket-channel message in place. Best-effort — errors swallowed.
async function refreshBugTicket(guild, bug, lang) {
  if (!bug?.chId || !bug?.msgId) return;
  const ch = guild.channels.cache.get(bug.chId);
  if (!ch) return;
  const parent = ch.parentId ? guild.channels.cache.get(ch.parentId) : null;
  if (parent?.name !== "Bug Tickets") return;
  const E = require("../embedsFor")(lang);
  const { db: d } = require("../db");
  try {
    const msg = await ch.messages.fetch(bug.msgId);
    await msg.edit({
      embeds: [E.bugE(bug, d.getHist(bug.id), d.getCmts(bug.id))],
      components: E.bugBB(bug),
    });
  } catch {}
}

const refreshBugMain = refreshBugTicket;

// Grant/revoke access to a bug's dedicated channel. Used when crew claim or are assigned.
// Only touches channels whose parent category is "Bug Tickets" — legacy bugs whose chId points
// at admin-panel or elsewhere must not have their perms mutated.
async function ensureBugMember(guild, bug, userId, allow) {
  if (!bug?.chId || !userId) return;
  const ch = guild.channels.cache.get(bug.chId);
  if (!ch) return;
  const parent = ch.parentId ? guild.channels.cache.get(ch.parentId) : null;
  if (parent?.name !== "Bug Tickets") return;
  try {
    if (allow) {
      await ch.permissionOverwrites.edit(userId, {
        ViewChannel: true, SendMessages: true, ReadMessageHistory: true,
        AttachFiles: true, EmbedLinks: true,
      });
    } else {
      await ch.permissionOverwrites.delete(userId).catch(() => {});
    }
  } catch {}
}

async function handleModal(ix, client) {
  const id = ix.customId;
  const lang = i18n.langOf(ix);
  const t = (k, p) => i18n.t(k, lang, p);
  const E = embedsFor(lang);

  // ===== New bug report =====
  if (id === "m_bug") {
    const left = rateLimit.check(ix.user.id, "bug_report", BUG_COOLDOWN_S);
    if (left > 0) return ix.reply({ content: t("cooldown.bug_report", { s: left }), ephemeral: true });
    const title    = ix.fields.getTextInputValue("t");
    const desc     = ix.fields.getTextInputValue("d");
    const steps    = ix.fields.getTextInputValue("s") || "";
    let severity   = ix.fields.getTextInputValue("v").toLowerCase().trim();
    let platform   = (ix.fields.getTextInputValue("p") || "all").toLowerCase().trim();
    if (!SEVERITIES.includes(severity)) severity = "medium";
    if (!PLATFORMS.includes(platform)) platform = "all";

    // Duplicate detection — search for similar active bugs first
    const activeMatches = db.search(title)
      .filter(b => ["open", "in-progress"].includes(b.status))
      .slice(0, 3);

    if (activeMatches.length) {
      // Stash submission for 5 minutes; user decides via buttons
      pendingBugs.put(ix.user.id, { title, desc, steps, severity, platform });
      const hasKnown = activeMatches.some(b => b.known);
      const lines = activeMatches.map(b => {
        const sevEmoji = { critical: "🔴", high: "🟠", medium: "🟡", low: "🟢" }[b.sev] || "⚪";
        const knownTag = b.known ? " ⚠️" : "";
        return `${sevEmoji} **${b.tag}** ${b.title}${knownTag}`;
      }).join("\n");
      const embed = new EB()
        .setColor(hasKnown ? 0xf39c12 : 0x3498db)
        .setTitle(t("duplicate.found_title"))
        .setDescription((hasKnown ? `${t("duplicate.known_notice")}\n\n` : "") + t("duplicate.found_desc") + "\n\n" + lines);

      const voteRow = new AR().addComponents(
        ...activeMatches.map(b =>
          new BB().setCustomId(`dup_vote_${b.id}`).setLabel(t("duplicate.vote_btn", { tag: b.tag })).setStyle(BS.Success)
        )
      );
      const actionRow = new AR().addComponents(
        new BB().setCustomId("dup_new").setLabel(t("duplicate.create_new_btn")).setStyle(BS.Primary).setEmoji("🆕"),
        new BB().setCustomId("dup_cancel").setLabel(t("duplicate.cancel_btn")).setStyle(BS.Secondary),
      );
      return ix.reply({ embeds: [embed], components: [voteRow, actionRow], ephemeral: true });
    }

    // No duplicates — create directly
    const bug = await createBugFromData(client, ix, { title, desc, steps, severity, platform });
    return ix.reply({ content: t("bug.created", { tag: bug.tag }), ephemeral: true });
  }

  // ===== Bug resolution =====
  if (id.startsWith("mr_")) {
    const bid = parseInt(id.slice(3));
    const note = ix.fields.getTextInputValue("n");
    const b = db.getBug(bid);
    if (!b) return ix.reply({ content: t("common.not_found"), ephemeral: true });

    db.resolveBug(bid, note, ix.user.displayName);
    crisisMode.cancel(bid);
    if (b.to) db.incRes(b.to);
    const updated = db.getBug(bid);
    await ix.update({ embeds: [E.bugE(updated, db.getHist(bid), db.getCmts(bid))], components: E.bugBB(updated) });
    await audit(ix.guild, `✅ ${updated.tag}: ${note}`);

    if (b.by !== ix.user.id) {
      try {
        const reporter = await client.users.fetch(b.by);
        const reporterLang = i18n.langForUser(b.by, ix.guildId);
        await reporter.send(i18n.t("bug.resolved_dm", reporterLang, { tag: updated.tag, note }));
      } catch {}
    }
    return;
  }

  // ===== Mark bug as known (workaround modal) =====
  if (id.startsWith("mmk_")) {
    if (!isDevOrMod(ix.member)) return ix.reply({ content: t("bug.dev_only"), ephemeral: true });
    const bid = parseInt(id.slice(4));
    const workaround = ix.fields.getTextInputValue("w") || null;
    const bug = db.markKnown(bid, workaround, ix.user.displayName);
    if (!bug) return ix.reply({ content: t("common.not_found"), ephemeral: true });
    await ix.update({ embeds: [E.bugE(bug, db.getHist(bid), db.getCmts(bid))], components: E.bugBB(bug) });
    return audit(ix.guild, `⚠️ ${bug.tag} marked known by ${ix.user.displayName}`);
  }

  // ===== Verification rules edit =====
  if (id === "m_verify_rules") {
    if (!isDevOrMod(ix.member)) return ix.reply({ content: t("common.staff_required"), ephemeral: true });
    const newRules = ix.fields.getTextInputValue("rules");
    db.setCfg(ix.guildId, { verifyRules: newRules });
    // If a panel was placed before, edit it in place so the change is visible immediately.
    const cfg = db.getCfg(ix.guildId);
    if (cfg?.verifyPanelCh && cfg?.verifyMsgId) {
      try {
        const ch = ix.guild.channels.cache.get(cfg.verifyPanelCh);
        if (ch) {
          const msg = await ch.messages.fetch(cfg.verifyMsgId);
          const embedsMod = require("../embedsFor")(lang);
          await msg.edit({ embeds: [embedsMod.verifyP(lang, newRules)], components: embedsMod.verifyB(lang) });
        }
      } catch {}
    }
    return ix.reply({ content: t("verify.rules_saved"), ephemeral: true });
  }

  // ===== Bug comment =====
  if (id.startsWith("mc_")) {
    const bid = parseInt(id.slice(3));
    const text = ix.fields.getTextInputValue("t");
    db.addCmt(bid, ix.user.id, ix.user.displayName, text);
    const updated = db.getBug(bid);
    return ix.update({ embeds: [E.bugE(updated, db.getHist(bid), db.getCmts(bid))], components: E.bugBB(updated) });
  }

  // ===== Ticket submission =====
  if (id.startsWith("mt_")) {
    const cat = id.slice(3);
    const desc = ix.fields.getTextInputValue("d");
    const t = db.mkTkt(ix.user.id, ix.user.displayName, cat, desc);

    const g = ix.guild;
    let ticketCat = g.channels.cache.find(ch => ch.name === "Tickets" && ch.type === CH.GuildCategory);
    if (!ticketCat) {
      ticketCat = await g.channels.create({
        name: "Tickets",
        type: CH.GuildCategory,
        permissionOverwrites: [
          { id: g.id,           deny:  ["ViewChannel"] },
          { id: client.user.id, allow: ["ViewChannel", "ManageChannels"] },
        ],
      });
    }

    const sanitized = ix.user.displayName.toLowerCase().replace(/[^a-z0-9]/g, "");
    const ch = await g.channels.create({
      name: `ticket-${t.id}-${sanitized}`,
      type: CH.GuildText,
      parent: ticketCat.id,
      permissionOverwrites: [
        { id: g.id, deny: ["ViewChannel"] },
        { id: ix.user.id, allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"] },
        { id: client.user.id, allow: ["ViewChannel", "SendMessages", "ManageChannels"] },
      ]
    });

    const cfg = db.getCfg(ix.guildId);
    if (cfg?.devRole) {
      try { await ch.permissionOverwrites.create(cfg.devRole, { ViewChannel: true, SendMessages: true }); } catch {}
    }
    if (cfg?.leadRole) {
      try { await ch.permissionOverwrites.create(cfg.leadRole, { ViewChannel: true, SendMessages: true }); } catch {}
    }
    db.setTktCh(t.id, ch.id);

    await ch.send({
      content: `<@${ix.user.id}>`,
      embeds: [E.tktE(t)],
      components: [new AR().addComponents(
        new BB().setCustomId(`tc_${t.id}`).setLabel("Claim").setStyle(BS.Primary).setEmoji("🙋"),
        new BB().setCustomId(`tx_${t.id}`).setLabel("Close").setStyle(BS.Danger).setEmoji("🔒")
      )]
    });

    await ix.reply({ content: `<#${ch.id}>`, ephemeral: true });
    return audit(ix.guild, `🎫 ${t.tag} — ${ix.user.displayName}`);
  }

  // ===== New suggestion =====
  if (id === "m_sug") {
    const title = ix.fields.getTextInputValue("t");
    const desc = ix.fields.getTextInputValue("d");
    const cat = (ix.fields.getTextInputValue("c") || "general").toLowerCase().trim();
    const s = db.mkSug(ix.user.id, ix.user.displayName, title, desc, cat);

    const cfg = db.getCfg(ix.guildId);
    const ch = cfg?.sugCh ? ix.guild.channels.cache.get(cfg.sugCh) : ix.channel;
    const chLang = i18n.resolveLang(null, ix.guildId);
    const chE = embedsFor(chLang);
    const msg = await (ch || ix.channel).send({
      content: i18n.t("suggestion.new_suggestion", chLang, { tag: s.tag }),
      embeds: [chE.sugC(s)],
      components: [chE.sugVB(s.id), chE.sugAB(s.id)]
    });
    db.setSugMsg(s.id, (ch || ix.channel).id, msg.id);

    await ix.reply({ content: t("suggestion.submitted", { tag: s.tag }), ephemeral: true });
    return audit(ix.guild, `💡 ${s.tag} — ${title}`);
  }

  // ===== Team response to suggestion =====
  if (id.startsWith("ms_")) {
    const parts = id.split("_");
    const status = parts[1], sid = parseInt(parts[2]);
    const response = ix.fields.getTextInputValue("r");
    const s = db.respSug(sid, status, response, ix.user.displayName);
    if (!s) return ix.reply({ content: t("common.not_found"), ephemeral: true });

    await ix.update({ embeds: [E.sugC(s)], components: [E.sugVB(sid)] });
    try {
      const u = await client.users.fetch(s.uid);
      const userLang = i18n.langForUser(s.uid, ix.guildId);
      const statusLabel = i18n.t(`suggestion.status.${status}`, userLang);
      await u.send({ embeds: [
        new EB().setTitle(i18n.t("suggestion.response_dm_title", userLang)).setColor(0xf39c12).setDescription(
          i18n.t("suggestion.response_dm_desc", userLang, { tag: s.tag, title: s.title, status: statusLabel, response })
        )
      ]});
    } catch {}
    return audit(ix.guild, `💡 ${s.tag} → ${status}`);
  }

  // ===== Beta application =====
  if (id === "m_beta") {
    const reason = ix.fields.getTextInputValue("r");
    const platform = ix.fields.getTextInputValue("p");
    const a = db.applyBeta(ix.user.id, ix.user.displayName, reason, platform);
    if (a.err === "pending") return ix.reply({ content: t("beta.already_pending"), ephemeral: true });
    if (a.err === "has_key") return ix.reply({ content: t("beta.already_have_key"), ephemeral: true });

    await ix.reply({ content: t("beta.application_received", { id: a.id }), ephemeral: true });

    const cfg = db.getCfg(ix.guildId);
    const reviewChannel = cfg?.betaRev ? ix.guild.channels.cache.get(cfg.betaRev) : null;
    if (reviewChannel) {
      const chLang = i18n.resolveLang(null, ix.guildId);
      const chE = embedsFor(chLang);
      await reviewChannel.send({
        content: i18n.t("beta.review_header", chLang, { id: a.id }),
        embeds: [chE.betaC(a)],
        components: [chE.betaCB(a.id)]
      });
    }
    return audit(ix.guild, `📨 Beta #${a.id} — ${ix.user.displayName}`);
  }

  // ===== Q&A question submission =====
  if (id.startsWith("m_qa_")) {
    const qaId = parseInt(id.slice(5));
    const qa = db.getQa(qaId);
    if (!qa || qa.status !== "open") {
      return ix.reply({ content: t("qa.no_active"), ephemeral: true });
    }
    const text = ix.fields.getTextInputValue("q");
    db.addQaQuestion(qaId, ix.user.id, ix.user.displayName, text);
    return ix.reply({ content: t("qa.submitted"), ephemeral: true });
  }

  // ===== Beta key upload =====
  if (id === "m_keys") {
    if (!isDevOrMod(ix.member)) {
      return ix.reply({ content: t("bug.dev_only"), ephemeral: true });
    }
    // Defer immediately — dedup against large pools can exceed Discord's 3s ack window
    await ix.deferReply({ ephemeral: true });
    try {
      const raw = ix.fields.getTextInputValue("k") || "";
      const keys = raw
        .split(/[\s,;]+/)
        .map(k => k.trim())
        .filter(k => k.length > 2);
      if (!keys.length) {
        return ix.editReply({ content: t("beta.keys_added", { added: 0, total: db.betaSt().available }) });
      }
      const r = db.addKeys(keys);
      await ix.editReply({ content: t("beta.keys_added", { added: r.added, total: r.total }) });
      return audit(ix.guild, `🔑 ${r.added} keys added`);
    } catch (e) {
      require("../logger").error("Key upload failed:", e);
      return ix.editReply({ content: t("common.error_generic") }).catch(() => {});
    }
  }
}

module.exports = { handleModal, createBugFromData, ensureBugMember, refreshBugMain, refreshBugTicket };

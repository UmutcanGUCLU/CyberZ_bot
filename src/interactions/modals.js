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
async function createBugFromData(client, ix, data) {
  const bug = db.mkBug({
    title: data.title, desc: data.desc, steps: data.steps,
    sev: data.severity, plat: data.platform,
    cat: "gameplay", uid: ix.user.id, name: ix.user.displayName,
  });
  db.incBugs(ix.user.id);

  const cfg = db.getCfg(ix.guildId);
  const ch = cfg?.bugCh ? ix.guild.channels.cache.get(cfg.bugCh) : ix.channel;
  const chLang = i18n.resolveLang(null, ix.guildId);
  const chE = embedsFor(chLang);
  const chT = (k, p) => i18n.t(k, chLang, p);
  const msg = await (ch || ix.channel).send({
    content: chT("bug.new_bug", { tag: bug.tag, uid: ix.user.id }),
    embeds: [chE.bugE(bug, db.getHist(bug.id))],
    components: chE.bugBB(bug),
  });
  db.setRef(bug.id, (ch || ix.channel).id, msg.id);

  await audit(ix.guild, `🐛 ${bug.tag} — ${data.title} (${data.severity})`);
  if (data.severity === "critical" && cfg?.devRole) {
    await (ch || ix.channel).send(chT("bug.critical_alert", { role: cfg.devRole, tag: bug.tag }));
  }

  // Auto-create discussion thread for critical/high severity bugs
  // (gives reporter a place to attach screenshots, logs, etc.)
  if ((data.severity === "critical" || data.severity === "high") && msg.startThread) {
    try {
      const thread = await msg.startThread({
        name: `${bug.tag} · ${data.title.slice(0, 60)}`,
        autoArchiveDuration: 1440,
      });
      db.setTh(bug.id, thread.id);
      await thread.send({
        content: `<@${ix.user.id}>`,
        embeds: [new EB()
          .setColor(0x5865f2)
          .setDescription(chT("bug.auto_thread_welcome"))],
      });
    } catch (e) {
      // Thread creation is best-effort — silently continue if Discord rejects
    }
  }

  achievements.trigger(client, ix.user.id, ix.guildId).catch(() => {});
  // Start crisis-mode escalation timer for critical/high unassigned bugs
  crisisMode.schedule(bug.id);
  return bug;
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

    await ix.update({ embeds: [E.bugE(updated, db.getHist(bid))], components: E.bugBB(updated) });
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
    if (!ticketCat) ticketCat = await g.channels.create({ name: "Tickets", type: CH.GuildCategory });

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

module.exports = { handleModal, createBugFromData };

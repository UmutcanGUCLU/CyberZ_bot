// Button interaction dispatcher
const {
  ModalBuilder: MB, TextInputBuilder: TI, TextInputStyle: TS,
  ActionRowBuilder: AR, EmbedBuilder: EB,
  ButtonBuilder: BB, ButtonStyle: BS,
  ChannelType: CH, PermissionsBitField: P,
  UserSelectMenuBuilder: USM, StringSelectMenuBuilder: SSM
} = require("discord.js");
const { db } = require("../db");
const embedsFor = require("../embedsFor");
const { audit } = require("../audit");
const i18n = require("../i18n");
const achievements = require("../achievements");
const { paginate, pageRow } = require("../pagination");
const pendingBugs = require("../pendingBugs");
const { createBugFromData } = require("./modals");
const { isDevOrMod } = require("../permissions");
const crisisMode = require("../crisisMode");
const panels = require("../panels");

async function dmBugStatus(client, uid, guildId, key, params) {
  if (!uid) return;
  try {
    const lang = i18n.langForUser(uid, guildId);
    const user = await client.users.fetch(uid);
    await user.send({ embeds: [{
      color: 0x5865f2,
      title: i18n.t(`status_dm.${key}_title`, lang),
      description: i18n.t(`status_dm.${key}_desc`, lang, params),
    }]}).catch(() => {});
  } catch {}
}

// Whitelist for bug action prefixes (prevents ID collision with unknown buttons)
const BUG_ACTIONS = ["cl", "ua", "rv", "cx", "ro", "vu", "cm", "th", "hi"];

async function handleButton(ix, client) {
  const id = ix.customId;
  const lang = i18n.langOf(ix);
  const t = (k, p) => i18n.t(k, lang, p);
  const E = embedsFor(lang);

  // ===== Dev actions on bug card (permission-gated) =====
  if (id.startsWith("mk_") || id.startsWith("umk_") || id.startsWith("asg_") || id.startsWith("sev_")) {
    if (!isDevOrMod(ix.member)) {
      return ix.reply({ content: t("bug.dev_only"), ephemeral: true });
    }

    // Mark as known — show modal for workaround
    if (id.startsWith("mk_") && !id.startsWith("mkc_")) {
      const bid = parseInt(id.slice(3));
      const bug = db.getBug(bid);
      if (!bug) return ix.reply({ content: t("common.not_found"), ephemeral: true });
      const m = new MB().setCustomId(`mmk_${bid}`).setTitle(t("bug.mark_known_title"));
      m.addComponents(new AR().addComponents(
        new TI().setCustomId("w").setLabel(t("bug.mark_known_workaround_label")).setStyle(TS.Paragraph).setRequired(false).setMaxLength(500)
      ));
      return ix.showModal(m);
    }

    // Unmark known — direct action
    if (id.startsWith("umk_")) {
      const bid = parseInt(id.slice(4));
      const bug = db.unmarkKnown(bid, ix.user.displayName);
      if (!bug) return ix.reply({ content: t("common.not_found"), ephemeral: true });
      await ix.update({ embeds: [E.bugE(bug, db.getHist(bid), db.getCmts(bid))], components: E.bugBB(bug) });
      return audit(ix.guild, `✅ ${bug.tag} unmarked known by ${ix.user.displayName}`);
    }

    // Assign — show user picker
    if (id.startsWith("asg_")) {
      const bid = parseInt(id.slice(4));
      const bug = db.getBug(bid);
      if (!bug) return ix.reply({ content: t("common.not_found"), ephemeral: true });
      const select = new USM()
        .setCustomId(`asgsel_${bid}`)
        .setPlaceholder(t("bug.assign_placeholder"))
        .setMinValues(0).setMaxValues(1);
      const row = new AR().addComponents(select);
      const clearRow = new AR().addComponents(
        new BB().setCustomId(`asgclr_${bid}`).setLabel(t("bug.assign_cleared").replace("↩️ ", "↩️ ")).setStyle(BS.Secondary),
      );
      return ix.reply({
        embeds: [new EB().setColor(0x5865f2).setTitle(t("bug.assign_title")).setDescription(`**${bug.tag}:** ${bug.title}\n\n${t("bug.assign_desc")}`)],
        components: [row, clearRow],
        ephemeral: true,
      });
    }

    // Severity — show severity picker
    if (id.startsWith("sev_") && !id.startsWith("sevsel_")) {
      const bid = parseInt(id.slice(4));
      const bug = db.getBug(bid);
      if (!bug) return ix.reply({ content: t("common.not_found"), ephemeral: true });
      const select = new SSM()
        .setCustomId(`sevsel_${bid}`)
        .setPlaceholder(t("bug.severity_placeholder"))
        .addOptions(
          { label: t("bug.severity.critical"), value: "critical", emoji: "🔴", default: bug.sev === "critical" },
          { label: t("bug.severity.high"),     value: "high",     emoji: "🟠", default: bug.sev === "high" },
          { label: t("bug.severity.medium"),   value: "medium",   emoji: "🟡", default: bug.sev === "medium" },
          { label: t("bug.severity.low"),      value: "low",      emoji: "🟢", default: bug.sev === "low" },
        );
      return ix.reply({
        embeds: [new EB().setColor(0x5865f2).setTitle(t("bug.severity_title")).setDescription(`**${bug.tag}:** ${bug.title}\n\n${t("bug.severity_desc")}`)],
        components: [new AR().addComponents(select)],
        ephemeral: true,
      });
    }
  }

  // ===== Assign clear button (from user picker ephemeral) =====
  if (id.startsWith("asgclr_")) {
    if (!isDevOrMod(ix.member)) return ix.reply({ content: t("bug.dev_only"), ephemeral: true });
    const bid = parseInt(id.slice(7));
    db.unassignBug(bid, ix.user.displayName);
    const updated = db.getBug(bid);
    // Refresh the public bug card
    if (updated?.chId && updated?.msgId) {
      try {
        const ch = ix.guild.channels.cache.get(updated.chId);
        if (ch) {
          const msg = await ch.messages.fetch(updated.msgId);
          const chLang = i18n.resolveLang(null, ix.guildId);
          const chE = embedsFor(chLang);
          await msg.edit({ embeds: [chE.bugE(updated, db.getHist(bid), db.getCmts(bid))], components: chE.bugBB(updated) });
        }
      } catch {}
    }
    return ix.update({ content: t("bug.assign_cleared"), embeds: [], components: [] });
  }

  // ===== Duplicate resolution (after duplicate detection) =====
  if (id.startsWith("dup_vote_")) {
    const bid = parseInt(id.slice(9));
    const bug = db.getBug(bid);
    if (!bug) return ix.update({ content: t("common.not_found"), embeds: [], components: [] });
    db.vote(bid, ix.user.id);
    pendingBugs.clear(ix.user.id);
    // Refresh the voted-on bug's public card if it's tracked
    if (bug.chId && bug.msgId) {
      try {
        const chLang = i18n.resolveLang(null, ix.guildId);
        const chE = embedsFor(chLang);
        const ch = ix.guild.channels.cache.get(bug.chId);
        if (ch) {
          const msg = await ch.messages.fetch(bug.msgId);
          const updated = db.getBug(bid);
          await msg.edit({ embeds: [chE.bugE(updated, db.getHist(bid), db.getCmts(bid))], components: chE.bugBB(updated) });
        }
      } catch {}
    }
    return ix.update({ content: t("duplicate.voted", { tag: bug.tag }), embeds: [], components: [] });
  }
  if (id === "dup_new") {
    const data = pendingBugs.take(ix.user.id);
    if (!data) return ix.update({ content: t("duplicate.expired"), embeds: [], components: [] });
    const bug = await createBugFromData(client, ix, data);
    return ix.update({ content: t("bug.created", { tag: bug.tag }), embeds: [], components: [] });
  }
  if (id === "dup_cancel") {
    pendingBugs.clear(ix.user.id);
    return ix.update({ content: t("common.cancel"), embeds: [], components: [] });
  }

  // ===== Pagination =====
  if (id.startsWith("pbug_")) {
    // pbug_<filter>_<page>
    const rest = id.slice(5);
    const lastUnderscore = rest.lastIndexOf("_");
    const filter = rest.slice(0, lastUnderscore);
    const pageStr = rest.slice(lastUnderscore + 1);
    if (pageStr === "info") return ix.deferUpdate();
    const page = parseInt(pageStr, 10);
    if (isNaN(page)) return;
    const all = filter === "all" ? db.bugsActive() : db.bugsBy(filter);
    const pageInfo = paginate(all, page);
    const title = filter === "all" ? t("bug.list_title_active") : `📋 ${t(`bug.status.${filter}`) || filter}`;
    const components = [E.filtS()];
    if (pageInfo.totalPages > 1) components.push(pageRow(`pbug_${filter}`, pageInfo.page, pageInfo.totalPages));
    return ix.update({ embeds: [E.listE(pageInfo.items, title, pageInfo)], components });
  }
  if (id.startsWith("plb_")) {
    const pageStr = id.slice(4);
    if (pageStr === "info") return ix.deferUpdate();
    const page = parseInt(pageStr, 10);
    if (isNaN(page)) return;
    const all = db.topMembers();
    const pageInfo = paginate(all, page);
    const components = pageInfo.totalPages > 1 ? [pageRow("plb", pageInfo.page, pageInfo.totalPages)] : [];
    return ix.update({ embeds: [E.lbE(pageInfo.items, { ...pageInfo, perPage: 10 })], components });
  }

  // ===== Dashboard Hub Navigation =====
  if (id.startsWith("hub_")) {
    const nav = id.slice(4);
    // Determine which panel to render
    const render = (embedFn, btnFn) => {
      const embed = embedFn();
      const comps = btnFn();
      // Public panels (placed by admin) use update via interaction reply.
      // Ephemeral dashboards (via /panel) also use update.
      return ix.update({ embeds: [embed], components: comps });
    };

    if (nav === "main" || nav === "refresh") {
      return render(() => panels.mainHub(ix.guildId, lang), () => panels.mainHubButtons(lang));
    }
    if (nav === "bugs") {
      return render(() => panels.bugsHub(lang), () => panels.bugsHubButtons(lang));
    }
    if (nav === "tickets") {
      return render(() => panels.ticketsHub(lang), () => panels.ticketsHubButtons(lang));
    }
    if (nav === "community") {
      return render(() => panels.communityHub(lang), () => panels.communityHubButtons(lang));
    }
    if (nav === "profile") {
      const lb = db.topMembers();
      const rank = (lb.findIndex(x => x.uid === ix.user.id) + 1) || "?";
      return render(
        () => panels.profileHub(ix.user.id, rank, lang),
        () => panels.profileHubButtons(lang),
      );
    }
    if (nav === "badges") {
      return render(() => panels.badgesHub(ix.user.id, lang), () => panels.badgesHubButtons(lang));
    }
    if (nav === "patches") {
      return render(() => panels.patchesHub(lang), () => panels.patchesHubButtons(lang));
    }
    if (nav === "known") {
      return render(() => panels.knownHub(lang), () => panels.knownHubButtons(lang));
    }
    if (nav === "faq") {
      return render(() => panels.faqHub(lang), () => panels.faqHubButtons(lang));
    }
    if (nav === "lang") {
      // Show language picker in-place
      const { AR: _AR, BB: _BB, BS: _BS } = { AR, BB, BS };
      return ix.update({
        embeds: [new EB().setColor(0x5865f2).setTitle(t("language.panel_title")).setDescription(t("language.panel_desc", { current: i18n.meta(lang).flag + " " + i18n.meta(lang).name }))],
        components: [new AR().addComponents(
          new BB().setCustomId("lang_tr").setLabel("Türkçe").setEmoji("🇹🇷").setStyle(BS.Primary),
          new BB().setCustomId("lang_en").setLabel("English").setEmoji("🇬🇧").setStyle(BS.Secondary),
          new BB().setCustomId("hub_main").setLabel(t("panel.btn_back_hub")).setEmoji("🏠").setStyle(BS.Secondary),
        )],
      });
    }
    // Bug sub-views
    if (nav === "bugs_list") {
      const bugs = db.bugsActive();
      const { paginate, pageRow } = require("../pagination");
      const pageInfo = paginate(bugs, 1);
      const components = [E.filtS()];
      if (pageInfo.totalPages > 1) components.push(pageRow("pbug_all", pageInfo.page, pageInfo.totalPages));
      components.push(new AR().addComponents(
        new BB().setCustomId("hub_bugs").setLabel(t("panel.btn_back_hub")).setEmoji("◀").setStyle(BS.Secondary),
      ));
      return ix.update({
        embeds: [E.listE(pageInfo.items, t("bug.list_title_active"), pageInfo)],
        components,
      });
    }
    if (nav === "bugs_critical") {
      const bugs = db.bugsSev("critical");
      return ix.update({
        embeds: [E.listE(bugs, t("bug.list_title_critical"))],
        components: [new AR().addComponents(
          new BB().setCustomId("hub_bugs").setLabel(t("panel.btn_back_hub")).setEmoji("◀").setStyle(BS.Secondary),
        )],
      });
    }
    if (nav === "bugs_mine") {
      const bugs = db.bugsDev(ix.user.id);
      return ix.update({
        embeds: [E.listE(bugs, t("bug.list_title_assigned", { name: ix.user.displayName }))],
        components: [new AR().addComponents(
          new BB().setCustomId("hub_bugs").setLabel(t("panel.btn_back_hub")).setEmoji("◀").setStyle(BS.Secondary),
        )],
      });
    }
    if (nav === "profile_bugs") {
      const bugs = db.bugsUser(ix.user.id);
      return ix.update({
        embeds: [E.listE(bugs, `📝 ${ix.user.displayName}`)],
        components: [new AR().addComponents(
          new BB().setCustomId("hub_profile").setLabel(t("panel.btn_back_hub")).setEmoji("◀").setStyle(BS.Secondary),
        )],
      });
    }
    if (nav === "lb_full") {
      const members = db.topMembers();
      const { paginate, pageRow } = require("../pagination");
      const pageInfo = paginate(members, 1);
      const components = [];
      if (pageInfo.totalPages > 1) components.push(pageRow("plb", pageInfo.page, pageInfo.totalPages));
      components.push(new AR().addComponents(
        new BB().setCustomId("hub_community").setLabel(t("panel.btn_back_hub")).setEmoji("◀").setStyle(BS.Secondary),
      ));
      return ix.update({ embeds: [E.lbE(pageInfo.items, { ...pageInfo, perPage: 10 })], components });
    }
    if (nav === "devs") {
      const devs = db.devs();
      const desc = devs.length
        ? devs.map(x => `**${x.name}** — ${x.role} | ${x.spec} | ${x.resolved} ${t("bug.status.resolved")}`).join("\n")
        : t("team.empty");
      return ix.update({
        embeds: [new EB().setColor(0x5865f2).setTitle(t("team.title")).setDescription(desc)],
        components: [new AR().addComponents(
          new BB().setCustomId("hub_community").setLabel(t("panel.btn_back_hub")).setEmoji("◀").setStyle(BS.Secondary),
        )],
      });
    }
    // Unknown hub nav — fall through
  }

  // ===== Language selection =====
  if (id === "lang_tr" || id === "lang_en") {
    const newLang = id === "lang_tr" ? "tr" : "en";
    i18n.setUserLang(ix.user.id, newLang);
    const msg = i18n.t(newLang === "tr" ? "language.set_tr" : "language.set_en", newLang);
    return ix.update({ content: msg, embeds: [], components: [] });
  }

  // ===== Reset confirmation =====
  if (id === "reset_confirm") {
    if (!ix.member.permissions.has(P.Flags.Administrator)) {
      return ix.reply({ content: t("common.admin_required"), ephemeral: true });
    }
    await ix.update({ content: t("common.loading"), embeds: [], components: [] });
    const g = ix.guild;
    const catNames = ["Welcome", "Community", "Game Feedback", "Support", "Beta Program", "Announcements", "Management", "Tickets"];
    let deleted = 0;
    for (const name of catNames) {
      const cat = g.channels.cache.find(ch => ch.name === name && ch.type === CH.GuildCategory);
      if (!cat) continue;
      const children = g.channels.cache.filter(ch => ch.parentId === cat.id);
      for (const [, ch] of children) {
        try { await ch.delete(); deleted++; } catch {}
      }
      try { await cat.delete(); deleted++; } catch {}
    }
    return ix.editReply({
      content: "",
      embeds: [new EB()
        .setTitle(t("setup.reset_title"))
        .setColor(0xff0000)
        .setDescription(t("setup.reset_desc", { count: deleted }))
        .setTimestamp()],
    });
  }
  if (id === "reset_cancel") {
    return ix.update({ content: t("setup.reset_cancelled"), embeds: [], components: [] });
  }

  // ===== Verification =====
  if (id === "verify_accept") {
    // Account age check — block very new accounts (likely bots/alts)
    const MIN_ACCOUNT_AGE_DAYS = 3;
    const ageMs = Date.now() - (ix.user.createdTimestamp || Date.now());
    const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
    if (ageDays < MIN_ACCOUNT_AGE_DAYS) {
      await ix.reply({
        content: t("verify.account_too_young", { age: ageDays, required: MIN_ACCOUNT_AGE_DAYS }),
        ephemeral: true,
      });
      await audit(ix.guild, i18n.t("verify.audit_young_account", i18n.resolveLang(null, ix.guildId), {
        name: ix.user.displayName || ix.user.username,
        age: ageDays, required: MIN_ACCOUNT_AGE_DAYS,
      }));
      return;
    }

    const r = ix.guild.roles.cache.find(x => x.name === "Verified")
      || await ix.guild.roles.create({ name: "Verified", color: 0x2ecc71 });
    try { await ix.member.roles.add(r); } catch {}
    db.updMem(ix.user.id, { verified: true });
    achievements.trigger(client, ix.user.id, ix.guildId).catch(() => {});
    return ix.reply({ content: t("verify.verified"), ephemeral: true });
  }

  // ===== Reaction roles (platform) =====
  if (id.startsWith("rr_")) {
    const name = id.slice(3);
    const r = ix.guild.roles.cache.find(x => x.name === name);
    if (!r) return ix.reply({ content: t("common.role_not_found"), ephemeral: true });
    if (ix.member.roles.cache.has(r.id)) {
      await ix.member.roles.remove(r);
      return ix.reply({ content: t("reaction_roles.role_removed", { role: r }), ephemeral: true });
    }
    await ix.member.roles.add(r);
    return ix.reply({ content: t("reaction_roles.role_added", { role: r }), ephemeral: true });
  }

  // ===== Bug panel =====
  if (id === "open_report") {
    const m = new MB().setCustomId("m_bug").setTitle("Bug Report");
    m.addComponents(
      new AR().addComponents(new TI().setCustomId("t").setLabel("Bug Title").setStyle(TS.Short).setMaxLength(120).setRequired(true)),
      new AR().addComponents(new TI().setCustomId("d").setLabel("Description").setStyle(TS.Paragraph).setMaxLength(1500).setRequired(true)),
      new AR().addComponents(new TI().setCustomId("s").setLabel("Steps to Reproduce").setStyle(TS.Paragraph).setMaxLength(800).setRequired(false)),
      new AR().addComponents(new TI().setCustomId("v").setLabel("Severity (critical/high/medium/low)").setStyle(TS.Short).setPlaceholder("medium").setMaxLength(10).setRequired(true)),
      new AR().addComponents(new TI().setCustomId("p").setLabel("Platform (pc/ps/xbox/mobile/all)").setStyle(TS.Short).setPlaceholder("pc").setMaxLength(15).setRequired(false))
    );
    return ix.showModal(m);
  }
  if (id === "my_bugs")   return ix.reply({ embeds: [E.listE(db.bugsUser(ix.user.id), `📝 ${ix.user.displayName}`)], ephemeral: true });
  if (id === "open_dash") return ix.reply({ embeds: [E.dashE(db.bugStats(), db.devLb())], ephemeral: true });
  if (id === "open_lb")   return ix.reply({ embeds: [E.lbE(db.topMembers())], ephemeral: true });

  // ===== Admin panel =====
  if (id === "a_bugs")    return ix.reply({ embeds: [E.listE(db.bugsActive(), "📋 Active")], components: [E.filtS()], ephemeral: true });
  if (id === "a_crit")    return ix.reply({ embeds: [E.listE(db.bugsSev("critical"), "🚨 Critical")], ephemeral: true });
  if (id === "a_tkts") {
    const tkts = db.openTkts();
    return ix.reply({ embeds: [
      new EB().setTitle(t("ticket.open_tickets_title")).setColor(0xe74c3c).setDescription(
        tkts.length
          ? tkts.map(x => `**${x.tag}** ${x.cat} — <@${x.uid}>${x.claimUid ? ` → <@${x.claimUid}>` : ""}`).join("\n")
          : t("common.none")
      )
    ], ephemeral: true });
  }
  if (id === "a_refresh") return ix.update({ embeds: [E.adminP(db.bugStats(), db.tktSt(), db.betaSt())], components: E.adminBP() });
  if (id === "a_members") return ix.reply({ embeds: [E.lbE(db.topMembers())], ephemeral: true });
  if (id === "a_automod") return ix.reply({ embeds: [E.amP(db.getAM())], ephemeral: true });
  if (id === "a_givs") {
    const g = db.activeGivs();
    return ix.reply({ embeds: [
      new EB().setTitle("🎁 Active Giveaways").setColor(0xf39c12).setDescription(
        g.length ? g.map(x => `#${x.id} **${x.prize}** — ${x.entries.length} entries`).join("\n") : "None."
      )
    ], ephemeral: true });
  }
  if (id === "a_stats")   return ix.reply({ embeds: [E.statE(db.bugStats(), db.devLb())], ephemeral: true });

  // ===== Automod panel =====
  if (id === "am_words") {
    const am = db.getAM();
    return ix.reply({ embeds: [
      new EB().setTitle("🚫 Banned Words").setColor(0xe74c3c).setDescription(
        am.banned_words?.length ? am.banned_words.map(w => `\`${w}\``).join(", ") : "Empty."
      )
    ], ephemeral: true });
  }
  if (id === "am_cfg") return ix.reply({ embeds: [E.amP(db.getAM())], ephemeral: true });

  // ===== Tickets =====
  if (id.startsWith("tkt_")) {
    const cat = id.slice(4);
    const m = new MB().setCustomId(`mt_${cat}`).setTitle("Support Ticket");
    m.addComponents(new AR().addComponents(
      new TI().setCustomId("d").setLabel("Describe your issue").setStyle(TS.Paragraph).setMaxLength(1000).setRequired(true)
    ));
    return ix.showModal(m);
  }
  if (id.startsWith("tc_")) {
    const tid = parseInt(id.slice(3));
    db.claimTkt(tid, ix.user.id, ix.user.displayName);
    return ix.reply({ content: t("ticket.claimed", { name: ix.user.displayName }) });
  }
  if (id.startsWith("tx_")) {
    const tid = parseInt(id.slice(3));
    const tkt = db.getTkt(tid);
    db.closeTkt(tid, ix.user.displayName);
    await ix.reply({ embeds: [
      new EB()
        .setTitle(t("ticket.closed_title", { tag: tkt?.tag || "Ticket" }))
        .setColor(0x95a5a6)
        .setDescription(t("ticket.closed_desc"))
    ]});
    await audit(ix.guild, `🔒 ${tkt?.tag}`);
    setTimeout(async () => { try { await ix.channel.delete(); } catch {} }, 10000);
    return;
  }

  // ===== Suggestions =====
  if (id === "sug_create") {
    const m = new MB().setCustomId("m_sug").setTitle("Submit Suggestion");
    m.addComponents(
      new AR().addComponents(new TI().setCustomId("t").setLabel("Suggestion Title").setStyle(TS.Short).setMaxLength(100).setRequired(true)),
      new AR().addComponents(new TI().setCustomId("d").setLabel("Detailed Description").setStyle(TS.Paragraph).setMaxLength(1000).setRequired(true)),
      new AR().addComponents(new TI().setCustomId("c").setLabel("Category (gameplay/visual/community/other)").setStyle(TS.Short).setPlaceholder("gameplay").setMaxLength(15).setRequired(false))
    );
    return ix.showModal(m);
  }
  if (id === "sug_top") {
    const top = db.topSugs();
    if (!top.length) return ix.reply({ content: t("common.none"), ephemeral: true });
    return ix.reply({ embeds: [
      new EB().setTitle(t("suggestion.popular_title")).setColor(0xf39c12).setDescription(
        top.map((s, i) => `**${i + 1}.** ${s.tag} — ${s.title} (net: **${(s.up?.length || 0) - (s.dn?.length || 0)}**)`).join("\n")
      )
    ], ephemeral: true });
  }
  if (id === "sug_mine") {
    const m = db.sugs().filter(s => s.uid === ix.user.id);
    return ix.reply({ embeds: [
      new EB().setTitle(t("suggestion.mine_title")).setColor(0xf39c12).setDescription(
        m.length ? m.map(s => `${s.tag} — ${s.title} (${s.status})`).join("\n") : t("common.none")
      )
    ], ephemeral: true });
  }
  if (id.startsWith("su_") || id.startsWith("sd_")) {
    const type = id.startsWith("su_") ? "up" : "down";
    const sid = parseInt(id.slice(3));
    db.voteSug(sid, ix.user.id, type);
    const s = db.getSug(sid);
    return ix.update({ embeds: [E.sugC(s)], components: [E.sugVB(sid), E.sugAB(sid)] });
  }
  if (id.startsWith("sa_") || id.startsWith("sp_") || id.startsWith("sr_") || id.startsWith("sx_")) {
    const statusMap = { sa: "approved", sp: "planned", sr: "rejected", sx: "done" };
    const pre = id.slice(0, 2), sid = parseInt(id.slice(3));
    const m = new MB().setCustomId(`ms_${statusMap[pre]}_${sid}`).setTitle("Team Response");
    m.addComponents(new AR().addComponents(
      new TI().setCustomId("r").setLabel("Response").setStyle(TS.Paragraph).setRequired(true).setMaxLength(500)
    ));
    return ix.showModal(m);
  }

  // ===== Beta program =====
  if (id === "beta_apply") {
    const m = new MB().setCustomId("m_beta").setTitle("Beta Application");
    m.addComponents(
      new AR().addComponents(new TI().setCustomId("r").setLabel("Why do you want to join?").setStyle(TS.Paragraph).setMaxLength(500).setRequired(true)),
      new AR().addComponents(new TI().setCustomId("p").setLabel("Platform (PC/PS/Xbox/Mobile)").setStyle(TS.Short).setMaxLength(20).setRequired(true))
    );
    return ix.showModal(m);
  }
  if (id === "beta_status") {
    const a = db.apps().filter(x => x.uid === ix.user.id);
    if (!a.length) return ix.reply({ content: t("beta.no_application"), ephemeral: true });
    return ix.reply({ embeds: [E.betaC(a[a.length - 1])], ephemeral: true });
  }
  if (id === "beta_stats") return ix.reply({ embeds: [E.betaSE(db.betaSt())], ephemeral: true });
  if (id === "bk_add") {
    if (!isDevOrMod(ix.member)) {
      return ix.reply({ content: t("bug.dev_only"), ephemeral: true });
    }
    const m = new MB().setCustomId("m_keys").setTitle("Upload Keys");
    m.addComponents(new AR().addComponents(
      new TI().setCustomId("k").setLabel("One key per line").setStyle(TS.Paragraph).setMaxLength(4000).setRequired(true)
    ));
    return ix.showModal(m);
  }
  if (id === "bk_pending") {
    const a = db.apps("pending");
    if (!a.length) return ix.reply({ content: t("common.none"), ephemeral: true });
    return ix.reply({
      embeds: a.slice(0, 5).map(x => E.betaC(x)),
      components: a.slice(0, 5).map(x => E.betaCB(x.id)),
      ephemeral: true
    });
  }
  if (id === "bk_used") {
    const u = db.usedKeys();
    if (!u.length) return ix.reply({ content: t("common.none"), ephemeral: true });
    return ix.reply({ embeds: [
      new EB().setTitle("📦 Distributed").setColor(0x9b59b6).setDescription(
        u.map(k => `\`${k.key.slice(0, 8)}...\` → **${k.name}**`).join("\n").slice(0, 4000)
      )
    ], ephemeral: true });
  }
  if (id === "bk_refresh") return ix.update({ embeds: [E.betaAP(db.betaSt())], components: E.betaABP() });

  if (id.startsWith("bok_")) {
    const aid = parseInt(id.slice(4));
    const r = db.approveApp(aid, ix.user.displayName);
    if (r.err === "no_keys") return ix.reply({ content: t("beta.no_keys"), ephemeral: true });
    if (r.err) return ix.reply({ content: r.err, ephemeral: true });
    try {
      const u = await client.users.fetch(r.app.uid);
      await u.send({ embeds: [
        new EB().setTitle("🎉 Beta Approved!").setColor(0x00cc00)
          .setDescription(`Your key:\n\`\`\`\n${r.key}\n\`\`\`\nDo not share this key.`)
      ]});
      const mb = await ix.guild.members.fetch(r.app.uid);
      const br = ix.guild.roles.cache.find(x => x.name === "Beta Tester");
      if (br) await mb.roles.add(br);
    } catch {}
    db.updMem(r.app.uid, { beta: true });
    achievements.trigger(client, r.app.uid, ix.guildId).catch(() => {});
    await ix.update({ embeds: [E.betaC(db.getApp(aid))], components: [] });
    return audit(ix.guild, `✅ Beta #${aid} → ${r.app.name}`);
  }
  if (id.startsWith("bno_")) {
    const aid = parseInt(id.slice(4));
    const r = db.rejectApp(aid, ix.user.displayName);
    if (r.err) return ix.reply({ content: r.err, ephemeral: true });
    try {
      const u = await client.users.fetch(r.uid);
      await u.send({ embeds: [
        new EB().setTitle("Beta Rejected").setColor(0xff0000).setDescription("You can try again later.")
      ]});
    } catch {}
    await ix.update({ embeds: [E.betaC(db.getApp(aid))], components: [] });
    return audit(ix.guild, `❌ Beta #${aid}`);
  }

  // ===== Q&A question vote =====
  if (id.startsWith("qav_")) {
    const parts = id.split("_");
    const qaId = parseInt(parts[1]);
    const qId = parseInt(parts[2]);
    const q = db.voteQaQuestion(qaId, qId, ix.user.id);
    if (!q) return ix.reply({ content: t("common.not_found"), ephemeral: true });
    return ix.reply({ content: `👍 ${q.up.length}`, ephemeral: true });
  }

  // ===== Giveaway entry =====
  if (id.startsWith("ge_")) {
    const ok = db.enterGiv(parseInt(id.slice(3)), ix.user.id);
    return ix.reply({ content: ok ? t("giveaway.entered") : t("giveaway.already_entered"), ephemeral: true });
  }

  // ===== Poll vote =====
  if (id.startsWith("pv_")) {
    const parts = id.split("_");
    const pid = parseInt(parts[1]), oi = parseInt(parts[2]);
    const poll = db.votePoll(pid, oi, ix.user.id);
    if (!poll) return ix.reply({ content: t("poll.closed"), ephemeral: true });
    return ix.update({ embeds: [E.polE(poll)], components: E.polB(poll) });
  }

  // ===== Bug actions (claim, resolve, close, reopen, vote, comment, thread, history) =====
  const parts = id.split("_");
  const act = parts[0], bid = parseInt(parts[1]);
  if (!BUG_ACTIONS.includes(act) || isNaN(bid)) return;
  const bug = db.getBug(bid);
  if (!bug) return ix.reply({ content: t("common.not_found"), ephemeral: true });

  if (act === "cl") {
    db.assignBug(bid, ix.user.id, ix.user.displayName);
    crisisMode.cancel(bid);  // claimed → no longer unassigned
    const u = db.getBug(bid);
    await ix.update({ embeds: [E.bugE(u, db.getHist(bid))], components: E.bugBB(u) });
    if (u.by && u.by !== ix.user.id) {
      dmBugStatus(client, u.by, ix.guildId, "bug_claimed", { tag: u.tag, title: u.title, dev: ix.user.displayName });
    }
    return audit(ix.guild, `🙋 ${u.tag} → ${ix.user.displayName}`);
  }
  if (act === "ua") {
    db.unassignBug(bid, ix.user.displayName);
    crisisMode.schedule(bid);  // unassigned again → restart SLA
    const u = db.getBug(bid);
    return ix.update({ embeds: [E.bugE(u, db.getHist(bid))], components: E.bugBB(u) });
  }
  if (act === "rv") {
    const m = new MB().setCustomId(`mr_${bid}`).setTitle(`${bug.tag} Resolution`);
    m.addComponents(new AR().addComponents(
      new TI().setCustomId("n").setLabel("How did you fix it?").setStyle(TS.Paragraph).setRequired(true).setMaxLength(500)
    ));
    return ix.showModal(m);
  }
  if (act === "cx") {
    db.closeBug(bid, ix.user.displayName);
    crisisMode.cancel(bid);
    const u = db.getBug(bid);
    await ix.update({ embeds: [E.bugE(u, db.getHist(bid))], components: E.bugBB(u) });
    if (u.by && u.by !== ix.user.id) {
      dmBugStatus(client, u.by, ix.guildId, "bug_closed", { tag: u.tag, title: u.title, by: ix.user.displayName });
    }
    return audit(ix.guild, `🔒 ${u.tag}`);
  }
  if (act === "ro") {
    db.reopenBug(bid, ix.user.displayName);
    crisisMode.schedule(bid);  // reopened → SLA clock starts again
    const u = db.getBug(bid);
    await ix.update({ embeds: [E.bugE(u, db.getHist(bid))], components: E.bugBB(u) });
    if (u.by && u.by !== ix.user.id) {
      dmBugStatus(client, u.by, ix.guildId, "bug_reopened", { tag: u.tag, title: u.title, by: ix.user.displayName });
    }
    return audit(ix.guild, `🔓 ${u.tag}`);
  }
  if (act === "vu") {
    db.vote(bid, ix.user.id);
    const u = db.getBug(bid);
    return ix.update({ embeds: [E.bugE(u, db.getHist(bid), db.getCmts(bid))], components: E.bugBB(u) });
  }
  if (act === "cm") {
    const m = new MB().setCustomId(`mc_${bid}`).setTitle(`${bug.tag} Comment`);
    m.addComponents(new AR().addComponents(
      new TI().setCustomId("t").setLabel("Your comment").setStyle(TS.Paragraph).setRequired(true).setMaxLength(500)
    ));
    return ix.showModal(m);
  }
  if (act === "th") {
    if (bug.thId) {
      const existing = ix.guild.channels.cache.get(bug.thId);
      if (existing) return ix.reply({ content: `<#${bug.thId}>`, ephemeral: true });
    }
    const th = await ix.channel.threads.create({
      name: `${bug.tag} ${bug.title.slice(0, 50)}`,
      autoArchiveDuration: 1440,
      type: CH.PrivateThread,
      invitable: false,
    });
    db.setTh(bid, th.id);
    // Reporter + triggerer get access to the private thread.
    await th.members.add(bug.by).catch(() => {});
    if (bug.by !== ix.user.id) await th.members.add(ix.user.id).catch(() => {});
    await th.send({ embeds: [
      new EB().setTitle(`🧵 ${bug.tag}`).setColor(0x5865f2).setDescription(bug.desc.slice(0, 300))
    ]});
    return ix.reply({ content: `<#${th.id}>`, ephemeral: true });
  }
  if (act === "hi") {
    const h = db.getHist(bid);
    if (!h.length) return ix.reply({ content: t("common.none"), ephemeral: true });
    return ix.reply({ embeds: [
      new EB().setTitle(`📜 ${bug.tag}`).setColor(0x5865f2).setDescription(
        h.map(x => `\`${x.at}\` ▸ **${x.act}** (${x.by})`).join("\n").slice(0, 4000)
      )
    ], ephemeral: true });
  }
}

module.exports = { handleButton };

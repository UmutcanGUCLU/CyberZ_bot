// Slash command dispatcher
const {
  PermissionsBitField: P, ChannelType: CH,
  EmbedBuilder: EB,
  ActionRowBuilder: AR, ButtonBuilder: BB, ButtonStyle: BS,
  StringSelectMenuBuilder: SSM
} = require("discord.js");
const { db } = require("../db");
const embedsFor = require("../embedsFor");
const logger = require("../logger");
const { audit } = require("../audit");
const { scheduleGiveawayEnd, schedulePollEnd } = require("../scheduler");
const i18n = require("../i18n");
const achievements = require("../achievements");
const { paginate, pageRow } = require("../pagination");
const { isDevOrMod } = require("../permissions");
const trust = require("../trust");
const panels = require("../panels");

async function handleCommand(ix, client) {
  const c = ix.commandName;
  const lang = i18n.langOf(ix);
  const t = (k, p) => i18n.t(k, lang, p);
  const E = embedsFor(lang);

  // ===== Main control panel (UI hub) =====
  if (c === "panel") {
    return ix.reply({
      embeds: [panels.mainHub(ix.guildId, lang)],
      components: panels.mainHubButtons(lang),
      ephemeral: true,
    });
  }
  if (c === "panel-place") {
    if (!ix.member.permissions.has(P.Flags.Administrator)) {
      return ix.reply({ content: t("common.admin_required"), ephemeral: true });
    }
    // Persistent public panel — server default language
    const sLang = i18n.resolveLang(null, ix.guildId);
    await ix.channel.send({
      embeds: [panels.mainHub(ix.guildId, sLang)],
      components: panels.mainHubButtons(sLang),
    });
    return ix.reply({ content: t("common.done"), ephemeral: true });
  }

  // ===== Help =====
  if (c === "yardim" || c === "help") {
    const embed = new EB()
      .setColor(0x5865f2)
      .setTitle(t("help.panel_title"))
      .setDescription(t("help.panel_desc"));
    const select = new SSM()
      .setCustomId("help_cat")
      .setPlaceholder(t("help.select_placeholder"))
      .addOptions(
        { label: t("help.categories.bugs.label"),        description: t("help.categories.bugs.desc"),        value: "bugs" },
        { label: t("help.categories.tickets.label"),     description: t("help.categories.tickets.desc"),     value: "tickets" },
        { label: t("help.categories.suggestions.label"), description: t("help.categories.suggestions.desc"), value: "suggestions" },
        { label: t("help.categories.beta.label"),        description: t("help.categories.beta.desc"),        value: "beta" },
        { label: t("help.categories.profile.label"),     description: t("help.categories.profile.desc"),     value: "profile" },
        { label: t("help.categories.general.label"),     description: t("help.categories.general.desc"),     value: "general" },
      );
    return ix.reply({ embeds: [embed], components: [new AR().addComponents(select)], ephemeral: true });
  }

  // ===== Achievements =====
  if (c === "rozetler" || c === "achievements") {
    const target = ix.options.getUser("user") || ix.user;
    const member = db.getMem(target.id);
    const earned = member.achievements || [];
    const total = achievements.getOrder().length;

    const lines = achievements.getOrder().map(key => {
      const meta = achievements.getMeta(key);
      const has = earned.includes(key);
      const name = t(`achievements.${key}.name`);
      if (has) return `${meta.emoji} **${name}** — ✅`;
      return `${meta.emoji} ${name} — ${t("achievements.locked")}`;
    }).join("\n");

    const embed = new EB()
      .setColor(0xf39c12)
      .setTitle(`${t("achievements.panel_title")} — ${target.displayName}`)
      .setDescription(t("achievements.panel_desc", { earned: earned.length, total }) + "\n\n" + (lines || t("achievements.none_earned")))
      .setThumbnail(target.displayAvatarURL())
      .setTimestamp();
    return ix.reply({ embeds: [embed], ephemeral: target.id === ix.user.id });
  }

  // ===== Language =====
  if (c === "dil" || c === "language") {
    const current = i18n.meta(lang).flag + " " + i18n.meta(lang).name;
    const embed = new EB()
      .setColor(0x5865f2)
      .setTitle(t("language.panel_title"))
      .setDescription(t("language.panel_desc", { current }));
    const row = new AR().addComponents(
      new BB().setCustomId("lang_tr").setLabel("Türkçe").setEmoji("🇹🇷").setStyle(BS.Primary),
      new BB().setCustomId("lang_en").setLabel("English").setEmoji("🇬🇧").setStyle(BS.Secondary),
    );
    return ix.reply({ embeds: [embed], components: [row], ephemeral: true });
  }

  // ===== Setup & reset =====
  if (c === "setup") return cmdSetup(ix, client);
  if (c === "reset") return cmdReset(ix);

  // ===== Panel placements =====
  if (c === "bug-panel")      { await ix.channel.send({ embeds: [E.bugP()], components: E.bugBP() }); return ix.reply({ content: t("common.done"), ephemeral: true }); }
  if (c === "admin-panel")    { await ix.channel.send({ embeds: [E.adminP(db.bugStats(), db.tktSt(), db.betaSt())], components: E.adminBP() }); return ix.reply({ content: t("common.done"), ephemeral: true }); }
  if (c === "ticket-panel")   { await ix.channel.send({ embeds: [E.tktP(db.tktSt())], components: E.tktBP() }); return ix.reply({ content: t("common.done"), ephemeral: true }); }
  if (c === "sugg-panel")     { await ix.channel.send({ embeds: [E.sugP()], components: E.sugBP() }); return ix.reply({ content: t("common.done"), ephemeral: true }); }
  if (c === "beta-panel")     { await ix.channel.send({ embeds: [E.betaP(db.betaSt())], components: E.betaBP() }); return ix.reply({ content: t("common.done"), ephemeral: true }); }
  if (c === "beta-admin")     { await ix.channel.send({ embeds: [E.betaAP(db.betaSt())], components: E.betaABP() }); return ix.reply({ content: t("common.done"), ephemeral: true }); }
  if (c === "verify-panel")   { await ix.channel.send({ embeds: [E.verifyP()], components: E.verifyB() }); return ix.reply({ content: t("common.done"), ephemeral: true }); }
  if (c === "reaction-roles") { await ix.channel.send({ embeds: [E.rrP()], components: E.rrB() }); return ix.reply({ content: t("common.done"), ephemeral: true }); }
  if (c === "automod-panel")  { await ix.channel.send({ embeds: [E.amP(db.getAM())], components: [E.amB()] }); return ix.reply({ content: t("common.done"), ephemeral: true }); }

  // ===== Bug tracker =====
  if (c === "bug") {
    const b = db.getBug(ix.options.getInteger("id"));
    if (!b) return ix.reply({ content: t("common.not_found"), ephemeral: true });
    return ix.reply({ embeds: [E.bugE(b, db.getHist(b.id), db.getCmts(b.id))], components: E.bugBB(b) });
  }
  if (c === "bug-assign") {
    const id = ix.options.getInteger("id"), u = ix.options.getUser("user");
    const b = db.getBug(id);
    if (!b) return ix.reply({ content: t("common.not_found"), ephemeral: true });
    db.assignBug(id, u.id, u.displayName);
    const updated = db.getBug(id);
    await ix.reply({ embeds: [E.bugE(updated, db.getHist(id))], components: E.bugBB(updated) });
    try { await u.send(`Bug assigned: **${updated.tag}: ${updated.title}**`); } catch {}
    return audit(ix.guild, `👤 ${updated.tag} → ${u.displayName}`);
  }
  if (c === "bugs") {
    const f = ix.options.getString("filter") || "all";
    const all = f === "all" ? db.bugsActive() : db.bugsBy(f);
    const pageInfo = paginate(all, 1);
    const title = f === "all" ? t("bug.list_title_active") : `📋 ${t(`bug.status.${f}`) || f}`;
    const components = [E.filtS()];
    if (pageInfo.totalPages > 1) components.push(pageRow(`pbug_${f}`, pageInfo.page, pageInfo.totalPages));
    return ix.reply({ embeds: [E.listE(pageInfo.items, title, pageInfo)], components });
  }
  if (c === "bug-search") {
    return ix.reply({ embeds: [E.listE(db.search(ix.options.getString("query")), "🔎 Search")] });
  }
  // ===== Trust levels =====
  if (c === "trust-check") {
    const target = ix.options.getUser("user") || ix.user;
    const member = db.getMem(target.id);
    const warnings = db.warns(target.id);
    const level = trust.getLevel(target.id);
    const levelName = t(`trust.levels.${level.key}`);
    const nextLevel = trust.LEVELS[level.id + 1];
    const msgs = member.msgs || 0;
    const bugs = member.bugs || 0;
    const joinDate = member.joined ? new Date(member.joined.replace(" ", "T")) : new Date();
    const days = Math.floor((Date.now() - joinDate.getTime()) / 86400000);

    const desc = [];
    desc.push(t("trust.current", { id: level.id, name: levelName }));
    if (member.trustOverride) desc.push(t("trust.override_notice"));
    desc.push("");
    desc.push(t("trust.progress_title"));
    if (nextLevel) {
      const nextName = t(`trust.levels.${nextLevel.key}`);
      desc.push(t("trust.next_level", { name: nextName }));
      // Show requirements for next level
      const reqs = [
        { key: "msgs", have: msgs, needs: { verified: 20, active: 150, trusted: 1000 }[nextLevel.key] || 20 },
        { key: "days", have: days, needs: { active: 3, trusted: 14, veteran: 60 }[nextLevel.key] || 0 },
        { key: "bugs", have: bugs, needs: { trusted: 1, veteran: 5 }[nextLevel.key] || 0 },
      ];
      for (const r of reqs) {
        if (r.needs <= 0) continue;
        desc.push(t(`trust.progress_line_${r.key}`, { have: r.have, need: r.needs }));
      }
      if (["trusted", "veteran"].includes(nextLevel.key)) {
        const clean = warnings.length === 0;
        desc.push(t("trust.progress_line_clean", {
          status: clean ? t("trust.clean_yes") : t("trust.clean_no", { n: warnings.length })
        }));
      }
    } else {
      desc.push(t("trust.max_level"));
    }

    return ix.reply({
      embeds: [new EB()
        .setColor(level.color)
        .setTitle(`${t("trust.title")} — ${target.displayName}`)
        .setDescription(desc.join("\n"))
        .setThumbnail(target.displayAvatarURL?.() || null)],
      ephemeral: target.id === ix.user.id,
    });
  }
  if (c === "trust-set") {
    if (!ix.member.permissions.has(P.Flags.Administrator)) {
      return ix.reply({ content: t("common.admin_required"), ephemeral: true });
    }
    const target = ix.options.getUser("user");
    const level = ix.options.getInteger("level");
    const set = trust.setLevel(target.id, level);
    if (!set) return ix.reply({ content: t("trust.invalid_level"), ephemeral: true });
    const name = t(`trust.levels.${set.key}`);
    await ix.reply({ content: t("trust.set_ok", { uid: target.id, name }), ephemeral: true });
    return audit(ix.guild, `🛡️ Trust level set: ${target.displayName} → L${level} (${name}) by ${ix.user.displayName}`);
  }
  if (c === "trust-clear") {
    if (!ix.member.permissions.has(P.Flags.Administrator)) {
      return ix.reply({ content: t("common.admin_required"), ephemeral: true });
    }
    const target = ix.options.getUser("user");
    const result = trust.clearOverride(target.id);
    const name = t(`trust.levels.${result.to.key}`);
    await ix.reply({ content: t("trust.cleared", { uid: target.id, name }), ephemeral: true });
    return audit(ix.guild, `🛡️ Trust override cleared: ${target.displayName} → L${result.to.id} by ${ix.user.displayName}`);
  }

  // ===== Triage (dev queue) =====
  if (c === "triage") {
    if (!isDevOrMod(ix.member)) {
      return ix.reply({ content: t("bug.dev_only"), ephemeral: true });
    }
    const bugs = db.bugsUnassigned();
    if (!bugs.length) {
      return ix.reply({
        embeds: [new EB().setColor(0x00cc00).setTitle(t("triage.title")).setDescription(t("triage.empty"))],
        ephemeral: true,
      });
    }
    const pageInfo = paginate(bugs, 1);
    const body = pageInfo.items.map(b => {
      const sevEmoji = { critical: "🔴", high: "🟠", medium: "🟡", low: "🟢" }[b.sev] || "⚪";
      const age = b.at.slice(5, 16); // MM-DD HH:MM
      return `${sevEmoji} **${b.tag}** · ${b.title}\n\`${age}\` · votes: ${b.votes?.length || 0}`;
    }).join("\n\n");

    const embed = new EB()
      .setColor(0xf39c12)
      .setTitle(t("triage.title"))
      .setDescription(`${t("triage.hint")}\n\n${body}`)
      .setFooter({ text: `${pageInfo.total} · ${pageInfo.page}/${pageInfo.totalPages}` });

    // Quick-claim select: up to 25 options
    const options = pageInfo.items.slice(0, 25).map(b => {
      const sevEmoji = { critical: "🔴", high: "🟠", medium: "🟡", low: "🟢" }[b.sev] || "⚪";
      return {
        label: `${b.tag} — ${b.title.slice(0, 70)}`,
        value: `trgclaim_${b.id}`,
        emoji: sevEmoji,
      };
    });
    const select = new SSM()
      .setCustomId("trg_claim")
      .setPlaceholder(t("triage.select_placeholder"))
      .addOptions(options);

    const components = [new AR().addComponents(select)];
    if (pageInfo.totalPages > 1) components.push(pageRow("ptrg", pageInfo.page, pageInfo.totalPages));
    return ix.reply({ embeds: [embed], components, ephemeral: true });
  }

  // ===== FAQ =====
  if (c === "sss" || c === "faq") {
    const all = db.faqs();
    const embed = new EB()
      .setColor(0x3498db)
      .setTitle(t("faq.panel_title"))
      .setDescription(all.length ? t("faq.panel_desc") : t("faq.empty"))
      .setFooter({ text: t("faq.footer", { n: all.length }) })
      .setTimestamp();

    if (!all.length) return ix.reply({ embeds: [embed], ephemeral: true });

    // Show available categories in dropdown
    const cats = db.faqCategories();
    const options = cats.map(cat => ({
      label: t(`faq.categories.${cat}`) || cat,
      value: `faqcat_${cat}`,
      description: `${db.faqs(cat).length} FAQ`,
    }));
    const select = new SSM()
      .setCustomId("faq_cat")
      .setPlaceholder(t("faq.select_placeholder"))
      .addOptions(options);
    return ix.reply({ embeds: [embed], components: [new AR().addComponents(select)], ephemeral: true });
  }
  if (c === "sss-ekle") {
    if (!ix.member.permissions.has(P.Flags.Administrator)) {
      return ix.reply({ content: t("common.admin_required"), ephemeral: true });
    }
    const question = ix.options.getString("soru");
    const answer = ix.options.getString("cevap");
    const category = ix.options.getString("kategori") || "general";
    const faq = db.mkFaq(question, answer, category, ix.user.displayName);
    return ix.reply({ content: t("faq.added", { id: faq.id }), ephemeral: true });
  }
  if (c === "sss-sil") {
    if (!ix.member.permissions.has(P.Flags.Administrator)) {
      return ix.reply({ content: t("common.admin_required"), ephemeral: true });
    }
    const id = ix.options.getInteger("id");
    const removed = db.rmFaq(id);
    if (!removed) return ix.reply({ content: t("faq.not_found"), ephemeral: true });
    return ix.reply({ content: t("faq.removed", { id }), ephemeral: true });
  }

  // ===== Known Issues =====
  if (c === "mark-known") {
    if (!ix.member.permissions.has(P.Flags.Administrator)) {
      return ix.reply({ content: t("common.admin_required"), ephemeral: true });
    }
    const id = ix.options.getInteger("id");
    const workaround = ix.options.getString("workaround") || null;
    const bug = db.markKnown(id, workaround, ix.user.displayName);
    if (!bug) return ix.reply({ content: t("common.not_found"), ephemeral: true });
    await ix.reply({ content: t("known_issues.marked", { tag: bug.tag }), ephemeral: true });
    // Refresh the bug's public card if we know where it is
    if (bug.chId && bug.msgId) {
      try {
        const ch = ix.guild.channels.cache.get(bug.chId);
        if (ch) {
          const msg = await ch.messages.fetch(bug.msgId);
          const chLang = i18n.resolveLang(null, ix.guildId);
          const chE = embedsFor(chLang);
          await msg.edit({ embeds: [chE.bugE(bug, db.getHist(bug.id), db.getCmts(bug.id))], components: chE.bugBB(bug) });
        }
      } catch {}
    }
    return audit(ix.guild, `⚠️ ${bug.tag} marked known (${workaround ? "with workaround" : "no workaround"})`);
  }
  if (c === "unmark-known") {
    if (!ix.member.permissions.has(P.Flags.Administrator)) {
      return ix.reply({ content: t("common.admin_required"), ephemeral: true });
    }
    const id = ix.options.getInteger("id");
    const bug = db.unmarkKnown(id, ix.user.displayName);
    if (!bug) return ix.reply({ content: t("common.not_found"), ephemeral: true });
    await ix.reply({ content: t("known_issues.unmarked", { tag: bug.tag }), ephemeral: true });
    if (bug.chId && bug.msgId) {
      try {
        const ch = ix.guild.channels.cache.get(bug.chId);
        if (ch) {
          const msg = await ch.messages.fetch(bug.msgId);
          const chLang = i18n.resolveLang(null, ix.guildId);
          const chE = embedsFor(chLang);
          await msg.edit({ embeds: [chE.bugE(bug, db.getHist(bug.id), db.getCmts(bug.id))], components: chE.bugBB(bug) });
        }
      } catch {}
    }
    return audit(ix.guild, `✅ ${bug.tag} unmarked known`);
  }
  if (c === "known-issues") {
    const bugs = db.knownBugs();
    const pageInfo = paginate(bugs, 1);
    const embed = new EB()
      .setTitle(t("known_issues.panel_title"))
      .setColor(0xf39c12)
      .setTimestamp();
    if (!bugs.length) {
      embed.setDescription(t("known_issues.panel_desc_empty"));
    } else {
      const body = pageInfo.items.map(b => {
        const sevEmoji = { critical: "🔴", high: "🟠", medium: "🟡", low: "🟢" }[b.sev] || "⚪";
        const wa = b.workaround ? `\n> 💡 ${b.workaround.slice(0, 140)}` : "";
        return `${sevEmoji} **${b.tag}** ${b.title}${wa}`;
      }).join("\n\n");
      embed.setDescription(t("known_issues.panel_desc") + "\n\n" + body);
      embed.setFooter({ text: t("known_issues.list_footer", { n: bugs.length }) });
    }
    const components = pageInfo.totalPages > 1 ? [pageRow("pki", pageInfo.page, pageInfo.totalPages)] : [];
    return ix.reply({ embeds: [embed], components });
  }

  if (c === "dashboard") return ix.reply({ embeds: [E.dashE(db.bugStats(), db.devLb())] });
  if (c === "stats")     return ix.reply({ embeds: [E.statE(db.bugStats(), db.devLb())] });
  if (c === "my-bugs")   return ix.reply({ embeds: [E.listE(db.bugsDev(ix.user.id), `📌 ${ix.user.displayName}`)] });

  // ===== Profile / leaderboard =====
  if (c === "profile") {
    const u = ix.options.getUser("user") || ix.user;
    const m = db.getMem(u.id);
    m.name = u.displayName;
    const lb = db.topMembers();
    const rank = (lb.findIndex(x => x.uid === u.id) + 1) || "?";
    return ix.reply({ embeds: [E.profE(m, rank)] });
  }
  if (c === "leaderboard") {
    const all = db.topMembers();
    const pageInfo = paginate(all, 1);
    const components = pageInfo.totalPages > 1 ? [pageRow("plb", pageInfo.page, pageInfo.totalPages)] : [];
    return ix.reply({ embeds: [E.lbE(pageInfo.items, { ...pageInfo, perPage: 10 })], components });
  }

  // ===== Developer registry =====
  if (c === "dev-register") {
    const specialty = ix.options.getString("specialty");
    const role = ix.options.getString("role") || "developer";
    db.regDev(ix.user.id, ix.user.displayName, role, specialty);
    const cfg = db.getCfg(ix.guildId);
    if (cfg) {
      try {
        const roleMap = { developer: cfg.devRole, lead: cfg.leadRole, tester: cfg.testRole };
        if (roleMap[role]) await ix.member.roles.add(roleMap[role]);
      } catch {}
    }
    return ix.reply({ content: `**${ix.user.displayName}** registered! ${specialty} | ${role}` });
  }
  if (c === "dev-list") {
    const devs = db.devs();
    if (!devs.length) return ix.reply({ content: t("common.none"), ephemeral: true });
    return ix.reply({ embeds: [
      new EB().setTitle("👥 Team").setColor(0x5865f2).setDescription(
        devs.map(x => `**${x.name}** — ${x.role} | ${x.spec} | ${x.resolved} resolved`).join("\n")
      )
    ]});
  }

  // ===== Role management =====
  if (c === "role-give") {
    const u = ix.options.getUser("user"), rn = ix.options.getString("role");
    const r = ix.guild.roles.cache.find(x => x.name === rn);
    if (!r) return ix.reply({ content: t("common.role_not_found"), ephemeral: true });
    await (await ix.guild.members.fetch(u.id)).roles.add(r);
    return ix.reply({ content: `${r} → <@${u.id}>` });
  }
  if (c === "role-remove") {
    const u = ix.options.getUser("user"), rn = ix.options.getString("role");
    const r = ix.guild.roles.cache.find(x => x.name === rn);
    if (!r) return ix.reply({ content: t("common.role_not_found"), ephemeral: true });
    await (await ix.guild.members.fetch(u.id)).roles.remove(r);
    return ix.reply({ content: `${r} ← <@${u.id}>` });
  }

  // ===== Moderation =====
  if (c === "warn") {
    const u = ix.options.getUser("user"), reason = ix.options.getString("reason");
    const count = db.warn(u.id, u.displayName, reason, ix.user.displayName);
    await ix.reply({ embeds: [
      new EB().setTitle("⚠️ Warning").setColor(0xff0000).setDescription(
        `<@${u.id}> warned.\n**Reason:** ${reason}\n**Total:** ${count}`
      )
    ]});
    try { await u.send(`Warning: ${reason} (Total: ${count})`); } catch {}
    return audit(ix.guild, `⚠️ ${u.displayName}: ${reason}`);
  }
  if (c === "warnings") {
    const u = ix.options.getUser("user"), w = db.warns(u.id);
    if (!w.length) return ix.reply({ content: t("common.none"), ephemeral: true });
    return ix.reply({ embeds: [
      new EB().setTitle("Warnings").setColor(0xff0000).setDescription(
        w.map((x, i) => `**${i + 1}.** ${x.reason} — ${x.by}`).join("\n")
      )
    ], ephemeral: true });
  }
  if (c === "note") {
    const u = ix.options.getUser("user"), t = ix.options.getString("text");
    db.note(u.id, u.displayName, t, ix.user.displayName);
    return ix.reply({ content: "Note added.", ephemeral: true });
  }
  if (c === "notes") {
    const u = ix.options.getUser("user"), n = db.notes(u.id);
    if (!n.length) return ix.reply({ content: t("common.none"), ephemeral: true });
    return ix.reply({ embeds: [
      new EB().setTitle("Notes").setColor(0x3498db).setDescription(
        n.map(x => `**${x.by}**: ${x.note}`).join("\n")
      )
    ], ephemeral: true });
  }

  // ===== Ticket close =====
  if (c === "ticket-close") {
    const t = db.getTktByCh(ix.channelId);
    if (!t) return ix.reply({ content: "Not a ticket.", ephemeral: true });
    db.closeTkt(t.id, ix.options.getString("reason") || "Closed");
    await ix.reply({ embeds: [
      new EB().setTitle(`${t.tag} Closed`).setColor(0x95a5a6).setDescription("Channel will be deleted in 10s.")
    ]});
    await audit(ix.guild, `🔒 ${t.tag}`);
    setTimeout(async () => { try { await ix.channel.delete(); } catch {} }, 10000);
    return;
  }

  // ===== Suggestion respond =====
  if (c === "sugg-respond") {
    const id = ix.options.getInteger("id");
    const st = ix.options.getString("status");
    const rsp = ix.options.getString("response");
    const s = db.respSug(id, st, rsp, ix.user.displayName);
    if (!s) return ix.reply({ content: t("common.not_found"), ephemeral: true });
    await ix.reply({ embeds: [E.sugC(s)] });
    try {
      const u = await client.users.fetch(s.uid);
      await u.send({ embeds: [
        new EB().setTitle("Suggestion Response!").setColor(0xf39c12)
          .setDescription(`**${s.tag}:** ${s.title}\nStatus: **${st}**\n${rsp}`)
      ]});
    } catch {}
    return audit(ix.guild, `💡 ${s.tag} → ${st}`);
  }

  // ===== Announcements =====
  if (c === "announce") {
    const title = ix.options.getString("title");
    const content = ix.options.getString("content");
    const type = ix.options.getString("type");
    const ping = ix.options.getBoolean("ping");
    const version = ix.options.getString("version") || null;
    const cfg = db.getCfg(ix.guildId);
    const channel = cfg?.annCh ? ix.guild.channels.cache.get(cfg.annCh) : ix.channel;
    const titleWithVer = version ? `${title} · v${version}` : title;
    await (channel || ix.channel).send({
      content: ping ? "@everyone" : "",
      embeds: [E.annE(titleWithVer, content, type, ix.user.displayName)]
    });
    db.mkAnn(title, content, type, ix.user.displayName, version);
    return ix.reply({ content: t("common.sent"), ephemeral: true });
  }

  // ===== Q&A Sessions =====
  if (c === "qa-ac") {
    if (!ix.member.permissions.has(P.Flags.Administrator)) {
      return ix.reply({ content: t("common.admin_required"), ephemeral: true });
    }
    const existing = db.activeQa();
    if (existing) return ix.reply({ content: t("qa.already_active", { topic: existing.topic }), ephemeral: true });
    const topic = ix.options.getString("tema");
    const qa = db.mkQa(topic, ix.user.displayName);
    return ix.reply({ content: t("qa.opened", { topic: qa.topic }) });
  }
  if (c === "qa-kapat") {
    if (!ix.member.permissions.has(P.Flags.Administrator)) {
      return ix.reply({ content: t("common.admin_required"), ephemeral: true });
    }
    const active = db.activeQa();
    if (!active) return ix.reply({ content: t("qa.no_active"), ephemeral: true });
    const closed = db.closeQa(active.id);
    return ix.reply({ content: t("qa.closed", { topic: closed.topic, n: closed.questions.length }) });
  }
  if (c === "qa-soru") {
    const active = db.activeQa();
    if (!active) return ix.reply({ content: t("qa.no_active"), ephemeral: true });
    const modal = new (require("discord.js").ModalBuilder)()
      .setCustomId(`m_qa_${active.id}`)
      .setTitle(t("qa.submit_title", { topic: active.topic.slice(0, 30) }));
    modal.addComponents(new AR().addComponents(
      new (require("discord.js").TextInputBuilder)()
        .setCustomId("q")
        .setLabel(t("qa.submit_label"))
        .setStyle(require("discord.js").TextInputStyle.Paragraph)
        .setRequired(true).setMaxLength(500)
    ));
    return ix.showModal(modal);
  }
  if (c === "qa-liste") {
    const active = db.activeQa();
    if (!active) return ix.reply({ content: t("qa.no_active"), ephemeral: true });
    const top = db.qaTopQuestions(active.id, 10);
    const body = top.length
      ? top.map((q, i) => t("qa.question_entry", { n: i + 1, text: q.text, votes: q.up.length, name: q.name })).join("\n\n")
      : t("qa.list_empty");
    const embed = new EB()
      .setColor(0x9b59b6)
      .setTitle(t("qa.list_title"))
      .setDescription(`${t("qa.list_active_topic", { topic: active.topic, n: active.questions.length })}\n\n${body}`)
      .setTimestamp();
    // Add vote buttons for top questions (up to 5)
    const components = [];
    if (top.length) {
      const row = new AR();
      top.slice(0, 5).forEach(q => row.addComponents(
        new BB().setCustomId(`qav_${active.id}_${q.id}`).setLabel(t("qa.btn_vote", { votes: q.up.length })).setStyle(BS.Secondary)
      ));
      components.push(row);
    }
    return ix.reply({ embeds: [embed], components });
  }

  // ===== Patch Notes Archive =====
  if (c === "patch-notes") {
    const query = ix.options.getString("search");
    const notes = query ? db.patchNoteSearch(query) : db.patchNotes();
    const embed = new EB().setColor(0x2ecc71).setTimestamp();
    if (query) embed.setTitle(t("patch_notes.title_search", { q: query }));
    else embed.setTitle(t("patch_notes.title"));

    if (!notes.length) {
      embed.setDescription(query ? t("patch_notes.no_results", { q: query }) : t("patch_notes.empty"));
      return ix.reply({ embeds: [embed], ephemeral: true });
    }

    const pageInfo = paginate(notes, 1);
    const body = pageInfo.items.map(n => t("patch_notes.entry", {
      title: n.title,
      version: n.version ? t("patch_notes.version_badge", { v: n.version }) : "",
      date: n.at,
      by: n.by,
    })).join("\n\n");
    embed.setDescription(body);
    embed.setFooter({ text: t("patch_notes.footer", { n: notes.length, shown: pageInfo.items.length }) });

    return ix.reply({ embeds: [embed], ephemeral: true });
  }

  // ===== Giveaway =====
  if (c === "giveaway") {
    const prize = ix.options.getString("prize");
    const mins = ix.options.getInteger("duration");
    const win = ix.options.getInteger("winners") || 1;
    const cfg = db.getCfg(ix.guildId);
    const channel = cfg?.givCh ? ix.guild.channels.cache.get(cfg.givCh) : ix.channel;
    const g = db.mkGiv(prize, mins * 60000, win, ix.user.displayName, ix.guildId);
    const msg = await (channel || ix.channel).send({ embeds: [E.givE(g)], components: [E.givB(g.id)] });
    db.setGivMsg(g.id, (channel || ix.channel).id, msg.id);
    await ix.reply({ content: `Giveaway #${g.id} started!`, ephemeral: true });
    scheduleGiveawayEnd(g.id);
    return;
  }
  if (c === "giveaway-end") {
    const r = db.endGiv(ix.options.getInteger("id"));
    if (!r) return ix.reply({ content: t("common.not_found"), ephemeral: true });
    const winners = r.winners.map(w => `<@${w}>`).join(", ") || "None";
    return ix.reply({ content: `Winner: ${winners}` });
  }

  // ===== Poll =====
  if (c === "poll") {
    const q = ix.options.getString("question");
    const opts = ix.options.getString("options").split(",").map(o => o.trim()).filter(o => o);
    const mins = ix.options.getInteger("duration");
    const p = db.mkPoll(q, opts, mins ? mins * 60000 : null, ix.user.displayName, ix.guildId);
    const cfg = db.getCfg(ix.guildId);
    const channel = cfg?.pollCh ? ix.guild.channels.cache.get(cfg.pollCh) : ix.channel;
    const msg = await (channel || ix.channel).send({ embeds: [E.polE(p)], components: E.polB(p) });
    db.setPollMsg(p.id, (channel || ix.channel).id, msg.id);
    await ix.reply({ content: `Poll #${p.id} created!`, ephemeral: true });
    if (mins) schedulePollEnd(p.id);
    return;
  }
  if (c === "poll-end") {
    const p = db.endPoll(ix.options.getInteger("id"));
    if (!p) return ix.reply({ content: t("common.not_found"), ephemeral: true });
    return ix.reply({ embeds: [E.polE(p)] });
  }

  // ===== Beta program =====
  if (c === "beta-addkeys") {
    const keys = ix.options.getString("keys").split(/[,\n;]+/).map(k => k.trim()).filter(k => k.length > 2);
    const r = db.addKeys(keys);
    return ix.reply({ content: `**${r.added}** keys added. Pool: **${r.total}**`, ephemeral: true });
  }
  if (c === "beta-pool") return ix.reply({ embeds: [E.betaSE(db.betaSt())], ephemeral: true });
  if (c === "beta-pending") {
    const a = db.apps("pending");
    if (!a.length) return ix.reply({ content: t("common.none"), ephemeral: true });
    return ix.reply({
      embeds: a.slice(0, 5).map(x => E.betaC(x)),
      components: a.slice(0, 5).map(x => E.betaCB(x.id)),
      ephemeral: true
    });
  }
  if (c === "beta-used") {
    const u = db.usedKeys();
    if (!u.length) return ix.reply({ content: t("common.none"), ephemeral: true });
    return ix.reply({ embeds: [
      new EB().setTitle("📦 Distributed").setColor(0x9b59b6).setDescription(
        u.map(k => `\`${k.key.slice(0, 8)}...\` → **${k.name}**`).join("\n").slice(0, 4000)
      )
    ], ephemeral: true });
  }

  // ===== Automod =====
  if (c === "automod-word") {
    const action = ix.options.getString("action"), w = ix.options.getString("word");
    if (action === "add") db.addBan(w); else db.rmBan(w);
    return ix.reply({ content: `"${w}" ${action === "add" ? "added" : "removed"}.`, ephemeral: true });
  }
}

// ===== Setup (creates all channels, roles, panels) =====
async function cmdSetup(ix, client) {
  const lang = i18n.langOf(ix);
  const t = (k, p) => i18n.t(k, lang, p);
  const E = embedsFor(lang);
  if (!ix.member.permissions.has(P.Flags.Administrator)) {
    return ix.reply({ content: t("common.admin_required"), ephemeral: true });
  }
  await ix.deferReply();
  try {
    const g = ix.guild;
    // Store server default language (= admin's language at setup time)
    i18n.setServerLang(g.id, lang);
    const ensureRole = async (name, color) =>
      g.roles.cache.find(r => r.name === name) || await g.roles.create({ name, color });

    const roles = {};
    const ROLE_DEFS = [
      ["Developer", 0x3498db], ["3D Artist", 0xe91e63], ["Moderator", 0xe74c3c],
      ["Lead Developer", 0xf39c12], ["QA Tester", 0x2ecc71], ["Sound Designer", 0x9b59b6],
      ["Game Designer", 0x1abc9c], ["Active Player", 0x11806a], ["Experienced", 0x1f8b4c],
      ["Veteran", 0xc27c0e], ["Legend", 0xa84300], ["PC Player", 0x3498db],
      ["PS Player", 0x2e4057], ["Xbox Player", 0x107c10], ["Mobile Player", 0xe67e22],
      ["Beta Tester", 0x9b59b6], ["Verified", 0x2ecc71],
      // Trust level roles (src/trust.js)
      ...trust.LEVELS.filter(l => l.id > 0).map(l => [l.roleName, l.color]),
    ];
    for (const [name, color] of ROLE_DEFS) roles[name] = await ensureRole(name, color);

    const ensureCategory = async (name) =>
      g.channels.cache.find(ch => ch.name === name && ch.type === CH.GuildCategory) ||
      await g.channels.create({ name, type: CH.GuildCategory });

    const cats = {
      welcome:  await ensureCategory("Welcome"),
      community: await ensureCategory("Community"),
      feedback: await ensureCategory("Game Feedback"),
      support:  await ensureCategory("Support"),
      beta:     await ensureCategory("Beta Program"),
      announce: await ensureCategory("Announcements"),
      mgmt:     await ensureCategory("Management"),
    };

    // Admin-only perms for Management
    try {
      await cats.mgmt.permissionOverwrites.set([
        { id: g.id, deny: ["ViewChannel"] },
        { id: client.user.id, allow: ["ViewChannel"] },
        { id: roles["Developer"].id, allow: ["ViewChannel"] },
        { id: roles["Lead Developer"].id, allow: ["ViewChannel"] },
        { id: roles["Moderator"].id, allow: ["ViewChannel"] },
      ]);
    } catch {}

    const ensureChannel = async (name, cat, topic) =>
      g.channels.cache.find(ch => ch.name === name && ch.parentId === cat.id) ||
      await g.channels.create({ name, type: CH.GuildText, parent: cat.id, topic });

    const ch = {
      verify:   await ensureChannel("verification", cats.welcome, "Accept rules"),
      welcome:  await ensureChannel("welcome", cats.welcome, "New members"),
      general:  await ensureChannel("general-chat", cats.community, "General chat"),
      platform: await ensureChannel("platform-select", cats.community, "Choose platform"),
      giveaway: await ensureChannel("giveaways", cats.community, "Giveaways"),
      polls:    await ensureChannel("polls", cats.community, "Polls"),
      bugs:     await ensureChannel("bug-reports", cats.feedback, "Report bugs"),
      sugg:     await ensureChannel("suggestions", cats.feedback, "Suggestions"),
      ticket:   await ensureChannel("support-tickets", cats.support, "Open ticket"),
      beta:     await ensureChannel("beta-apply", cats.beta, "Beta applications"),
      ann:      await ensureChannel("announcements", cats.announce, "Announcements"),
      patch:    await ensureChannel("patch-notes", cats.announce, "Patch notes"),
      admin:    await ensureChannel("admin-panel", cats.mgmt, "Admin"),
      automod:  await ensureChannel("automod", cats.mgmt, "AutoMod"),
      botlog:   await ensureChannel("bot-log", cats.mgmt, "Logs"),
      betamgmt: await ensureChannel("beta-key-mgmt", cats.mgmt, "Key management"),
      betarev:  await ensureChannel("beta-review", cats.mgmt, "Review applications"),
    };

    db.setCfg(g.id, {
      bugCh: ch.bugs.id, adminCh: ch.admin.id, tktCh: ch.ticket.id,
      sugCh: ch.sugg.id, betaCh: ch.beta.id, betaAdm: ch.betamgmt.id,
      betaRev: ch.betarev.id, annCh: ch.ann.id, patchCh: ch.patch.id,
      logCh: ch.botlog.id, welCh: ch.welcome.id, verifyCh: ch.verify.id,
      givCh: ch.giveaway.id, pollCh: ch.polls.id, amCh: ch.automod.id,
      devRole: roles["Developer"].id,
      leadRole: roles["Lead Developer"].id,
      testRole: roles["QA Tester"].id,
    });

    await ch.verify.send({ embeds: [E.verifyP()], components: E.verifyB() });
    await ch.platform.send({ embeds: [E.rrP()], components: E.rrB() });
    await ch.bugs.send({ embeds: [E.bugP()], components: E.bugBP() });
    await ch.sugg.send({ embeds: [E.sugP()], components: E.sugBP() });
    await ch.ticket.send({ embeds: [E.tktP(db.tktSt())], components: E.tktBP() });
    await ch.beta.send({ embeds: [E.betaP(db.betaSt())], components: E.betaBP() });
    await ch.betamgmt.send({ embeds: [E.betaAP(db.betaSt())], components: E.betaABP() });
    await ch.admin.send({ embeds: [E.adminP(db.bugStats(), db.tktSt(), db.betaSt())], components: E.adminBP() });
    await ch.automod.send({ embeds: [E.amP(db.getAM())], components: [E.amB()] });

    await ix.editReply({ embeds: [
      new EB().setTitle(t("setup.complete_title")).setColor(0x00cc00).setDescription(
        t("setup.complete_desc", { roleCount: Object.keys(roles).length })
      ).setTimestamp()
    ]});
  } catch (e) {
    logger.error("Setup failed:", e);
    await ix.editReply({ content: t("setup.error", { msg: e.message }) }).catch(() => {});
  }
}

async function cmdReset(ix) {
  const lang = i18n.langOf(ix);
  const t = (k, p) => i18n.t(k, lang, p);
  if (!ix.member.permissions.has(P.Flags.Administrator)) {
    return ix.reply({ content: t("common.admin_required"), ephemeral: true });
  }
  // Two-step confirm to prevent accidental destructive action
  const embed = new EB()
    .setTitle(t("setup.reset_confirm_title"))
    .setColor(0xff0000)
    .setDescription(t("setup.reset_confirm_desc"));
  const row = new AR().addComponents(
    new BB().setCustomId("reset_confirm").setLabel(t("common.confirm")).setEmoji("⚠️").setStyle(BS.Danger),
    new BB().setCustomId("reset_cancel").setLabel(t("common.cancel")).setEmoji("✖️").setStyle(BS.Secondary),
  );
  return ix.reply({ embeds: [embed], components: [row], ephemeral: true });
}

module.exports = { handleCommand };

// Select menu dispatcher
const { EmbedBuilder: EB, ActionRowBuilder: AR, StringSelectMenuBuilder: SSM } = require("discord.js");
const { db } = require("../db");
const embedsFor = require("../embedsFor");
const i18n = require("../i18n");
const { paginate, pageRow } = require("../pagination");
const { audit } = require("../audit");
const { isDevOrMod } = require("../permissions");
const crisisMode = require("../crisisMode");
const { ensureBugMember } = require("./modals");

async function handleSelect(ix, client) {
  const lang = i18n.langOf(ix);
  const t = (k, p) => i18n.t(k, lang, p);
  const E = embedsFor(lang);

  // ===== Help category navigation =====
  if (ix.customId === "help_cat") {
    const cat = ix.values[0];
    const embed = new EB()
      .setColor(0x5865f2)
      .setTitle(t(`help.categories.${cat}.label`))
      .setDescription(t(`help.sections.${cat}`));
    const select = new SSM()
      .setCustomId("help_cat")
      .setPlaceholder(t("help.back"))
      .addOptions(
        { label: t("help.categories.bugs.label"),        value: "bugs" },
        { label: t("help.categories.tickets.label"),     value: "tickets" },
        { label: t("help.categories.suggestions.label"), value: "suggestions" },
        { label: t("help.categories.beta.label"),        value: "beta" },
        { label: t("help.categories.profile.label"),     value: "profile" },
        { label: t("help.categories.general.label"),     value: "general" },
      );
    return ix.update({ embeds: [embed], components: [new AR().addComponents(select)] });
  }

  // ===== FAQ category navigation =====
  if (ix.customId === "faq_cat") {
    const cat = ix.values[0].replace(/^faqcat_/, "");
    const items = db.faqs(cat);
    const embed = new EB()
      .setColor(0x3498db)
      .setTitle(t(`faq.categories.${cat}`) || cat);
    if (!items.length) {
      embed.setDescription(t("faq.empty_category"));
    } else {
      embed.setDescription(
        items.map((f, i) => t("faq.item", { n: i + 1, question: f.question, answer: f.answer }))
          .join("\n\n").slice(0, 4000)
      );
      embed.setFooter({ text: t("faq.footer", { n: items.length }) });
    }
    // Preserve dropdown so user can switch category
    const cats = db.faqCategories();
    const options = cats.map(c => ({
      label: t(`faq.categories.${c}`) || c,
      value: `faqcat_${c}`,
      description: `${db.faqs(c).length} FAQ`,
      default: c === cat,
    }));
    const select = new SSM()
      .setCustomId("faq_cat")
      .setPlaceholder(t("faq.select_placeholder"))
      .addOptions(options);
    return ix.update({ embeds: [embed], components: [new AR().addComponents(select)] });
  }

  // ===== Triage: quick-claim from dropdown =====
  if (ix.customId === "trg_claim") {
    if (!isDevOrMod(ix.member)) return ix.reply({ content: t("bug.dev_only"), ephemeral: true });
    const bid = parseInt(ix.values[0].replace(/^trgclaim_/, ""));
    const bug = db.getBug(bid);
    if (!bug) return ix.update({ content: t("common.not_found"), embeds: [], components: [] });
    const prev = bug.to;
    db.assignBug(bid, ix.user.id, ix.user.displayName);
    crisisMode.cancel(bid);
    const updated = db.getBug(bid);
    if (prev && prev !== ix.user.id) await ensureBugMember(ix.guild, updated, prev, false);
    await ensureBugMember(ix.guild, updated, ix.user.id, true);
    // Refresh the public bug card
    if (updated?.chId && updated?.msgId) {
      try {
        const chLang = i18n.resolveLang(null, ix.guildId);
        const chE = embedsFor(chLang);
        const ch = ix.guild.channels.cache.get(updated.chId);
        if (ch) {
          const msg = await ch.messages.fetch(updated.msgId);
          await msg.edit({ embeds: [chE.bugE(updated, db.getHist(bid), db.getCmts(bid))], components: chE.bugBB(updated, chLang, false) });
        }
      } catch {}
    }
    await audit(ix.guild, `🙋 ${updated.tag} claimed by ${ix.user.displayName} via triage`);
    return ix.update({ content: t("triage.quick_claimed", { tag: updated.tag }), embeds: [], components: [] });
  }

  // ===== Assign developer (user select) =====
  if (ix.customId.startsWith("asgsel_")) {
    if (!isDevOrMod(ix.member)) return ix.reply({ content: t("bug.dev_only"), ephemeral: true });
    const bid = parseInt(ix.customId.slice(7));
    const bug = db.getBug(bid);
    if (!bug) return ix.update({ content: t("common.not_found"), embeds: [], components: [] });
    const uid = ix.values[0];
    const prev = bug.to;
    if (!uid) {
      db.unassignBug(bid, ix.user.displayName);
      crisisMode.schedule(bid);  // unassigned → restart SLA
    } else {
      const target = await client.users.fetch(uid).catch(() => null);
      if (!target) return ix.update({ content: t("common.not_found"), embeds: [], components: [] });
      db.assignBug(bid, target.id, target.displayName || target.username);
      crisisMode.cancel(bid);  // now assigned → stop SLA clock
      // DM the assignee in their language
      try {
        const userLang = i18n.langForUser(target.id, ix.guildId);
        await target.send(i18n.t("bug.assigned_dm", userLang, { tag: bug.tag, title: bug.title })).catch(() => {});
      } catch {}
    }
    const updated = db.getBug(bid);
    if (prev && prev !== uid) await ensureBugMember(ix.guild, updated, prev, false);
    if (uid) await ensureBugMember(ix.guild, updated, uid, true);
    // Refresh the public bug card
    if (updated?.chId && updated?.msgId) {
      try {
        const chLang = i18n.resolveLang(null, ix.guildId);
        const chE = embedsFor(chLang);
        const ch = ix.guild.channels.cache.get(updated.chId);
        if (ch) {
          const msg = await ch.messages.fetch(updated.msgId);
          await msg.edit({ embeds: [chE.bugE(updated, db.getHist(bid), db.getCmts(bid))], components: chE.bugBB(updated, chLang, false) });
        }
      } catch {}
    }
    const doneMsg = uid
      ? t("bug.assigned", { tag: updated.tag, uid })
      : t("bug.assign_cleared");
    await audit(ix.guild, `👤 ${updated.tag} → ${uid ? `<@${uid}>` : "unassigned"} by ${ix.user.displayName}`);
    return ix.update({ content: doneMsg, embeds: [], components: [] });
  }

  // ===== Change severity (string select) =====
  if (ix.customId.startsWith("sevsel_")) {
    if (!isDevOrMod(ix.member)) return ix.reply({ content: t("bug.dev_only"), ephemeral: true });
    const bid = parseInt(ix.customId.slice(7));
    const newSev = ix.values[0];
    const updated = db.setSeverity(bid, newSev, ix.user.displayName);
    if (!updated) return ix.update({ content: t("common.not_found"), embeds: [], components: [] });
    if (updated?.chId && updated?.msgId) {
      try {
        const chLang = i18n.resolveLang(null, ix.guildId);
        const chE = embedsFor(chLang);
        const ch = ix.guild.channels.cache.get(updated.chId);
        if (ch) {
          const msg = await ch.messages.fetch(updated.msgId);
          await msg.edit({ embeds: [chE.bugE(updated, db.getHist(bid), db.getCmts(bid))], components: chE.bugBB(updated, chLang, false) });
        }
      } catch {}
    }
    const sevLabel = t(`bug.severity.${newSev}`);
    await audit(ix.guild, `🎚️ ${updated.tag} severity → ${newSev} by ${ix.user.displayName}`);
    return ix.update({ content: t("bug.severity_changed", { tag: updated.tag, sev: sevLabel }), embeds: [], components: [] });
  }

  if (ix.customId !== "filt") return;

  const value = ix.values[0];
  let bugs, title, filterKey;

  if (value === "all") {
    bugs = db.bugsActive();
    title = t("bug.list_title_active");
    filterKey = "all";
  } else if (value.startsWith("s_")) {
    const s = value.slice(2);
    bugs = db.bugsSev(s);
    title = `📋 ${t(`bug.severity.${s}`) || s}`;
    filterKey = value;
  } else if (value.startsWith("c_")) {
    const c = value.slice(2);
    bugs = db.bugsCat(c);
    title = `📋 ${t(`bug.category.${c}`) || c}`;
    filterKey = value;
  } else {
    bugs = db.bugsBy(value);
    title = `📋 ${t(`bug.status.${value}`) || value}`;
    filterKey = value;
  }

  const pageInfo = paginate(bugs, 1);
  const components = [E.filtS()];
  if (pageInfo.totalPages > 1) components.push(pageRow(`pbug_${filterKey}`, pageInfo.page, pageInfo.totalPages));

  return ix.update({
    embeds: [E.listE(pageInfo.items, title, pageInfo)],
    components,
  });
}

module.exports = { handleSelect };

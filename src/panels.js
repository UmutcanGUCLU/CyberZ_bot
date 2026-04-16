// Unified dashboard system — main hub + sub-panels + navigation.
// Every panel includes a "back to hub" button for consistent UX.
const {
  EmbedBuilder: EB, ActionRowBuilder: AR,
  ButtonBuilder: BB, ButtonStyle: BS,
} = require("discord.js");
const { db } = require("./db");
const i18n = require("./i18n");
const trust = require("./trust");
const achievements = require("./achievements");

// ===== Visual helpers =====
function progressBar(value, max, length = 12) {
  if (max <= 0) return "░".repeat(length);
  const ratio = Math.max(0, Math.min(1, value / max));
  const filled = Math.round(ratio * length);
  return "█".repeat(filled) + "░".repeat(length - filled);
}

function trendArrow(now, prev) {
  if (prev === undefined || prev === null) return "";
  if (now > prev) return " 📈";
  if (now < prev) return " 📉";
  return " ➖";
}

function compactStat(emoji, label, value) {
  return `${emoji} **${value}** ${label}`;
}

// ===== MAIN HUB =====
function mainHub(guildId, lang) {
  const t = (k, p) => i18n.t(k, lang, p);
  const bs = db.bugStats();
  const ts = db.tktSt();
  const bt = db.betaSt();
  const activeBugs = bs.open + bs.prog;
  const resolved = bs.resolved + bs.closed;
  const total = bs.total || 1;
  const resolutionPct = Math.round((resolved / total) * 100);

  const embed = new EB()
    .setColor(bs.critical > 0 ? 0xff3333 : 0x5865f2)
    .setAuthor({ name: t("panel.main_author") })
    .setTitle(t("panel.main_title"))
    .setDescription(t("panel.main_desc"));

  // Bugs block
  embed.addFields({
    name: t("panel.field_bugs"),
    value: [
      `🔴 **${bs.critical}** ${t("bug.severity.critical")}`,
      `🟠 **${bs.high}** ${t("bug.severity.high")}`,
      `📋 **${activeBugs}** ${t("panel.active")}`,
      `✅ ${resolutionPct}% ${t("panel.resolved_rate")}`,
      `\`${progressBar(resolved, total)}\``,
    ].join("\n"),
    inline: true,
  });

  // Support block
  embed.addFields({
    name: t("panel.field_support"),
    value: [
      `🎫 **${ts.open}** ${t("panel.tickets_open")}`,
      `🔒 **${ts.closed}** ${t("panel.tickets_closed")}`,
      `🔑 **${bt.pool}** ${t("panel.beta_keys")}`,
      `📨 **${bt.pending}** ${t("panel.beta_pending")}`,
    ].join("\n"),
    inline: true,
  });

  // Activity block
  embed.addFields({
    name: t("panel.field_today"),
    value: [
      `🐛 **${bs.today}** ${t("panel.new_bugs")}`,
      `👥 **${db.topMembers().length}** ${t("panel.active_members")}`,
      `🏅 ${countAchievementHolders()} ${t("panel.earned_badges")}`,
    ].join("\n"),
    inline: true,
  });

  embed.setTimestamp();
  embed.setFooter({ text: t("panel.footer_live") });
  return embed;
}

function countAchievementHolders() {
  const all = db.topMembers();
  return all.filter(m => (m.achievements || []).length > 0).length;
}

function mainHubButtons(lang) {
  const t = (k) => i18n.t(k, lang);
  return [
    new AR().addComponents(
      new BB().setCustomId("hub_bugs").setLabel(t("panel.btn_bugs")).setEmoji("🐛").setStyle(BS.Danger),
      new BB().setCustomId("hub_tickets").setLabel(t("panel.btn_tickets")).setEmoji("🎫").setStyle(BS.Primary),
      new BB().setCustomId("hub_community").setLabel(t("panel.btn_community")).setEmoji("🏆").setStyle(BS.Success),
    ),
    new AR().addComponents(
      new BB().setCustomId("hub_profile").setLabel(t("panel.btn_profile")).setEmoji("👤").setStyle(BS.Secondary),
      new BB().setCustomId("hub_badges").setLabel(t("panel.btn_badges")).setEmoji("🏅").setStyle(BS.Secondary),
      new BB().setCustomId("hub_patches").setLabel(t("panel.btn_patches")).setEmoji("📋").setStyle(BS.Secondary),
    ),
    new AR().addComponents(
      new BB().setCustomId("hub_faq").setLabel(t("panel.btn_faq")).setEmoji("❓").setStyle(BS.Secondary),
      new BB().setCustomId("hub_known").setLabel(t("panel.btn_known")).setEmoji("⚠️").setStyle(BS.Secondary),
      new BB().setCustomId("hub_refresh").setLabel(t("common.refresh")).setEmoji("🔄").setStyle(BS.Secondary),
    ),
  ];
}

// ===== BUG DASHBOARD =====
function bugsHub(lang) {
  const t = (k, p) => i18n.t(k, lang, p);
  const bs = db.bugStats();
  const activeBugs = bs.open + bs.prog;
  const resolved = bs.resolved + bs.closed;
  const total = bs.total || 1;

  const embed = new EB()
    .setColor(bs.critical > 0 ? 0xff3333 : 0x5865f2)
    .setTitle(t("panel.bugs_title"))
    .setDescription(t("panel.bugs_desc"))
    .addFields(
      {
        name: t("panel.bugs_severity"),
        value: [
          `🔴 ${t("bug.severity.critical")}: **${bs.critical}**`,
          `🟠 ${t("bug.severity.high")}: **${bs.high}**`,
          `🟡 ${t("bug.severity.medium")}: **${Math.max(0, activeBugs - bs.critical - bs.high)}**`,
        ].join("\n"),
        inline: true,
      },
      {
        name: t("panel.bugs_status"),
        value: [
          `📋 ${t("bug.status.open")}: **${bs.open}**`,
          `🔧 ${t("bug.status.in-progress")}: **${bs.prog}**`,
          `✅ ${t("bug.status.resolved")}: **${bs.resolved}**`,
        ].join("\n"),
        inline: true,
      },
    )
    .addFields({
      name: t("panel.resolution_progress"),
      value: `\`${progressBar(resolved, total)}\` **${Math.round((resolved / total) * 100)}%** (${resolved}/${total})`,
    })
    .setFooter({ text: t("panel.bugs_footer", { today: bs.today }) })
    .setTimestamp();

  if (bs.critical > 0) {
    embed.addFields({ name: "⚠️", value: t("panel.critical_alert", { n: bs.critical }) });
  }

  return embed;
}

function bugsHubButtons(lang) {
  const t = (k) => i18n.t(k, lang);
  return [
    new AR().addComponents(
      new BB().setCustomId("hub_bugs_list").setLabel(t("panel.btn_bugs_list")).setEmoji("📋").setStyle(BS.Primary),
      new BB().setCustomId("hub_bugs_critical").setLabel(t("panel.btn_bugs_crit")).setEmoji("🚨").setStyle(BS.Danger),
      new BB().setCustomId("hub_bugs_mine").setLabel(t("panel.btn_bugs_mine")).setEmoji("📌").setStyle(BS.Secondary),
    ),
    new AR().addComponents(
      navBackButton(lang),
    ),
  ];
}

// ===== COMMUNITY DASHBOARD =====
function communityHub(lang) {
  const t = (k, p) => i18n.t(k, lang, p);
  const top = db.topMembers().slice(0, 5);
  const totalMembers = db.topMembers().length;

  const embed = new EB()
    .setColor(0xf39c12)
    .setTitle(t("panel.community_title"))
    .setDescription(t("panel.community_desc", { total: totalMembers }));

  if (top.length) {
    const medals = ["🥇", "🥈", "🥉", "4.", "5."];
    embed.addFields({
      name: t("panel.top_players"),
      value: top.map((m, i) => `${medals[i]} **${m.name}** — ${m.score} pts`).join("\n"),
    });
  }

  const totalBugs = db.topMembers().reduce((s, m) => s + (m.bugs || 0), 0);
  const totalMsgs = db.topMembers().reduce((s, m) => s + (m.msgs || 0), 0);
  const totalInvs = db.topMembers().reduce((s, m) => s + (m.invs || 0), 0);

  embed.addFields(
    { name: "🐛", value: `**${totalBugs}**\n${t("panel.bugs_reported")}`, inline: true },
    { name: "💬", value: `**${totalMsgs}**\n${t("panel.messages_sent")}`, inline: true },
    { name: "📨", value: `**${totalInvs}**\n${t("panel.invites_made")}`, inline: true },
  );

  embed.setTimestamp();
  return embed;
}

function communityHubButtons(lang) {
  const t = (k) => i18n.t(k, lang);
  return [
    new AR().addComponents(
      new BB().setCustomId("hub_lb_full").setLabel(t("panel.btn_full_lb")).setEmoji("🏆").setStyle(BS.Primary),
      new BB().setCustomId("hub_devs").setLabel(t("panel.btn_devs")).setEmoji("👥").setStyle(BS.Secondary),
    ),
    new AR().addComponents(navBackButton(lang)),
  ];
}

// ===== PROFILE HUB =====
function profileHub(uid, rank, lang) {
  const t = (k, p) => i18n.t(k, lang, p);
  const m = db.getMem(uid);
  const score = (m.invs || 0) * 50 + (m.bugs || 0) * 30 + (m.msgs || 0);
  const currentLvl = trust.getLevel(uid);
  const currentLvlName = t(`trust.levels.${currentLvl.key}`);

  const achKeys = m.achievements || [];
  const achTotal = achievements.getOrder().length;
  const badgeLine = achKeys.slice(-5).map(k => achievements.getMeta(k)?.emoji || "").join(" ") || "—";

  const xpInLevel = m.xp % 100;
  const xpBar = progressBar(xpInLevel, 100);

  const embed = new EB()
    .setColor(currentLvl.color)
    .setAuthor({ name: t("panel.profile_author") })
    .setTitle(m.name || t("profile.unknown"))
    .setDescription([
      `**${t("profile.rank")}:** #${rank}`,
      `**${t("profile.score")}:** ${score} pts`,
      `**${t("trust.title")}:** ${currentLvl.id < 4 ? "⬆️ " : "🏆 "}${currentLvlName}`,
      "",
      `**${t("profile.level")} ${m.lvl || 0}**`,
      `\`${xpBar}\` ${xpInLevel}/100 XP`,
    ].join("\n"))
    .addFields(
      { name: t("profile.invites"),  value: `${m.invs || 0}`, inline: true },
      { name: t("profile.bugs"),     value: `${m.bugs || 0}`, inline: true },
      { name: t("profile.messages"), value: `${m.msgs || 0}`, inline: true },
      { name: `🏅 ${achKeys.length}/${achTotal}`, value: badgeLine, inline: false },
    )
    .setFooter({ text: t("profile.footer") })
    .setTimestamp();

  return embed;
}

function profileHubButtons(lang) {
  const t = (k) => i18n.t(k, lang);
  return [
    new AR().addComponents(
      new BB().setCustomId("hub_badges").setLabel(t("panel.btn_badges")).setEmoji("🏅").setStyle(BS.Primary),
      new BB().setCustomId("hub_profile_bugs").setLabel(t("panel.btn_my_bugs")).setEmoji("📌").setStyle(BS.Secondary),
      new BB().setCustomId("hub_lang").setLabel(t("panel.btn_language")).setEmoji("🌐").setStyle(BS.Secondary),
    ),
    new AR().addComponents(navBackButton(lang)),
  ];
}

// ===== BADGES HUB =====
function badgesHub(uid, lang) {
  const t = (k, p) => i18n.t(k, lang, p);
  const m = db.getMem(uid);
  const earned = m.achievements || [];
  const total = achievements.getOrder().length;

  const lines = achievements.getOrder().map(key => {
    const meta = achievements.getMeta(key);
    const has = earned.includes(key);
    const name = t(`achievements.${key}.name`);
    return has
      ? `${meta.emoji} **${name}** ✅`
      : `${meta.emoji} ${name} — 🔒`;
  });

  // Split into two columns
  const half = Math.ceil(lines.length / 2);
  const colA = lines.slice(0, half).join("\n");
  const colB = lines.slice(half).join("\n");

  return new EB()
    .setColor(earned.length === total ? 0xffd700 : 0xf39c12)
    .setTitle(t("achievements.panel_title"))
    .setDescription(`\`${progressBar(earned.length, total, 20)}\` **${earned.length}/${total}**`)
    .addFields(
      { name: "\u200b", value: colA || "—", inline: true },
      { name: "\u200b", value: colB || "\u200b", inline: true },
    )
    .setTimestamp();
}

function badgesHubButtons(lang) {
  return [new AR().addComponents(navBackButton(lang))];
}

// ===== PATCHES HUB =====
function patchesHub(lang) {
  const t = (k, p) => i18n.t(k, lang, p);
  const notes = db.patchNotes().slice(0, 10);
  const embed = new EB()
    .setColor(0x2ecc71)
    .setTitle(t("patch_notes.title"));

  if (!notes.length) {
    embed.setDescription(t("patch_notes.empty"));
  } else {
    embed.setDescription(notes.map(n => {
      const ver = n.version ? ` · \`v${n.version}\`` : "";
      return `**${n.title}**${ver}\n\`${n.at}\` · ${n.by}`;
    }).join("\n\n"));
    embed.setFooter({ text: t("patch_notes.footer", { n: notes.length, shown: notes.length }) });
  }
  embed.setTimestamp();
  return embed;
}

function patchesHubButtons(lang) {
  return [new AR().addComponents(navBackButton(lang))];
}

// ===== TICKETS / BETA HUB =====
function ticketsHub(lang) {
  const t = (k, p) => i18n.t(k, lang, p);
  const ts = db.tktSt();
  const bt = db.betaSt();
  const open = db.openTkts();

  const embed = new EB()
    .setColor(0xe74c3c)
    .setTitle(t("panel.tickets_title"))
    .setDescription(t("panel.tickets_desc"))
    .addFields(
      { name: t("panel.tickets_open_field"), value: `**${ts.open}**`, inline: true },
      { name: t("panel.tickets_closed_field"), value: `**${ts.closed}**`, inline: true },
      { name: t("panel.beta_pool_field"), value: `🔑 **${bt.pool}**`, inline: true },
    );

  if (open.length) {
    const list = open.slice(0, 5).map(x => `**${x.tag}** ${x.cat} — <@${x.uid}>${x.claimUid ? ` → <@${x.claimUid}>` : " ⏳"}`).join("\n");
    embed.addFields({ name: t("panel.recent_open_tickets"), value: list });
  }

  embed.setTimestamp();
  return embed;
}

function ticketsHubButtons(lang) {
  return [new AR().addComponents(navBackButton(lang))];
}

// ===== Known Issues Hub =====
function knownHub(lang) {
  const t = (k, p) => i18n.t(k, lang, p);
  const bugs = db.knownBugs().slice(0, 10);
  const embed = new EB()
    .setColor(0xf39c12)
    .setTitle(t("known_issues.panel_title"))
    .setTimestamp();

  if (!bugs.length) {
    embed.setDescription(t("known_issues.panel_desc_empty"));
  } else {
    embed.setDescription(t("known_issues.panel_desc") + "\n\n" + bugs.map(b => {
      const sevE = { critical: "🔴", high: "🟠", medium: "🟡", low: "🟢" }[b.sev] || "⚪";
      const wa = b.workaround ? `\n> 💡 ${b.workaround.slice(0, 140)}` : "";
      return `${sevE} **${b.tag}** ${b.title}${wa}`;
    }).join("\n\n"));
    embed.setFooter({ text: t("known_issues.list_footer", { n: bugs.length }) });
  }
  return embed;
}

function knownHubButtons(lang) {
  return [new AR().addComponents(navBackButton(lang))];
}

// ===== FAQ Hub =====
function faqHub(lang) {
  const t = (k, p) => i18n.t(k, lang, p);
  const all = db.faqs();
  const cats = db.faqCategories();
  const embed = new EB()
    .setColor(0x3498db)
    .setTitle(t("faq.panel_title"))
    .setTimestamp();

  if (!all.length) {
    embed.setDescription(t("faq.empty"));
  } else {
    const lines = cats.map(c => `${t(`faq.categories.${c}`) || c} — **${db.faqs(c).length}**`);
    embed.setDescription(t("faq.panel_desc") + "\n\n" + lines.join("\n"));
    embed.setFooter({ text: t("faq.footer", { n: all.length }) });
  }
  return embed;
}

function faqHubButtons(lang) {
  return [new AR().addComponents(navBackButton(lang))];
}

// ===== Shared =====
function navBackButton(lang) {
  const t = i18n.t("panel.btn_back_hub", lang);
  return new BB().setCustomId("hub_main").setLabel(t).setEmoji("🏠").setStyle(BS.Secondary);
}

module.exports = {
  mainHub, mainHubButtons,
  bugsHub, bugsHubButtons,
  communityHub, communityHubButtons,
  profileHub, profileHubButtons,
  badgesHub, badgesHubButtons,
  patchesHub, patchesHubButtons,
  ticketsHub, ticketsHubButtons,
  knownHub, knownHubButtons,
  faqHub, faqHubButtons,
  // Helpers
  progressBar,
};

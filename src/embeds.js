const {
  EmbedBuilder: E, ActionRowBuilder: R,
  ButtonBuilder: B, ButtonStyle: S,
  StringSelectMenuBuilder: SM
} = require("discord.js");
const i18n = require("./i18n");

const SEV = {
  critical: { e: "🔴", c: 0xff0000, key: "bug.severity.critical", b: "████████" },
  high:     { e: "🟠", c: 0xff8c00, key: "bug.severity.high",     b: "██████░░" },
  medium:   { e: "🟡", c: 0xffd700, key: "bug.severity.medium",   b: "████░░░░" },
  low:      { e: "🟢", c: 0x00cc00, key: "bug.severity.low",      b: "██░░░░░░" },
};
const ST = {
  "open":        { e: "📋", key: "bug.status.open" },
  "in-progress": { e: "🔧", key: "bug.status.in-progress" },
  "resolved":    { e: "✅", key: "bug.status.resolved" },
  "closed":      { e: "🔒", key: "bug.status.closed" },
};

const tt = (lang) => (k, p) => i18n.t(k, lang, p);

// ===== VERIFY =====
// customRules (optional) — admin-edited rules text saved in cfg.verifyRules. Overrides the locale default.
function verifyP(lang = "tr", customRules = null) {
  const t = tt(lang);
  return new E()
    .setColor(0x2ecc71)
    .setAuthor({ name: t("verify.panel_author") })
    .setTitle(t("verify.panel_title"))
    .setDescription(customRules || t("verify.panel_desc"))
    .setFooter({ text: "Studio Bot v7" })
    .setTimestamp();
}
function verifyB(lang = "tr") {
  const t = tt(lang);
  // Two rows: language picker (always shown) + verify button
  const langRow = new R().addComponents(
    new B().setCustomId("lang_tr").setLabel("Türkçe").setEmoji("🇹🇷").setStyle(S.Secondary),
    new B().setCustomId("lang_en").setLabel("English").setEmoji("🇬🇧").setStyle(S.Secondary),
  );
  const verifyRow = new R().addComponents(
    new B().setCustomId("verify_accept").setLabel(`  ${t("verify.btn_accept")}  `).setStyle(S.Success).setEmoji("✅")
  );
  return [langRow, verifyRow];
}

// ===== BUG PANEL =====
function bugP(lang = "tr") {
  const t = tt(lang);
  return new E()
    .setColor(0x5865f2)
    .setAuthor({ name: t("bug.panel_author") })
    .setTitle(t("bug.panel_title"))
    .setDescription(t("bug.panel_desc"))
    .setFooter({ text: "Studio Bot v7" })
    .setTimestamp();
}
function bugBP(lang = "tr") {
  const t = tt(lang);
  return [
    new R().addComponents(
      new B().setCustomId("open_report").setLabel(`  ${t("bug.btn_report")}  `).setStyle(S.Danger).setEmoji("🐛"),
    ),
    new R().addComponents(
      new B().setCustomId("my_bugs").setLabel(t("bug.btn_my_reports")).setStyle(S.Secondary).setEmoji("📌"),
      new B().setCustomId("open_dash").setLabel(t("bug.btn_dashboard")).setStyle(S.Secondary).setEmoji("📊"),
      new B().setCustomId("open_lb").setLabel(t("bug.btn_leaderboard")).setStyle(S.Secondary).setEmoji("🏆"),
    ),
  ];
}

// ===== ADMIN PANEL =====
function adminP(bs, ts, bt, lang = "tr") {
  const t = tt(lang);
  const pad4 = (n) => String(n || 0).padStart(4);
  const desc = t("admin.panel_desc", {
    open:     pad4(bs?.open),
    prog:     pad4(bs?.prog),
    resolved: pad4(bs?.resolved),
    closed:   pad4(bs?.closed),
    tktOpen:  pad4(ts?.open),
    pool:     pad4(bt?.pool),
    critical: bs?.critical || 0,
    total:    bs?.total || 0,
  });
  const embed = new E()
    .setColor(bs?.critical > 0 ? 0xe74c3c : 0x2f3136)
    .setAuthor({ name: t("admin.panel_author") })
    .setTitle(t("admin.panel_title"))
    .setDescription(desc)
    .setTimestamp();

  // Recent activity feed — shows last 5 bug events
  try {
    const { db } = require("./db");
    const recent = db.recentActivity(5);
    if (recent.length) {
      const lines = recent.map(r => {
        const emoji = {
          created: "🐛", assigned: "👤", resolved: "✅", closed: "🔒",
          reopened: "🔓", unassigned: "↩️", marked_known: "⚠️",
          unmarked_known: "♻️", severity_changed: "🎚️", escalated: "🚨",
        }[r.act] || "•";
        const time = r.at?.slice(5, 16) || "";
        return `${emoji} \`${time}\` **${r.tag || "?"}** — ${r.act} (${r.by})`;
      }).join("\n");
      embed.addFields({ name: t("admin.recent_activity"), value: lines.slice(0, 1024) });
    }
  } catch {}

  return embed;
}
function adminBP(lang = "tr") {
  const t = tt(lang);
  return [
    new R().addComponents(
      new B().setCustomId("a_bugs").setLabel(t("admin.btn_bugs")).setStyle(S.Primary).setEmoji("📋"),
      new B().setCustomId("a_crit").setLabel(t("admin.btn_critical")).setStyle(S.Danger).setEmoji("🚨"),
      new B().setCustomId("a_tkts").setLabel(t("admin.btn_tickets")).setStyle(S.Secondary).setEmoji("🎫"),
      new B().setCustomId("a_refresh").setLabel(t("admin.btn_refresh")).setStyle(S.Success).setEmoji("🔄"),
    ),
    new R().addComponents(
      new B().setCustomId("a_members").setLabel(t("admin.btn_members")).setStyle(S.Secondary).setEmoji("👥"),
      new B().setCustomId("a_automod").setLabel(t("admin.btn_automod")).setStyle(S.Secondary).setEmoji("🛡️"),
      new B().setCustomId("a_givs").setLabel(t("admin.btn_giveaways")).setStyle(S.Secondary).setEmoji("🎁"),
      new B().setCustomId("a_stats").setLabel(t("admin.btn_stats")).setStyle(S.Secondary).setEmoji("📈"),
    ),
  ];
}

// ===== TICKET =====
function tktP(s, lang = "tr") {
  const t = tt(lang);
  return new E()
    .setColor(0xe74c3c)
    .setAuthor({ name: t("ticket.panel_author") })
    .setTitle(t("ticket.panel_title"))
    .setDescription(t("ticket.panel_desc", { open: s?.open || 0, closed: s?.closed || 0 }))
    .setFooter({ text: "Support System" })
    .setTimestamp();
}
function tktBP(lang = "tr") {
  const t = tt(lang);
  return [new R().addComponents(
    new B().setCustomId("tkt_technical").setLabel(t("ticket.btn_technical")).setStyle(S.Danger).setEmoji("🔧"),
    new B().setCustomId("tkt_account").setLabel(t("ticket.btn_account")).setStyle(S.Primary).setEmoji("👤"),
    new B().setCustomId("tkt_payment").setLabel(t("ticket.btn_payment")).setStyle(S.Success).setEmoji("💰"),
    new B().setCustomId("tkt_general").setLabel(t("ticket.btn_general")).setStyle(S.Secondary).setEmoji("❓"),
  )];
}
function tktE(ticket, lang = "tr") {
  const t = tt(lang);
  const colors = { technical: 0xe74c3c, account: 0x3498db, payment: 0x2ecc71, general: 0x95a5a6 };
  return new E()
    .setColor(colors[ticket.cat] || 0x5865f2)
    .setAuthor({ name: ticket.tag })
    .setTitle(t(`ticket.categories.${ticket.cat}`) || ticket.cat)
    .setDescription(`>>> ${ticket.desc.slice(0, 500)}`)
    .addFields(
      { name: t("ticket.fields.created_by"), value: `<@${ticket.uid}>`, inline: true },
      { name: t("ticket.fields.status"),     value: ticket.status === "open" ? t("ticket.fields.status_open") : t("ticket.fields.status_closed"), inline: true },
      { name: t("ticket.fields.claimed_by"), value: ticket.claimUid ? `<@${ticket.claimUid}>` : t("ticket.fields.not_yet"), inline: true },
    )
    .setFooter({ text: `${ticket.tag} | ${ticket.at}` });
}

// ===== SUGGESTION =====
function sugP(lang = "tr") {
  const t = tt(lang);
  return new E()
    .setColor(0xf39c12)
    .setAuthor({ name: t("suggestion.panel_author") })
    .setTitle(t("suggestion.panel_title"))
    .setDescription(t("suggestion.panel_desc"))
    .setFooter({ text: "Suggestion System" })
    .setTimestamp();
}
function sugBP(lang = "tr") {
  const t = tt(lang);
  return [
    new R().addComponents(
      new B().setCustomId("sug_create").setLabel(`  ${t("suggestion.btn_submit")}  `).setStyle(S.Success).setEmoji("💡"),
    ),
    new R().addComponents(
      new B().setCustomId("sug_top").setLabel(t("suggestion.btn_popular")).setStyle(S.Secondary).setEmoji("🔥"),
      new B().setCustomId("sug_mine").setLabel(t("suggestion.btn_mine")).setStyle(S.Secondary).setEmoji("📌"),
    ),
  ];
}
function sugC(s, lang = "tr") {
  const t = tt(lang);
  const styles = {
    open:     { e: "💡", c: 0xf39c12 },
    approved: { e: "✅", c: 0x00cc00 },
    rejected: { e: "❌", c: 0xff0000 },
    planned:  { e: "📋", c: 0x3498db },
    done:     { e: "🎉", c: 0x9b59b6 },
  };
  const st = styles[s.status] || styles.open;
  const label = t(`suggestion.status.${s.status}`) || s.status;
  const score = (s.up?.length || 0) - (s.dn?.length || 0);
  const embed = new E()
    .setColor(st.c)
    .setAuthor({ name: `${s.tag} — ${st.e} ${label}` })
    .setTitle(s.title)
    .setDescription(`>>> ${s.desc.slice(0, 400)}`)
    .addFields(
      { name: t("suggestion.fields.score"), value: t("suggestion.fields.score_value", { up: s.up?.length || 0, dn: s.dn?.length || 0, net: score }), inline: true },
      { name: t("suggestion.fields.by"),    value: `<@${s.uid}>`, inline: true },
    );
  if (s.resp) {
    embed.addFields({
      name: t("suggestion.fields.response", { emoji: st.e, by: s.respBy }),
      value: `>>> ${s.resp}`,
    });
  }
  embed.setFooter({ text: `${s.tag} | ${s.at}` });
  return embed;
}
function sugVB(id, lang = "tr") {
  const t = tt(lang);
  return new R().addComponents(
    new B().setCustomId(`su_${id}`).setLabel(t("suggestion.btn_support")).setStyle(S.Success).setEmoji("👍"),
    new B().setCustomId(`sd_${id}`).setLabel(t("suggestion.btn_oppose")).setStyle(S.Secondary).setEmoji("👎"),
  );
}
function sugAB(id, lang = "tr") {
  const t = tt(lang);
  return new R().addComponents(
    new B().setCustomId(`sa_${id}`).setLabel(t("suggestion.btn_approve")).setStyle(S.Success).setEmoji("✅"),
    new B().setCustomId(`sp_${id}`).setLabel(t("suggestion.btn_plan")).setStyle(S.Primary).setEmoji("📋"),
    new B().setCustomId(`sr_${id}`).setLabel(t("suggestion.btn_reject")).setStyle(S.Danger).setEmoji("❌"),
    new B().setCustomId(`sx_${id}`).setLabel(t("suggestion.btn_done")).setStyle(S.Secondary).setEmoji("🎉"),
  );
}

// ===== BETA =====
function betaP(s, lang = "tr") {
  const t = tt(lang);
  return new E()
    .setColor(0x9b59b6)
    .setAuthor({ name: t("beta.panel_author") })
    .setTitle(t("beta.panel_title"))
    .setDescription(t("beta.panel_desc", {
      pool:     s?.pool || 0,
      pending:  s?.pending || 0,
      approved: s?.approved || 0,
      rejected: s?.rejected || 0,
    }))
    .setFooter({ text: "Beta Program" })
    .setTimestamp();
}
function betaBP(lang = "tr") {
  const t = tt(lang);
  return [
    new R().addComponents(
      new B().setCustomId("beta_apply").setLabel(`  ${t("beta.btn_apply")}  `).setStyle(S.Success).setEmoji("🔑"),
    ),
    new R().addComponents(
      new B().setCustomId("beta_status").setLabel(t("beta.btn_my_status")).setStyle(S.Secondary).setEmoji("📋"),
      new B().setCustomId("beta_stats").setLabel(t("beta.btn_stats")).setStyle(S.Secondary).setEmoji("📊"),
    ),
  ];
}
function betaAP(s, lang = "tr") {
  const t = tt(lang);
  const pad4 = (n) => String(n || 0).padStart(4);
  return new E()
    .setColor(0xe67e22)
    .setAuthor({ name: t("beta.management_author") })
    .setTitle(t("beta.management_title"))
    .setDescription("```\n" +
      `  🔑 ${pad4(s?.pool)}    📦 ${pad4(s?.used)}\n` +
      `  📨 ${pad4(s?.pending)}    ✅ ${pad4(s?.approved)}\n` +
      "```")
    .setTimestamp();
}
function betaABP(lang = "tr") {
  const t = tt(lang);
  return [new R().addComponents(
    new B().setCustomId("bk_add").setLabel(t("beta.btn_upload_keys")).setStyle(S.Success).setEmoji("🔑"),
    new B().setCustomId("bk_pending").setLabel(t("beta.btn_pending")).setStyle(S.Primary).setEmoji("📨"),
    new B().setCustomId("bk_used").setLabel(t("beta.btn_distributed")).setStyle(S.Secondary).setEmoji("📦"),
    new B().setCustomId("bk_refresh").setLabel(t("common.refresh")).setStyle(S.Secondary).setEmoji("🔄"),
  )];
}
function betaC(a, lang = "tr") {
  const t = tt(lang);
  const colors = { pending: 0xf39c12, approved: 0x00cc00, rejected: 0xff0000 };
  const e = new E()
    .setColor(colors[a.status] || 0x5865f2)
    .setAuthor({ name: `BETA #${a.id}` })
    .setTitle(t(`beta.status.${a.status}`) || a.status)
    .addFields(
      { name: t("beta.fields.applicant"), value: `<@${a.uid}>`, inline: true },
      { name: t("beta.fields.platform"),  value: a.plat || "?", inline: true },
      { name: t("beta.fields.date"),      value: a.at, inline: true },
    );
  if (a.reason) e.setDescription(`>>> ${a.reason.slice(0, 500)}`);
  if (a.reviewer) e.addFields({ name: t("beta.fields.reviewer"), value: a.reviewer, inline: true });
  if (a.key) e.addFields({ name: t("beta.fields.key"), value: `\`${a.key.slice(0, 5)}...\``, inline: true });
  return e;
}
function betaCB(id, lang = "tr") {
  const t = tt(lang);
  return new R().addComponents(
    new B().setCustomId(`bok_${id}`).setLabel(t("beta.btn_approve")).setStyle(S.Success).setEmoji("✅"),
    new B().setCustomId(`bno_${id}`).setLabel(t("beta.btn_reject")).setStyle(S.Danger).setEmoji("❌"),
  );
}
function betaSE(s, lang = "tr") {
  const t = tt(lang);
  const pad4 = (n) => String(n).padStart(4);
  return new E()
    .setTitle(t("beta.stats_title"))
    .setColor(0x9b59b6)
    .setDescription("```\n" +
      `  🔑 ${pad4(s.pool)}    📨 ${pad4(s.pending)}\n` +
      `  ✅ ${pad4(s.approved)}    ❌ ${pad4(s.rejected)}\n` +
      `  📦 ${pad4(s.used)}\n` +
      "```")
    .setTimestamp();
}

// ===== REACTION ROLES =====
function rrP(lang = "tr") {
  const t = tt(lang);
  return new E()
    .setColor(0x3498db)
    .setAuthor({ name: t("reaction_roles.panel_author") })
    .setTitle(t("reaction_roles.panel_title"))
    .setDescription(t("reaction_roles.panel_desc"))
    .setTimestamp();
}
function rrB(lang = "tr") {
  const t = tt(lang);
  return [new R().addComponents(
    new B().setCustomId("rr_PC Player").setLabel(t("reaction_roles.btn_pc")).setStyle(S.Secondary).setEmoji("🖥️"),
    new B().setCustomId("rr_PS Player").setLabel(t("reaction_roles.btn_ps")).setStyle(S.Secondary).setEmoji("🎮"),
    new B().setCustomId("rr_Xbox Player").setLabel(t("reaction_roles.btn_xbox")).setStyle(S.Secondary).setEmoji("🟢"),
    new B().setCustomId("rr_Mobile Player").setLabel(t("reaction_roles.btn_mobile")).setStyle(S.Secondary).setEmoji("📱"),
  )];
}

// ===== AUTOMOD =====
function amP(s, lang = "tr") {
  const t = tt(lang);
  return new E()
    .setColor(0xe74c3c)
    .setAuthor({ name: t("automod.panel_author") })
    .setTitle(t("automod.panel_title"))
    .setDescription(t("automod.panel_desc", {
      words: String(s.banned_words?.length || 0).padStart(4),
      caps: s.max_caps || 70,
      mentions: s.max_mentions || 5,
      spamCount: s.spam_count || 5,
      spamSec: (s.spam_ms || 3000) / 1000,
    }))
    .setTimestamp();
}
function amB(lang = "tr") {
  const t = tt(lang);
  return new R().addComponents(
    new B().setCustomId("am_words").setLabel(t("automod.btn_words")).setStyle(S.Danger).setEmoji("🚫"),
    new B().setCustomId("am_cfg").setLabel(t("automod.btn_config")).setStyle(S.Secondary).setEmoji("⚙️"),
  );
}

// ===== GIVEAWAY =====
function givE(g, lang = "tr") {
  const t = tt(lang);
  const desc = g.status === "active"
    ? t("giveaway.active_desc", {
        ts: Math.floor(new Date(g.ends).getTime() / 1000),
        winners: g.winCt,
        entries: g.entries.length,
      })
    : t("giveaway.ended_desc", {
        winners: g.winners.map(w => `<@${w}>`).join(", ") || t("giveaway.no_entries"),
        entries: g.entries.length,
      });
  return new E()
    .setColor(g.status === "active" ? 0xf39c12 : 0x95a5a6)
    .setAuthor({ name: t("giveaway.author") })
    .setTitle(`🎁 ${g.prize}`)
    .setDescription(desc)
    .setFooter({ text: `#${g.id} | ${g.host}` })
    .setTimestamp();
}
function givB(id, lang = "tr") {
  const t = tt(lang);
  return new R().addComponents(
    new B().setCustomId(`ge_${id}`).setLabel(t("giveaway.btn_enter")).setStyle(S.Success).setEmoji("🎉"),
  );
}

// ===== POLL =====
function polE(p, lang = "tr") {
  const t = tt(lang);
  const total = p.opts.reduce((s, o) => s + o.v.length, 0) || 1;
  let desc = p.opts.map((o, i) => {
    const pct = Math.round(o.v.length / total * 100);
    const bar = "█".repeat(Math.round(pct / 5)) + "░".repeat(20 - Math.round(pct / 5));
    return `**${i + 1}.** ${o.t}\n\`${bar}\` ${pct}% (${o.v.length})`;
  }).join("\n\n");
  if (p.ends && p.status === "active") {
    desc += "\n\n" + t("poll.ends_in", { ts: Math.floor(new Date(p.ends).getTime() / 1000) });
  }
  return new E()
    .setColor(p.status === "active" ? 0x3498db : 0x95a5a6)
    .setAuthor({ name: p.status === "active" ? t("poll.author_active") : t("poll.author_ended") })
    .setTitle(p.q)
    .setDescription(desc)
    .setFooter({ text: `#${p.id} | ${p.author}` })
    .setTimestamp();
}
function polB(p) {
  const rows = [];
  for (let i = 0; i < p.opts.length; i += 4) {
    const r = new R();
    for (let j = i; j < Math.min(i + 4, p.opts.length); j++) {
      r.addComponents(
        new B().setCustomId(`pv_${p.id}_${j}`).setLabel(`${j + 1}. ${p.opts[j].t.slice(0, 20)}`).setStyle(S.Secondary)
      );
    }
    rows.push(r);
  }
  return rows;
}

// ===== PROFILE =====
function profE(m, rank, lang = "tr") {
  const t = tt(lang);
  const score = m.invs * 50 + m.bugs * 30 + m.msgs;
  const pct = Math.round(m.xp % 100);
  const bar = "█".repeat(Math.round(pct / 5)) + "░".repeat(20 - Math.round(pct / 5));
  const earnedCount = (m.achievements || []).length;
  // Try to resolve achievements module lazily to avoid circular requires
  let badges = "—";
  try {
    const { getMeta } = require("./achievements");
    const keys = (m.achievements || []).slice(-5);
    if (keys.length) badges = keys.map(k => getMeta(k)?.emoji || "").join(" ");
  } catch {}
  const e = new E()
    .setColor(0x5865f2)
    .setAuthor({ name: t("profile.author") })
    .setTitle(m.name || t("profile.unknown"))
    .setDescription(
      `**${t("profile.rank")}:** #${rank}\n` +
      `**${t("profile.score")}:** ${score} pts\n\n` +
      `**${t("profile.level")} ${m.lvl}**\n` +
      `\`${bar}\` ${m.xp} / ${(m.lvl + 1) * 100} XP`
    )
    .addFields(
      { name: t("profile.invites"),  value: `${m.invs || 0}`, inline: true },
      { name: t("profile.bugs"),     value: `${m.bugs || 0}`, inline: true },
      { name: t("profile.messages"), value: `${m.msgs || 0}`, inline: true },
      { name: t("profile.joined"),   value: m.joined || "?",  inline: true },
      { name: `🏅 ${earnedCount}`,  value: badges, inline: true },
    )
    .setFooter({ text: t("profile.footer") })
    .setTimestamp();
  return e;
}

// ===== LEADERBOARD =====
function lbE(members, lang = "tr", pageInfo = null) {
  const t = tt(lang);
  const medals = ["🥇", "🥈", "🥉"];
  // If pageInfo provided, show correct rank numbers (page offset aware)
  const offset = pageInfo ? (pageInfo.page - 1) * (pageInfo.perPage || 10) : 0;
  const body = members
    .map((x, i) => {
      const rank = offset + i;
      const prefix = rank < 3 ? medals[rank] : `${rank + 1}.`;
      return `${prefix} **${x.name}** — ${x.score} pts (📨${x.invs || 0} 🐛${x.bugs || 0} 💬${x.msgs || 0})`;
    })
    .join("\n") || t("leaderboard.empty");
  const footer = pageInfo
    ? `${t("leaderboard.footer")} · ${pageInfo.page}/${pageInfo.totalPages}`
    : t("leaderboard.footer");
  return new E()
    .setColor(0xf39c12)
    .setAuthor({ name: t("leaderboard.author") })
    .setTitle(t("leaderboard.title"))
    .setDescription(body)
    .setFooter({ text: footer })
    .setTimestamp();
}

// ===== BUG CARD =====
function bugE(b, history = [], comments = [], lang = "tr") {
  const t = tt(lang);
  const sv = SEV[b.sev] || SEV.medium;
  const st = ST[b.status] || ST.open;
  const knownPrefix = b.known ? `${t("known_issues.badge")} · ` : "";
  const e = new E()
    .setColor(b.known ? 0xf39c12 : sv.c)
    .setAuthor({ name: `${knownPrefix}${b.tag} — ${st.e} ${t(st.key)}` })
    .setTitle(b.title)
    .setDescription(`>>> ${b.desc.slice(0, 280)}`);
  if (b.known && b.workaround) {
    e.addFields({ name: t("known_issues.workaround_field"), value: `>>> ${b.workaround.slice(0, 400)}` });
  }
  if (b.steps) {
    e.addFields({ name: t("bug.fields.steps"), value: `\`\`\`\n${b.steps.slice(0, 400)}\n\`\`\`` });
  }
  e.addFields(
    { name: t("bug.fields.severity"), value: `${sv.e} \`${sv.b}\``, inline: true },
    { name: t("bug.fields.platform"), value: t(`bug.platform.${b.plat}`) || "?", inline: true },
    { name: t("bug.fields.category"), value: t(`bug.category.${b.cat}`) || "?", inline: true },
    { name: t("bug.fields.reporter"), value: `<@${b.by}>`, inline: true },
    { name: t("bug.fields.assigned"), value: b.to ? `<@${b.to}>` : "—", inline: true },
    { name: t("bug.fields.votes"),    value: `👍 ${b.votes?.length || 0}`, inline: true },
  );
  if (b.resNote) {
    e.addFields({ name: t("bug.fields.resolution"), value: `>>> ${b.resNote.slice(0, 400)}` });
  }
  if (history.length) {
    e.addFields({
      name: t("bug.fields.history"),
      value: history.slice(-5).map(x => `\`${x.at}\` ▸ **${x.act}** (${x.by})`).join("\n").slice(0, 1024)
    });
  }
  if (comments.length) {
    e.addFields({
      name: t("bug.fields.comments", { n: comments.length }),
      value: comments.slice(-3).map(x => `> **${x.name}:** ${x.txt}`).join("\n").slice(0, 1024)
    });
  }
  e.setFooter({ text: `${b.tag} | ${b.at}` });
  return e;
}
// Staff-only action row for bug-tickets. Reporter physically sees the buttons
// (Discord can't hide components per-viewer) but handlers reject non-crew clicks.
function bugBB_staffOnly(b, lang = "tr") {
  const t = tt(lang);
  const s = b.status, rows = [];
  const r = new R();
  if (s === "open") {
    r.addComponents(
      new B().setCustomId(`cl_${b.id}`).setLabel(t("bug.btn_claim")).setStyle(S.Primary).setEmoji("🙋"),
      new B().setCustomId(`rv_${b.id}`).setLabel(t("bug.btn_resolve")).setStyle(S.Success).setEmoji("✅"),
      new B().setCustomId(`cx_${b.id}`).setLabel(t("bug.btn_close")).setStyle(S.Secondary).setEmoji("🔒"),
    );
  } else if (s === "in-progress") {
    r.addComponents(
      new B().setCustomId(`rv_${b.id}`).setLabel(t("bug.btn_resolve")).setStyle(S.Success).setEmoji("✅"),
      new B().setCustomId(`cx_${b.id}`).setLabel(t("bug.btn_close")).setStyle(S.Secondary).setEmoji("🔒"),
      new B().setCustomId(`ua_${b.id}`).setLabel(t("bug.btn_unassign")).setStyle(S.Secondary).setEmoji("↩️"),
    );
  } else {
    r.addComponents(
      new B().setCustomId(`ro_${b.id}`).setLabel(t("bug.btn_reopen")).setStyle(S.Danger).setEmoji("🔓"),
    );
  }
  rows.push(r);
  if (s !== "closed") {
    const knownBtn = b.known
      ? new B().setCustomId(`umk_${b.id}`).setLabel(t("bug.btn_unmark_known")).setStyle(S.Secondary).setEmoji("✅")
      : new B().setCustomId(`mk_${b.id}`).setLabel(t("bug.btn_mark_known")).setStyle(S.Secondary).setEmoji("⚠️");
    rows.push(new R().addComponents(
      knownBtn,
      new B().setCustomId(`asg_${b.id}`).setLabel(t("bug.btn_assign")).setStyle(S.Secondary).setEmoji("👤"),
      new B().setCustomId(`sev_${b.id}`).setLabel(t("bug.btn_severity")).setStyle(S.Secondary).setEmoji("🎚️"),
    ));
  }
  return rows;
}

// staffView=false renders only the comment button — used in the bug-tickets channel where
// the reporter (and anyone else in that channel who isn't staff) should not see action buttons.
function bugBB(b, lang = "tr", staffView = true) {
  const t = tt(lang);
  if (!staffView) {
    return [new R().addComponents(
      new B().setCustomId(`cm_${b.id}`).setLabel(t("bug.btn_comment")).setStyle(S.Secondary).setEmoji("💬"),
    )];
  }
  const s = b.status, rows = [];

  // Row 1: Primary status actions
  const r = new R();
  if (s === "open") {
    r.addComponents(
      new B().setCustomId(`cl_${b.id}`).setLabel(t("bug.btn_claim")).setStyle(S.Primary).setEmoji("🙋"),
      new B().setCustomId(`rv_${b.id}`).setLabel(t("bug.btn_resolve")).setStyle(S.Success).setEmoji("✅"),
      new B().setCustomId(`cx_${b.id}`).setLabel(t("bug.btn_close")).setStyle(S.Secondary).setEmoji("🔒"),
      new B().setCustomId(`vu_${b.id}`).setLabel(`${b.votes?.length || 0}`).setStyle(S.Secondary).setEmoji("👍"),
    );
  } else if (s === "in-progress") {
    r.addComponents(
      new B().setCustomId(`rv_${b.id}`).setLabel(t("bug.btn_resolve")).setStyle(S.Success).setEmoji("✅"),
      new B().setCustomId(`cx_${b.id}`).setLabel(t("bug.btn_close")).setStyle(S.Secondary).setEmoji("🔒"),
      new B().setCustomId(`ua_${b.id}`).setLabel(t("bug.btn_unassign")).setStyle(S.Secondary).setEmoji("↩️"),
      new B().setCustomId(`vu_${b.id}`).setLabel(`${b.votes?.length || 0}`).setStyle(S.Secondary).setEmoji("👍"),
    );
  } else {
    r.addComponents(
      new B().setCustomId(`ro_${b.id}`).setLabel(t("bug.btn_reopen")).setStyle(S.Danger).setEmoji("🔓"),
      new B().setCustomId(`vu_${b.id}`).setLabel(`${b.votes?.length || 0}`).setStyle(S.Secondary).setEmoji("👍"),
    );
  }
  rows.push(r);

  // Row 2: Conversational actions (available for any status)
  rows.push(new R().addComponents(
    new B().setCustomId(`cm_${b.id}`).setLabel(t("bug.btn_comment")).setStyle(S.Secondary).setEmoji("💬"),
    new B().setCustomId(`th_${b.id}`).setLabel(t("bug.btn_thread")).setStyle(S.Secondary).setEmoji("🧵"),
    new B().setCustomId(`hi_${b.id}`).setLabel(t("bug.btn_history")).setStyle(S.Secondary).setEmoji("📜"),
  ));

  // Row 3: Dev actions — only for active bugs (permission-gated at click time)
  if (s !== "closed") {
    const knownBtn = b.known
      ? new B().setCustomId(`umk_${b.id}`).setLabel(t("bug.btn_unmark_known")).setStyle(S.Secondary).setEmoji("✅")
      : new B().setCustomId(`mk_${b.id}`).setLabel(t("bug.btn_mark_known")).setStyle(S.Secondary).setEmoji("⚠️");
    rows.push(new R().addComponents(
      knownBtn,
      new B().setCustomId(`asg_${b.id}`).setLabel(t("bug.btn_assign")).setStyle(S.Secondary).setEmoji("👤"),
      new B().setCustomId(`sev_${b.id}`).setLabel(t("bug.btn_severity")).setStyle(S.Secondary).setEmoji("🎚️"),
    ));
  }

  return rows;
}

// ===== LIST / DASH / STATS =====
function listE(bugs, title, lang = "tr", pageInfo = null) {
  const t = tt(lang);
  const e = new E().setTitle(title).setColor(0x5865f2).setTimestamp();
  if (!bugs.length) {
    e.setDescription(t("bug.list_empty"));
    return e;
  }
  e.setDescription(bugs.map(b =>
    `${SEV[b.sev]?.e || ""}${ST[b.status]?.e || ""} **${b.tag}** ${b.title}${b.toN ? " → " + b.toN : ""}`
  ).join("\n").slice(0, 4000));
  const footer = pageInfo
    ? `${t("bug.list_footer", { n: pageInfo.total })} · ${pageInfo.page}/${pageInfo.totalPages}`
    : t("bug.list_footer", { n: bugs.length });
  e.setFooter({ text: footer });
  return e;
}
function dashE(s, lb, lang = "tr") {
  const t = tt(lang);
  const total = s.total || 1;
  const rate = (((s.resolved + s.closed) / total) * 100).toFixed(1);
  const bar = (n, em) => em.repeat(Math.max(0, Math.round((n / total) * 20)));
  const bars = (bar(s.open, "🟥") + bar(s.prog, "🟧") + bar(s.resolved, "🟩") + bar(s.closed, "⬛")) || "░░░░░░░░░░░░░░░░░░░░";
  let desc = `${t("dashboard.resolution_rate", { rate })}\n${bars}\n\n🟥 ${s.open} | 🟧 ${s.prog} | 🟩 ${s.resolved} | ⬛ ${s.closed}`;
  if (s.critical > 0) desc += "\n\n" + t("dashboard.critical_alert", { n: s.critical });
  return new E()
    .setTitle(t("dashboard.title"))
    .setColor(s.critical > 0 ? 0xff0000 : 0x00cc00)
    .setDescription(desc)
    .addFields(
      { name: t("dashboard.total"),    value: `${s.total}`,    inline: true },
      { name: t("dashboard.critical"), value: `${s.critical}`, inline: true },
      { name: t("dashboard.today"),    value: `${s.today}`,    inline: true },
    )
    .setTimestamp();
}
function statE(s, lb, lang = "tr") {
  const t = tt(lang);
  const e = new E()
    .setTitle(t("stats.title"))
    .setColor(0x5865f2)
    .addFields(
      { name: t("stats.total"),    value: `${s.total}`,    inline: true },
      { name: t("stats.open"),     value: `${s.open}`,     inline: true },
      { name: t("stats.progress"), value: `${s.prog}`,     inline: true },
      { name: t("stats.resolved"), value: `${s.resolved}`, inline: true },
      { name: t("stats.closed"),   value: `${s.closed}`,   inline: true },
      { name: t("stats.critical"), value: `${s.critical}`, inline: true },
    )
    .setTimestamp();
  if (lb?.length) {
    const medals = ["🥇", "🥈", "🥉"];
    e.addFields({
      name: t("stats.dev_leaderboard"),
      value: lb.map((d, i) => `${medals[i] || (i + 1) + "."} **${d.name}** ${d.resolved} (${d.spec})`).join("\n")
    });
  }
  return e;
}
function filtS(lang = "tr") {
  const t = tt(lang);
  return new R().addComponents(
    new SM().setCustomId("filt").setPlaceholder(t("bug.select_placeholder")).addOptions(
      { label: t("bug.status.open"),          value: "all",            emoji: "📋" },
      { label: t("bug.status.open"),          value: "open",           emoji: "📂" },
      { label: t("bug.status.in-progress"),   value: "in-progress",    emoji: "🔧" },
      { label: t("bug.status.resolved"),      value: "resolved",       emoji: "✅" },
      { label: t("bug.severity.critical"),    value: "s_critical",     emoji: "🔴" },
      { label: t("bug.severity.high"),        value: "s_high",         emoji: "🟠" },
      { label: t("bug.category.gameplay"),    value: "c_gameplay",     emoji: "🎮" },
      { label: t("bug.category.graphics"),    value: "c_graphics",     emoji: "🖼️" },
      { label: t("bug.category.network"),     value: "c_network",      emoji: "🌐" },
      { label: t("bug.category.performance"), value: "c_performance",  emoji: "⚡" },
    )
  );
}
function annE(title, content, type, by, lang = "tr") {
  const t = tt(lang);
  const styles = {
    update:    { e: "🔄", c: 0x3498db, key: "announcement.types.update" },
    patchnote: { e: "📋", c: 0x2ecc71, key: "announcement.types.patchnote" },
    event:     { e: "🎉", c: 0xf39c12, key: "announcement.types.event" },
    important: { e: "🚨", c: 0xe74c3c, key: "announcement.types.important" },
    general:   { e: "📢", c: 0x5865f2, key: "announcement.types.general" },
  };
  const s = styles[type] || styles.general;
  return new E()
    .setColor(s.c)
    .setAuthor({ name: `${s.e} ${t(s.key)}` })
    .setTitle(title)
    .setDescription(content)
    .setFooter({ text: `${by} • Studio Bot` })
    .setTimestamp();
}

module.exports = {
  SEV, ST,
  verifyP, verifyB,
  bugP, bugBP,
  adminP, adminBP,
  tktP, tktBP, tktE,
  sugP, sugBP, sugC, sugVB, sugAB,
  betaP, betaBP, betaAP, betaABP, betaC, betaCB, betaSE,
  rrP, rrB,
  amP, amB,
  givE, givB,
  polE, polB,
  profE, lbE,
  bugE, bugBB, bugBB_staffOnly,
  listE, dashE, statE, filtS, annE,
};

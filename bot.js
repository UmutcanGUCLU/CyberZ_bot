require("dotenv").config();
const {
  Client, GatewayIntentBits: I,
  EmbedBuilder: EB, Events: EV, REST, Routes,
  ActionRowBuilder: AR, ButtonBuilder: BB, ButtonStyle: BS
} = require("discord.js");

const { db } = require("./src/db");
const embedsFor = require("./src/embedsFor");
const logger = require("./src/logger");
const scheduler = require("./src/scheduler");
const { audit } = require("./src/audit");
const { commands } = require("./src/commands");
const i18n = require("./src/i18n");
const achievements = require("./src/achievements");
const trust = require("./src/trust");
const raidProtection = require("./src/raidProtection");
const autoSlowMode = require("./src/autoSlowMode");
const crisisMode = require("./src/crisisMode");
const tempVoice = require("./src/tempVoice");
const { handleCommand } = require("./src/interactions/commands");
const { handleButton }  = require("./src/interactions/buttons");
const { handleModal }   = require("./src/interactions/modals");
const { handleSelect }  = require("./src/interactions/selects");

const client = new Client({
  intents: [
    I.Guilds,
    I.GuildMembers,
    I.GuildMessages,
    I.MessageContent,
    I.GuildInvites,
    I.GuildVoiceStates
  ]
});

scheduler.init(client);
crisisMode.init(client);

// ===== READY: register commands, restore timers, snapshot invites =====
client.once(EV.ClientReady, async () => {
  logger.info(`Bot online: ${client.user.tag} | ${client.guilds.cache.size} servers`);
  client.user.setActivity("CyberZ Bot");

  try {
    logger.info("Registering commands...");
    await new REST()
      .setToken(process.env.BOT_TOKEN)
      .put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
        { body: commands.map(c => c.toJSON()) }
      );
    logger.info(`${commands.length} commands registered`);
  } catch (e) {
    logger.error("Command registration failed:", e.message);
  }

  // Snapshot invites so we can detect who invited new members
  try {
    const g = client.guilds.cache.first();
    if (g) {
      const invites = await g.invites.fetch();
      db.storeInvs(invites.map(i => ({ code: i.code, uses: i.uses, inv: i.inviter?.id })));
    }
  } catch (e) {
    logger.warn("Invite snapshot failed:", e.message);
  }

  // Restore scheduled giveaway/poll timers from DB
  try {
    const { giveaways, polls } = scheduler.restoreAll();
    if (giveaways || polls) {
      logger.info(`Restored ${giveaways} giveaway(s), ${polls} poll(s)`);
    }
  } catch (e) {
    logger.error("Timer restore failed:", e.message);
  }

  // Restore crisis-mode escalation timers for unclaimed critical/high bugs
  try {
    const n = crisisMode.restoreAll();
    if (n) logger.info(`Restored ${n} crisis-mode escalation(s)`);
  } catch (e) {
    logger.error("Crisis mode restore failed:", e.message);
  }

  // Sweep temp voice channels — delete any empty ones, drop stale tracking entries
  try {
    const n = await tempVoice.restoreAll(client);
    if (n) logger.info(`Cleaned up ${n} stale temp VC(s)`);
  } catch (e) {
    logger.error("Temp VC sweep failed:", e.message);
  }
});

// ===== VOICE STATE UPDATE: Join-to-Create temp voice rooms =====
client.on(EV.VoiceStateUpdate, (oldState, newState) => {
  tempVoice.handleVoiceStateUpdate(oldState, newState).catch(e =>
    logger.error("voiceStateUpdate failed:", e.message)
  );
});

// ===== GUILD MEMBER ADD: welcome + invite attribution =====
client.on(EV.GuildMemberAdd, async (member) => {
  try {
    const cfg = db.getCfg(member.guild.id);
    db.welcome(member.id, member.displayName);
    db.getMem(member.id);
    db.updMem(member.id, {
      name: member.displayName,
      joined: new Date().toISOString().slice(0, 19)
    });

    // Raid protection — check for suspicious join burst
    const detection = raidProtection.recordJoin(member);
    if (detection.triggered) {
      await raidProtection.alertStaff(member.guild, detection);
    }

    // Detect who invited the new member
    try {
      const newInvites = await member.guild.invites.fetch();
      const oldInvites = db.getInvs();
      const used = newInvites.find(i => {
        const old = oldInvites.find(x => x.code === i.code);
        return old && i.uses > old.uses;
      });
      if (used?.inviter) {
        db.incInvs(used.inviter.id);
        const auditLang = i18n.resolveLang(null, member.guild.id);
        await audit(member.guild, i18n.t("welcome.invited_by", auditLang, { name: member.displayName, inviter: used.inviter.id }));
        achievements.trigger(client, used.inviter.id, member.guild.id).catch(() => {});
      }
      db.storeInvs(newInvites.map(i => ({ code: i.code, uses: i.uses, inv: i.inviter?.id })));
    } catch {}

    // Welcome message in server-default language
    if (cfg?.welCh) {
      const ch = member.guild.channels.cache.get(cfg.welCh);
      if (ch) {
        const wLang = i18n.resolveLang(null, member.guild.id);
        await ch.send({
          content: `<@${member.id}>`,
          embeds: [new EB()
            .setTitle(i18n.t("welcome.title", wLang))
            .setColor(0x00cc00)
            .setDescription(i18n.t("welcome.desc", wLang, { uid: member.id, count: member.guild.memberCount }))
            .setThumbnail(member.user.displayAvatarURL())
            .setTimestamp()]
        });
      }
    }

    // Onboarding DM — embed only, no action buttons (silently ignored if DMs closed)
    try {
      await member.send({
        embeds: [new EB()
          .setColor(0x5865f2)
          .setTitle(i18n.t("welcome.dm_title", "en"))
          .setDescription(i18n.t("welcome.dm_desc", "en", { guild: member.guild.name }))
          .setThumbnail(member.guild.iconURL() || null)],
      });
    } catch {}
  } catch (e) {
    logger.warn("Member add handling failed:", e.message);
  }
});

// ===== MESSAGE CREATE: XP tracking + automod =====
client.on(EV.MessageCreate, async (msg) => {
  if (msg.author.bot || !msg.guild) return;

  // Auto slow-mode — best-effort, silently logs errors
  autoSlowMode.tick(msg).catch(() => {});

  // Server-default language for public announcements
  const gLang = i18n.resolveLang(null, msg.guild.id);
  const gt = (k, p) => i18n.t(k, gLang, p);

  // XP / leveling
  const r = db.trackMsg(msg.author.id, msg.author.displayName);
  if (r.up) {
    try { await msg.channel.send(gt("welcome.level_up", { uid: msg.author.id, lvl: r.lvl })); } catch {}
    const LEVEL_ROLES = { 5: "Active Player", 10: "Experienced", 25: "Veteran", 50: "Legend" };
    if (LEVEL_ROLES[r.lvl]) {
      try {
        const role = msg.guild.roles.cache.find(x => x.name === LEVEL_ROLES[r.lvl]);
        if (role) await msg.member.roles.add(role);
      } catch {}
    }
    achievements.trigger(client, msg.author.id, msg.guild.id).catch(() => {});
  }

  // Trust level recalculation — skip if manually overridden
  const member = db.getMem(msg.author.id);
  if (!member.trustOverride) {
    const res = trust.recalculate(msg.author.id);
    if (res.changed && res.to.id > res.from) {
      // Promotion: announce + assign role
      try {
        const lang = i18n.resolveLang(null, msg.guild.id);
        const fromName = i18n.t(`trust.levels.${trust.LEVELS[res.from].key}`, lang);
        const toName = i18n.t(`trust.levels.${res.to.key}`, lang);
        await msg.channel.send(i18n.t("trust.promoted", lang, {
          uid: msg.author.id, from: fromName, to: toName,
        })).catch(() => {});
        const role = msg.guild.roles.cache.find(r => r.name === res.to.roleName);
        if (role) await msg.member.roles.add(role).catch(() => {});
        // Strip lower trust-level roles to keep things tidy
        for (const lvl of trust.LEVELS) {
          if (lvl.id !== res.to.id && lvl.id > 0) {
            const r = msg.guild.roles.cache.find(rr => rr.name === lvl.roleName);
            if (r && msg.member.roles.cache.has(r.id)) {
              await msg.member.roles.remove(r).catch(() => {});
            }
          }
        }
      } catch {}
    }
  }

  // Automod
  const am = db.getAM();
  if (!am) return;
  const content = msg.content.toLowerCase();

  if (am.banned_words?.some(w => content.includes(w))) {
    try {
      await msg.delete();
      await msg.channel.send(gt("automod.triggered_banned", { uid: msg.author.id }))
        .then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
      await audit(msg.guild, `🛡️ AutoMod: ${msg.author.displayName} banned word`);
    } catch {}
    return;
  }

  if (msg.content.length > 10) {
    const capsCount = msg.content.replace(/[^A-Z]/g, "").length;
    const capsPct = (capsCount / msg.content.length) * 100;
    if (capsPct > (am.max_caps || 70)) {
      try {
        await msg.delete();
        await msg.channel.send(gt("automod.triggered_caps", { uid: msg.author.id }))
          .then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
      } catch {}
      return;
    }
  }

  if (msg.mentions.users.size + msg.mentions.roles.size > (am.max_mentions || 5)) {
    try {
      await msg.delete();
      await msg.channel.send(gt("automod.triggered_mentions", { uid: msg.author.id }))
        .then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
    } catch {}
  }
});

// ===== INTERACTIONS: route to handlers =====
client.on(EV.InteractionCreate, async (ix) => {
  try {
    if (ix.isChatInputCommand()) return await handleCommand(ix, client);
    if (ix.isButton())           return await handleButton(ix, client);
    if (ix.isModalSubmit())      return await handleModal(ix, client);
    if (ix.isAnySelectMenu?.() || ix.isStringSelectMenu() || ix.isUserSelectMenu?.()) {
      return await handleSelect(ix, client);
    }
  } catch (err) {
    logger.error("Interaction error:", err);
    const lang = i18n.langOf(ix);
    const reply = { content: i18n.t("common.error_generic", lang), ephemeral: true };
    if (ix.replied || ix.deferred) await ix.followUp(reply).catch(() => {});
    else await ix.reply(reply).catch(() => {});
  }
});

// ===== Process-level error handlers =====
process.on("unhandledRejection", e => logger.error("Unhandled rejection:", e?.message || e));
process.on("uncaughtException", e => {
  logger.error("Uncaught exception:", e?.message || e);
  if (e && ["ECONNRESET", "ENOTFOUND", "ETIMEDOUT"].includes(e.code)) {
    setTimeout(() => login(), 5000);
  }
});

async function login() {
  try {
    logger.info("Connecting...");
    await client.login(process.env.BOT_TOKEN);
  } catch (e) {
    logger.error("Connect failed:", e.message);
    setTimeout(() => login(), 10000);
  }
}

login();

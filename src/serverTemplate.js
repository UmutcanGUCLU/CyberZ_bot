// Single source of truth for the server's role/category/channel layout.
// Both /setup (first-time build) and /sync-server (idempotent repair) read from here.
// To add a new role/category/channel later, edit this file and run /sync-server.

const { db } = require("./db");

// Minimal role set: crew roles for staff operations + Verified for member gating.
// Non-crew ornamental roles (platform tags, trust tiers, job titles) were intentionally removed —
// if you reintroduce them, also update ROLE_CHOICES in commands.js and any panels that reference them.
const ROLES = [
  { name: "Developer",       color: 0x3498db },
  { name: "Lead Developer",  color: 0xf39c12 },
  { name: "Moderator",       color: 0xe74c3c },
  { name: "QA Tester",       color: 0x2ecc71 },
  { name: "Verified",        color: 0x2ecc71 },
];

// Categories: key is the internal slot used by channels below.
// `staffOnly: true`     → deny @everyone, allow bot + staff roles.
// `verifiedOnly: true`  → deny @everyone, allow bot + Verified + staff (view/connect/speak).
const CATEGORIES = [
  // Welcome stays open to @everyone — unverified members land here and see #verification.
  { key: "welcome",      name: "Welcome" },
  // Everything below is gated behind the Verified role.
  { key: "community",    name: "Community",     verifiedOnly: true },
  { key: "feedback",     name: "Game Feedback", verifiedOnly: true },
  { key: "support",      name: "Support",       verifiedOnly: true },
  { key: "beta",         name: "Beta Program",  verifiedOnly: true },
  { key: "playtogether", name: "Play Together", verifiedOnly: true },
  { key: "announce",     name: "Announcements", verifiedOnly: true },
  { key: "mgmt",         name: "Management",    staffOnly: true },
];

// Channels: `cat` points at a CATEGORIES.key.
// `cfgKey` (optional) — when set, the channel's id is written to that db cfg field.
// `panel`  (optional) — panel name used by /setup to post panels; sync-server ignores it.
// `type`   (optional) — "voice" for voice channels; defaults to text.
const CHANNELS = [
  // Verification is the single public-read channel an unverified member can see.
  // publicReadOnly: @everyone may view + read messages but cannot chat; staff and bot can post.
  { name: "verification",    cat: "welcome",   topic: "Accept rules",         cfgKey: "verifyCh",  panel: "verify",   publicReadOnly: true },
  // Welcome channel is gated — unverified members should only see #verification until they accept rules.
  { name: "welcome",         cat: "welcome",   topic: "New members",          cfgKey: "welCh",     verifiedOnly: true },
  { name: "general-chat",    cat: "community", topic: "General chat"                                                 },
  { name: "giveaways",       cat: "community", topic: "Giveaways",            cfgKey: "givCh"                        },
  { name: "polls",           cat: "community", topic: "Polls",                cfgKey: "pollCh"                       },
  { name: "bug-reports",     cat: "feedback",  topic: "Report bugs",          cfgKey: "bugCh",     panel: "bugs"     },
  { name: "suggestions",     cat: "feedback",  topic: "Suggestions",          cfgKey: "sugCh",     panel: "sugg"     },
  { name: "support-tickets", cat: "support",   topic: "Open ticket",          cfgKey: "tktCh",     panel: "ticket"   },
  { name: "beta-apply",      cat: "beta",      topic: "Beta applications",    cfgKey: "betaCh",    panel: "beta"     },
  { name: "looking-for-group", cat: "playtogether", topic: "Find teammates & coordinate play sessions"               },
  // Join-to-Create trigger. Users entering this VC get a new personal room spawned in the same category.
  { name: "➕ Create Room",   cat: "playtogether",                             cfgKey: "joinCreateCh", type: "voice"  },
  { name: "announcements",   cat: "announce",  topic: "Announcements",        cfgKey: "annCh"                        },
  { name: "patch-notes",     cat: "announce",  topic: "Patch notes",          cfgKey: "patchCh"                      },
  { name: "admin-panel",     cat: "mgmt",      topic: "Admin",                cfgKey: "adminCh",   panel: "admin"    },
  { name: "automod",         cat: "mgmt",      topic: "AutoMod",              cfgKey: "amCh",      panel: "automod"  },
  { name: "bot-log",         cat: "mgmt",      topic: "Logs",                 cfgKey: "logCh"                        },
  { name: "beta-key-mgmt",   cat: "mgmt",      topic: "Key management",       cfgKey: "betaAdm",   panel: "betamgmt" },
  { name: "beta-review",     cat: "mgmt",      topic: "Review applications",  cfgKey: "betaRev"                      },
];

// Cfg fields sourced from roles rather than channels.
const ROLE_CFG = {
  devRole:   "Developer",
  leadRole:  "Lead Developer",
  testRole:  "QA Tester",
};

/**
 * Ensure every role/category/channel in the template exists on the guild.
 * Idempotent: skips items that already exist, creates only what's missing.
 * Returns { rolesCreated, categoriesCreated, channelsCreated, roles, cats, channels }
 * so callers can render a summary or wire up db cfg / panels.
 */
async function ensureAll(guild, botUserId, { ChannelType }) {
  const rolesByName = {};
  const rolesCreated = [];
  for (const def of ROLES) {
    const existing = guild.roles.cache.find(r => r.name === def.name);
    if (existing) {
      rolesByName[def.name] = existing;
    } else {
      rolesByName[def.name] = await guild.roles.create({ name: def.name, color: def.color });
      rolesCreated.push(def.name);
    }
  }

  const catsByKey = {};
  const categoriesCreated = [];
  for (const def of CATEGORIES) {
    let cat = guild.channels.cache.find(
      ch => ch.name === def.name && ch.type === ChannelType.GuildCategory
    );
    if (!cat) {
      cat = await guild.channels.create({ name: def.name, type: ChannelType.GuildCategory });
      categoriesCreated.push(def.name);
    }
    catsByKey[def.key] = cat;

    if (def.staffOnly) {
      // Re-apply each time — rules may have changed, or the category may be fresh.
      const overwrites = [
        { id: guild.id, deny: ["ViewChannel"] },
        { id: botUserId, allow: ["ViewChannel"] },
      ];
      for (const staff of ["Developer", "Lead Developer", "Moderator"]) {
        const role = rolesByName[staff];
        if (role) overwrites.push({ id: role.id, allow: ["ViewChannel"] });
      }
      try { await cat.permissionOverwrites.set(overwrites); } catch {}
    }

    if (def.verifiedOnly) {
      // Hidden from @everyone; visible to Verified members and staff.
      // Bot needs ManageChannels + MoveMembers for Join-to-Create flows.
      const overwrites = [
        { id: guild.id,  deny: ["ViewChannel"] },
        { id: botUserId, allow: ["ViewChannel", "ManageChannels", "Connect", "Speak", "MoveMembers"] },
      ];
      const verified = rolesByName["Verified"];
      if (verified) overwrites.push({ id: verified.id, allow: ["ViewChannel", "Connect", "Speak"] });
      for (const staff of ["Developer", "Lead Developer", "Moderator"]) {
        const role = rolesByName[staff];
        if (role) overwrites.push({ id: role.id, allow: ["ViewChannel", "Connect", "Speak", "ManageChannels"] });
      }
      try { await cat.permissionOverwrites.set(overwrites); } catch {}
    }
  }

  const channelsByName = {};
  const channelsCreated = [];
  for (const def of CHANNELS) {
    const parent = catsByKey[def.cat];
    if (!parent) continue;
    const type = def.type === "voice" ? ChannelType.GuildVoice : ChannelType.GuildText;
    let ch = guild.channels.cache.find(
      c => c.name === def.name && c.parentId === parent.id && c.type === type
    );
    if (!ch) {
      const opts = { name: def.name, type, parent: parent.id };
      if (type === ChannelType.GuildText && def.topic) opts.topic = def.topic;
      ch = await guild.channels.create(opts);
      channelsCreated.push(def.name);
    }
    channelsByName[def.name] = ch;

    // Channel-level verifiedOnly: applied every run so existing channels get corrected too.
    if (def.verifiedOnly) {
      const overwrites = [
        { id: guild.id,  deny: ["ViewChannel"] },
        { id: botUserId, allow: ["ViewChannel", "ManageChannels"] },
      ];
      const verified = rolesByName["Verified"];
      if (verified) overwrites.push({ id: verified.id, allow: ["ViewChannel"] });
      for (const staff of ["Developer", "Lead Developer", "Moderator"]) {
        const role = rolesByName[staff];
        if (role) overwrites.push({ id: role.id, allow: ["ViewChannel"] });
      }
      try { await ch.permissionOverwrites.set(overwrites); } catch {}
    }

    // Channel-level publicReadOnly: @everyone can see and read message history, but cannot chat.
    // Used for #verification so unverified members can view the panel and click the button.
    if (def.publicReadOnly) {
      const overwrites = [
        {
          id: guild.id,
          allow: ["ViewChannel", "ReadMessageHistory"],
          deny:  ["SendMessages", "AddReactions", "CreatePublicThreads", "CreatePrivateThreads", "SendMessagesInThreads"],
        },
        { id: botUserId, allow: ["ViewChannel", "SendMessages", "ManageMessages", "ReadMessageHistory", "EmbedLinks"] },
      ];
      for (const staff of ["Developer", "Lead Developer", "Moderator"]) {
        const role = rolesByName[staff];
        if (role) overwrites.push({ id: role.id, allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"] });
      }
      try { await ch.permissionOverwrites.set(overwrites); } catch {}
    }
  }

  return {
    rolesCreated,
    categoriesCreated,
    channelsCreated,
    roles: rolesByName,
    cats: catsByKey,
    channels: channelsByName,
  };
}

/** Build the cfg payload for db.setCfg from ensureAll's result. */
function buildCfg({ channels, roles }) {
  const cfg = {};
  for (const def of CHANNELS) {
    if (def.cfgKey && channels[def.name]) cfg[def.cfgKey] = channels[def.name].id;
  }
  for (const [cfgKey, roleName] of Object.entries(ROLE_CFG)) {
    if (roles[roleName]) cfg[cfgKey] = roles[roleName].id;
  }
  return cfg;
}

/**
 * Destructive cleanup: delete roles/channels/categories that aren't part of the template.
 * Preserves:
 *   - @everyone and managed/integration roles (can't/shouldn't delete)
 *   - Ticket channels (ticket-<id>-<user>) referenced in db.tickets
 *   - Temp voice channels tracked in db.tempVcs
 *   - The "Tickets" category (created on-demand by ticket flow)
 * Empty off-template categories are deleted; non-empty ones are left so nothing orphans mid-run.
 * Returns { rolesDeleted, categoriesDeleted, channelsDeleted }.
 */
async function pruneExtras(guild, { ChannelType }) {
  const templateRoleNames = new Set(ROLES.map(r => r.name));
  const templateCatNames = new Set(CATEGORIES.map(c => c.name));
  // Dynamic categories created on-demand — never prune and never prune their children.
  const dynamicCatNames = new Set(["Tickets", "Bug Tickets"]);
  dynamicCatNames.forEach(n => templateCatNames.add(n));

  // Build lookup of template (channelName, parentId, type) so misplaced duplicates get cleaned too.
  const catIdByName = {};
  const dynamicCatIds = new Set();
  for (const cat of guild.channels.cache.values()) {
    if (cat.type === ChannelType.GuildCategory) {
      if (templateCatNames.has(cat.name)) catIdByName[cat.name] = cat.id;
      if (dynamicCatNames.has(cat.name)) dynamicCatIds.add(cat.id);
    }
  }
  const templateChannelKeys = new Set();
  for (const def of CHANNELS) {
    const catName = CATEGORIES.find(c => c.key === def.cat)?.name;
    const parentId = catName ? catIdByName[catName] : null;
    if (!parentId) continue;
    const type = def.type === "voice" ? ChannelType.GuildVoice : ChannelType.GuildText;
    templateChannelKeys.add(`${def.name}|${parentId}|${type}`);
  }

  // Dynamic channels we must NOT delete.
  const tempVcIds = new Set((db.getTempVcs?.() || []).map(v => v.chId));
  const ticketChIds = new Set((db.openTkts?.() || []).map(t => t.chId).filter(Boolean));

  const rolesDeleted = [];
  const categoriesDeleted = [];
  const channelsDeleted = [];

  for (const role of guild.roles.cache.values()) {
    if (role.id === guild.id) continue;
    if (role.managed) continue;
    if (templateRoleNames.has(role.name)) continue;
    try { await role.delete("sync-server cleanup"); rolesDeleted.push(role.name); } catch {}
  }

  for (const ch of guild.channels.cache.values()) {
    if (ch.type === ChannelType.GuildCategory) continue;
    if (tempVcIds.has(ch.id)) continue;
    if (ticketChIds.has(ch.id)) continue;
    // Anything inside a dynamic category (Tickets, Bug Tickets) is owned by its system — skip.
    if (ch.parentId && dynamicCatIds.has(ch.parentId)) continue;
    if (/^ticket-\d+-/.test(ch.name)) continue;
    const key = `${ch.name}|${ch.parentId}|${ch.type}`;
    if (templateChannelKeys.has(key)) continue;
    try { await ch.delete("sync-server cleanup"); channelsDeleted.push(ch.name); } catch {}
  }

  for (const cat of guild.channels.cache.values()) {
    if (cat.type !== ChannelType.GuildCategory) continue;
    if (templateCatNames.has(cat.name)) continue;
    if (cat.children?.cache?.size > 0) continue;
    try { await cat.delete("sync-server cleanup"); categoriesDeleted.push(cat.name); } catch {}
  }

  return { rolesDeleted, categoriesDeleted, channelsDeleted };
}

module.exports = {
  ROLES, CATEGORIES, CHANNELS, ROLE_CFG,
  ensureAll, buildCfg, pruneExtras,
};

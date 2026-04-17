// Single source of truth for the server's role/category/channel layout.
// Both /setup (first-time build) and /sync-server (idempotent repair) read from here.
// To add a new role/category/channel later, edit this file and run /sync-server.

const trust = require("./trust");

const ROLES = [
  { name: "Developer",       color: 0x3498db },
  { name: "3D Artist",       color: 0xe91e63 },
  { name: "Moderator",       color: 0xe74c3c },
  { name: "Lead Developer",  color: 0xf39c12 },
  { name: "QA Tester",       color: 0x2ecc71 },
  { name: "Sound Designer",  color: 0x9b59b6 },
  { name: "Game Designer",   color: 0x1abc9c },
  { name: "Active Player",   color: 0x11806a },
  { name: "Experienced",     color: 0x1f8b4c },
  { name: "Veteran",         color: 0xc27c0e },
  { name: "Legend",          color: 0xa84300 },
  { name: "PC Player",       color: 0x3498db },
  { name: "PS Player",       color: 0x2e4057 },
  { name: "Xbox Player",     color: 0x107c10 },
  { name: "Mobile Player",   color: 0xe67e22 },
  { name: "Beta Tester",     color: 0x9b59b6 },
  { name: "Verified",        color: 0x2ecc71 },
  ...trust.LEVELS.filter(l => l.id > 0).map(l => ({ name: l.roleName, color: l.color })),
];

// Categories: key is the internal slot used by channels below.
// `staffOnly: true`     → deny @everyone, allow bot + staff roles.
// `verifiedOnly: true`  → deny @everyone, allow bot + Verified + staff (view/connect/speak).
const CATEGORIES = [
  { key: "welcome",      name: "Welcome" },
  { key: "community",    name: "Community" },
  { key: "feedback",     name: "Game Feedback" },
  { key: "support",      name: "Support" },
  { key: "beta",         name: "Beta Program" },
  { key: "playtogether", name: "Play Together", verifiedOnly: true },
  { key: "announce",     name: "Announcements" },
  { key: "mgmt",         name: "Management", staffOnly: true },
];

// Channels: `cat` points at a CATEGORIES.key.
// `cfgKey` (optional) — when set, the channel's id is written to that db cfg field.
// `panel`  (optional) — panel name used by /setup to post panels; sync-server ignores it.
// `type`   (optional) — "voice" for voice channels; defaults to text.
const CHANNELS = [
  { name: "verification",    cat: "welcome",   topic: "Accept rules",         cfgKey: "verifyCh",  panel: "verify"   },
  { name: "welcome",         cat: "welcome",   topic: "New members",          cfgKey: "welCh"                        },
  { name: "general-chat",    cat: "community", topic: "General chat"                                                 },
  { name: "platform-select", cat: "community", topic: "Choose platform",                          panel: "platform" },
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

module.exports = {
  ROLES, CATEGORIES, CHANNELS, ROLE_CFG,
  ensureAll, buildCfg,
};

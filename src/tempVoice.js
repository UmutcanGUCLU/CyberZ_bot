// Join-to-Create temp voice channels.
// When a user enters the trigger VC, bot spawns a new voice channel in the
// same category, moves the user in, and deletes it the instant it becomes empty.
// Only channels tracked in db.tempVcs are ever deleted by this module.

const { ChannelType, PermissionsBitField } = require("discord.js");
const { db } = require("./db");
const logger = require("./logger");

// ===== Tunables =====
const ROOM_NAME = (displayName) => `${displayName}'s Room`;
// Env override takes priority over cfg.joinCreateCh — useful for local testing.
const JOIN_TO_CREATE_ID = process.env.JOIN_TO_CREATE_ID || null;
// Perms granted to the creator on their own room.
const OWNER_PERMS = [
  PermissionsBitField.Flags.ManageChannels,
  PermissionsBitField.Flags.MoveMembers,
  PermissionsBitField.Flags.MuteMembers,
  PermissionsBitField.Flags.DeafenMembers,
];

function getTriggerId(guildId) {
  if (JOIN_TO_CREATE_ID) return JOIN_TO_CREATE_ID;
  const cfg = db.getCfg(guildId);
  return cfg?.joinCreateCh || null;
}

/**
 * Event handler: pass the VoiceStateUpdate payload through.
 * Discord guarantees oldState and newState are the same guild.
 */
async function handleVoiceStateUpdate(oldState, newState) {
  const guild = newState.guild || oldState.guild;
  if (!guild) return;

  await maybeCreateRoom(guild, oldState, newState);
  await maybeDeleteIfEmpty(guild, oldState, newState);
}

async function maybeCreateRoom(guild, oldState, newState) {
  const triggerId = getTriggerId(guild.id);
  if (!triggerId) return;
  // User must have just arrived at the trigger channel.
  if (newState.channelId !== triggerId) return;
  if (oldState.channelId === triggerId) return;

  const member = newState.member;
  if (!member || member.user.bot) return;

  try {
    const trigger = guild.channels.cache.get(triggerId);
    if (!trigger) return;

    const room = await guild.channels.create({
      name: ROOM_NAME(member.displayName || member.user.username),
      type: ChannelType.GuildVoice,
      parent: trigger.parentId, // inherit category perms (Verified-only, etc.)
      reason: `Join-to-Create for ${member.user.tag}`,
      permissionOverwrites: [
        { id: member.id, allow: OWNER_PERMS },
      ],
    });
    db.addTempVc(room.id, member.id);

    try {
      await member.voice.setChannel(room);
    } catch (e) {
      // Member may have disconnected before we could move them — that's fine,
      // maybeDeleteIfEmpty will clean up the orphan on the next state update,
      // or restoreAll will sweep it on next boot.
      logger.warn(`Temp VC: move failed for ${member.user.tag}: ${e.message}`);
    }
  } catch (e) {
    logger.error("Temp VC: create failed:", e.message);
  }
}

async function maybeDeleteIfEmpty(guild, oldState, newState) {
  // Only react when the user left a channel (different from the new one, or none).
  const leftId = oldState.channelId;
  if (!leftId || leftId === newState.channelId) return;
  if (!db.isTempVc(leftId)) return;

  const ch = guild.channels.cache.get(leftId);
  if (!ch) {
    // Channel already gone (manually deleted, etc.) — clean up our record.
    db.rmTempVc(leftId);
    return;
  }
  if (ch.members.size > 0) return;

  try {
    await ch.delete("Temp VC empty");
  } catch (e) {
    logger.warn(`Temp VC: delete failed for ${leftId}: ${e.message}`);
  }
  db.rmTempVc(leftId);
}

/**
 * Boot-time sweep:
 *  - Drop tracking for channels that no longer exist (manual deletes, crashes)
 *  - Delete any tracked channels that are empty right now
 * Called from bot.js ClientReady. Returns count of cleanups.
 */
async function restoreAll(client) {
  const rooms = db.getTempVcs();
  let cleaned = 0;
  for (const room of rooms) {
    let ch = null;
    for (const [, guild] of client.guilds.cache) {
      ch = guild.channels.cache.get(room.chId);
      if (ch) break;
    }
    if (!ch) {
      db.rmTempVc(room.chId);
      cleaned++;
      continue;
    }
    if (ch.members.size === 0) {
      try { await ch.delete("Temp VC empty (boot sweep)"); } catch {}
      db.rmTempVc(room.chId);
      cleaned++;
    }
  }
  return cleaned;
}

module.exports = { handleVoiceStateUpdate, restoreAll, JOIN_TO_CREATE_ID };

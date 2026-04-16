// Permission helpers — centralizes dev/mod checks
const { PermissionsBitField } = require("discord.js");

const DEV_ROLE_NAMES = ["Developer", "Lead Developer", "Moderator", "QA Tester"];

/**
 * True if the member is an Administrator OR has any dev/mod role by name.
 * Works on any interaction where `member` is the GuildMember object.
 */
function isDevOrMod(member) {
  if (!member) return false;
  if (member.permissions?.has?.(PermissionsBitField.Flags.Administrator)) return true;
  if (!member.roles?.cache) return false;
  return member.roles.cache.some(r => DEV_ROLE_NAMES.includes(r.name));
}

function isAdmin(member) {
  return !!member?.permissions?.has?.(PermissionsBitField.Flags.Administrator);
}

module.exports = { isDevOrMod, isAdmin, DEV_ROLE_NAMES };

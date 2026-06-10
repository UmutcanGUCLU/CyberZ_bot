const { AttachmentBuilder, EmbedBuilder } = require("discord.js");
const { db } = require("./db");
const logger = require("./logger");
const i18n = require("./i18n");

async function sendTicketTranscript(ix, tkt, client) {
  try {
    const channel = ix.channel;
    if (!channel) return;

    // Fetch up to 100 messages from the channel
    let messages = [];
    try {
      const fetched = await channel.messages.fetch({ limit: 100 });
      if (fetched && typeof fetched.values === "function") {
        messages = [...fetched.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);
      }
    } catch (fetchErr) {
      logger.warn(`Failed to fetch messages for transcript: ${fetchErr.message}`);
    }

    const lang = i18n.resolveLang(null, ix.guildId);
    const catLabel = i18n.t(`ticket.categories.${tkt.cat}`, lang);
    const createdBy = tkt.name || "Unknown";
    const closedBy = ix.user.displayName || ix.user.username;
    const closedAt = new Date().toISOString().replace("T", " ").slice(0, 19);

    let txt = `==================================================\n`;
    txt += `TICKET TRANSCRIPT: ${tkt.tag}\n`;
    txt += `Category: ${catLabel || tkt.cat}\n`;
    txt += `Description: ${tkt.desc || ""}\n`;
    txt += `Created by: ${createdBy} (ID: ${tkt.uid})\n`;
    txt += `Closed by: ${closedBy} (ID: ${ix.user.id})\n`;
    txt += `Closed at: ${closedAt}\n`;
    txt += `==================================================\n\n`;

    for (const msg of messages) {
      const time = new Date(msg.createdTimestamp).toISOString().replace("T", " ").slice(0, 19);
      const author = msg.author?.tag || "Unknown User";
      let content = msg.content || "";
      if (msg.embeds?.length) {
        content += " [Embed: " + msg.embeds.map(e => e.title || e.description || "").join(" | ") + "]";
      }
      if (msg.attachments?.size) {
        content += " [Attachments: " + msg.attachments.map(a => a.url).join(", ") + "]";
      }
      txt += `[${time}] ${author}: ${content}\n`;
    }

    const buffer = Buffer.from(txt, "utf-8");
    const attachment = new AttachmentBuilder(buffer, { name: `transcript-${tkt.tag}.txt` });

    // 1. Send to the ticket creator via DM
    try {
      const creator = await client.users.fetch(tkt.uid);
      if (creator) {
        const dmEmbed = new EmbedBuilder()
          .setColor(0x3498db)
          .setTitle(i18n.t("ticket.closed_title", lang, { tag: tkt.tag }))
          .setDescription(i18n.t("ticket.transcript_dm_desc", lang, { tag: tkt.tag, closedBy }))
          .setTimestamp();
        await creator.send({ embeds: [dmEmbed], files: [attachment] });
      }
    } catch (dmErr) {
      logger.warn(`Failed to send transcript DM to user ${tkt.uid}: ${dmErr.message}`);
    }

    // 2. Send to the bot-log channel (audit)
    const cfg = db.getCfg(ix.guildId);
    if (cfg?.logCh) {
      const logChannel = ix.guild.channels.cache.get(cfg.logCh);
      if (logChannel) {
        await logChannel.send({
          content: `📜 **Transcript generated for ticket ${tkt.tag}**`,
          files: [attachment]
        });
      }
    }
  } catch (err) {
    logger.error("Transcript generation failed:", err.message);
  }
}

module.exports = { sendTicketTranscript };

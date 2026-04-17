// Slash command definitions
const { SlashCommandBuilder: SC } = require("discord.js");

const ROLE_CHOICES = [
  { name: "Developer",      value: "Developer" },
  { name: "3D Artist",      value: "3D Artist" },
  { name: "Moderator",      value: "Moderator" },
  { name: "Lead Developer", value: "Lead Developer" },
  { name: "QA Tester",      value: "QA Tester" },
  { name: "Sound Designer", value: "Sound Designer" },
  { name: "Game Designer",  value: "Game Designer" },
];

const commands = [
  // --- Admin setup / panel placement ---
  new SC().setName("setup").setDescription("Setup server (channels + roles + panels)").setDefaultMemberPermissions(0),
  new SC().setName("sync-server").setDescription("Add missing channels/roles from template / Eksik kanal-rolleri ekle").setDefaultMemberPermissions(0),
  new SC().setName("reset").setDescription("Delete all bot channels and categories").setDefaultMemberPermissions(0),
  new SC().setName("bug-panel").setDescription("Place bug panel / Bug panelini yerleştir").setDefaultMemberPermissions(0),
  new SC().setName("admin-panel").setDescription("Place admin panel").setDefaultMemberPermissions(0),
  new SC().setName("ticket-panel").setDescription("Place ticket panel").setDefaultMemberPermissions(0),
  new SC().setName("sugg-panel").setDescription("Place suggestion panel").setDefaultMemberPermissions(0),
  new SC().setName("beta-panel").setDescription("Place beta panel").setDefaultMemberPermissions(0),
  new SC().setName("beta-admin").setDescription("Place beta key mgmt panel").setDefaultMemberPermissions(0),
  new SC().setName("verify-panel").setDescription("Place verification panel").setDefaultMemberPermissions(0),
  new SC().setName("reaction-roles").setDescription("Place platform select panel").setDefaultMemberPermissions(0),
  new SC().setName("automod-panel").setDescription("Place automod panel").setDefaultMemberPermissions(0),

  // --- Bug tracker ---
  new SC().setName("bug").setDescription("View bug")
    .addIntegerOption(o => o.setName("id").setDescription("Bug ID").setRequired(true)),
  new SC().setName("bugs").setDescription("List bugs")
    .addStringOption(o => o.setName("filter").setDescription("Status").addChoices(
      { name: "Active", value: "all" },
      { name: "Open", value: "open" },
      { name: "In Progress", value: "in-progress" },
      { name: "Resolved", value: "resolved" },
      { name: "Closed", value: "closed" }
    )),
  new SC().setName("bug-assign").setDescription("Assign bug")
    .addIntegerOption(o => o.setName("id").setDescription("ID").setRequired(true))
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),
  new SC().setName("bug-search").setDescription("Search bugs")
    .addStringOption(o => o.setName("query").setDescription("Query").setRequired(true)),
  new SC().setName("dashboard").setDescription("Bug dashboard"),
  new SC().setName("stats").setDescription("Statistics"),
  new SC().setName("my-bugs").setDescription("Bugs assigned to me"),

  // --- Profile / leveling ---
  new SC().setName("profile").setDescription("Player profile")
    .addUserOption(o => o.setName("user").setDescription("User")),
  new SC().setName("leaderboard").setDescription("Top players"),

  // --- Developer management ---
  new SC().setName("dev-register").setDescription("Register as developer")
    .addStringOption(o => o.setName("specialty").setDescription("Specialty").setRequired(true).addChoices(
      { name: "Gameplay", value: "gameplay" },
      { name: "Graphics", value: "graphics" },
      { name: "Audio", value: "audio" },
      { name: "Network", value: "network" },
      { name: "UI/UX", value: "ui" },
      { name: "AI", value: "ai" },
      { name: "QA", value: "qa" },
      { name: "General", value: "general" }
    ))
    .addStringOption(o => o.setName("role").setDescription("Role").addChoices(
      { name: "Developer", value: "developer" },
      { name: "Lead", value: "lead" },
      { name: "Tester", value: "tester" }
    )),
  new SC().setName("dev-list").setDescription("Developer list"),

  // --- Role management ---
  new SC().setName("role-give").setDescription("Give role").setDefaultMemberPermissions(0)
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addStringOption(o => o.setName("role").setDescription("Role").setRequired(true).addChoices(...ROLE_CHOICES)),
  new SC().setName("role-remove").setDescription("Remove role").setDefaultMemberPermissions(0)
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addStringOption(o => o.setName("role").setDescription("Role").setRequired(true).addChoices(...ROLE_CHOICES)),

  // --- Moderation ---
  new SC().setName("warn").setDescription("Warn user").setDefaultMemberPermissions(0)
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)),
  new SC().setName("warnings").setDescription("View warnings")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),
  new SC().setName("note").setDescription("Add note").setDefaultMemberPermissions(0)
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addStringOption(o => o.setName("text").setDescription("Note").setRequired(true)),
  new SC().setName("notes").setDescription("View notes")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),

  // --- Tickets ---
  new SC().setName("ticket-close").setDescription("Close ticket")
    .addStringOption(o => o.setName("reason").setDescription("Reason")),

  // --- Suggestions ---
  new SC().setName("sugg-respond").setDescription("Respond to suggestion").setDefaultMemberPermissions(0)
    .addIntegerOption(o => o.setName("id").setDescription("ID").setRequired(true))
    .addStringOption(o => o.setName("status").setDescription("Status").setRequired(true).addChoices(
      { name: "Approved", value: "approved" },
      { name: "Planned", value: "planned" },
      { name: "Rejected", value: "rejected" },
      { name: "Done", value: "done" }
    ))
    .addStringOption(o => o.setName("response").setDescription("Response").setRequired(true)),

  // --- Announcements ---
  new SC().setName("announce").setDescription("Make announcement").setDefaultMemberPermissions(0)
    .addStringOption(o => o.setName("title").setDescription("Title").setRequired(true))
    .addStringOption(o => o.setName("content").setDescription("Content").setRequired(true))
    .addStringOption(o => o.setName("type").setDescription("Type").setRequired(true).addChoices(
      { name: "Announcement", value: "general" },
      { name: "Update", value: "update" },
      { name: "Patch Notes", value: "patchnote" },
      { name: "Event", value: "event" },
      { name: "Important", value: "important" }
    ))
    .addBooleanOption(o => o.setName("ping").setDescription("@everyone?"))
    .addStringOption(o => o.setName("version").setDescription("Version tag (for patch notes) / Versiyon etiketi")),

  // --- Patch Notes Archive ---
  new SC().setName("patch-notes").setDescription("Browse past patch notes / Geçmiş yama notları")
    .addStringOption(o => o.setName("search").setDescription("Search / Ara")),

  // --- Q&A Sessions ---
  new SC().setName("qa-ac").setDescription("Open Q&A session / Q&A oturumu aç").setDefaultMemberPermissions(0)
    .addStringOption(o => o.setName("tema").setDescription("Topic / Konu").setRequired(true)),
  new SC().setName("qa-kapat").setDescription("Close Q&A session / Q&A oturumu kapat").setDefaultMemberPermissions(0),
  new SC().setName("qa-liste").setDescription("Top questions / En çok oy alan sorular"),
  new SC().setName("qa-soru").setDescription("Submit a question / Soru gönder"),

  // --- Giveaway ---
  new SC().setName("giveaway").setDescription("Start giveaway").setDefaultMemberPermissions(0)
    .addStringOption(o => o.setName("prize").setDescription("Prize").setRequired(true))
    .addIntegerOption(o => o.setName("duration").setDescription("Duration (minutes)").setRequired(true))
    .addIntegerOption(o => o.setName("winners").setDescription("Winners")),
  new SC().setName("giveaway-end").setDescription("End giveaway").setDefaultMemberPermissions(0)
    .addIntegerOption(o => o.setName("id").setDescription("ID").setRequired(true)),

  // --- Poll ---
  new SC().setName("poll").setDescription("Create poll").setDefaultMemberPermissions(0)
    .addStringOption(o => o.setName("question").setDescription("Question").setRequired(true))
    .addStringOption(o => o.setName("options").setDescription("Comma separated: A,B,C").setRequired(true))
    .addIntegerOption(o => o.setName("duration").setDescription("Duration (minutes)")),
  new SC().setName("poll-end").setDescription("End poll").setDefaultMemberPermissions(0)
    .addIntegerOption(o => o.setName("id").setDescription("ID").setRequired(true)),

  // --- Beta program ---
  new SC().setName("beta-addkeys").setDescription("Add keys").setDefaultMemberPermissions(0)
    .addStringOption(o => o.setName("keys").setDescription("KEY1,KEY2").setRequired(true)),
  new SC().setName("beta-pool").setDescription("Key pool status").setDefaultMemberPermissions(0),
  new SC().setName("beta-pending").setDescription("Pending applications").setDefaultMemberPermissions(0),
  new SC().setName("beta-used").setDescription("Distributed keys").setDefaultMemberPermissions(0),

  // --- Language ---
  new SC().setName("dil").setDescription("Change bot language / Bot dilini değiştir"),
  new SC().setName("language").setDescription("Change bot language / Bot dilini değiştir"),

  // --- Main control panel (UI hub) ---
  new SC().setName("panel").setDescription("Main control panel / Ana kontrol paneli"),
  new SC().setName("panel-place").setDescription("Place persistent control panel in this channel / Paneli bu kanala yerleştir").setDefaultMemberPermissions(0),

  // --- Help ---
  new SC().setName("yardim").setDescription("Command list and bot guide / Komut rehberi"),
  new SC().setName("help").setDescription("Command list and bot guide / Komut rehberi"),

  // --- Trust levels ---
  new SC().setName("trust-check").setDescription("View trust level / Güven seviyesini görüntüle")
    .addUserOption(o => o.setName("user").setDescription("User / Kullanıcı")),
  new SC().setName("trust-set").setDescription("Set trust level / Güven seviyesini ayarla").setDefaultMemberPermissions(0)
    .addUserOption(o => o.setName("user").setDescription("User / Kullanıcı").setRequired(true))
    .addIntegerOption(o => o.setName("level").setDescription("0-4").setRequired(true).setMinValue(0).setMaxValue(4)),
  new SC().setName("trust-clear").setDescription("Clear manual override / Manuel override kaldır").setDefaultMemberPermissions(0)
    .addUserOption(o => o.setName("user").setDescription("User / Kullanıcı").setRequired(true)),

  // --- Triage (dev queue) ---
  new SC().setName("triage").setDescription("Dev triage queue — unassigned bugs / Atanmamış bug kuyruğu"),

  // --- FAQ ---
  new SC().setName("sss").setDescription("Frequently asked questions / Sık Sorulan Sorular"),
  new SC().setName("faq").setDescription("Frequently asked questions / Sık Sorulan Sorular"),
  new SC().setName("sss-ekle").setDescription("Add FAQ entry / SSS ekle").setDefaultMemberPermissions(0)
    .addStringOption(o => o.setName("soru").setDescription("Question / Soru").setRequired(true))
    .addStringOption(o => o.setName("cevap").setDescription("Answer / Cevap").setRequired(true))
    .addStringOption(o => o.setName("kategori").setDescription("Category / Kategori").addChoices(
      { name: "Genel / General", value: "general" },
      { name: "Oynanış / Gameplay", value: "gameplay" },
      { name: "Teknik / Technical", value: "technical" },
      { name: "Hesap / Account", value: "account" },
      { name: "Ödeme / Payment", value: "payment" },
      { name: "Beta", value: "beta" },
    )),
  new SC().setName("sss-sil").setDescription("Remove FAQ / SSS sil").setDefaultMemberPermissions(0)
    .addIntegerOption(o => o.setName("id").setDescription("FAQ ID").setRequired(true)),

  // --- Known Issues ---
  new SC().setName("mark-known").setDescription("Mark bug as known issue / Hatayı bilinen olarak işaretle").setDefaultMemberPermissions(0)
    .addIntegerOption(o => o.setName("id").setDescription("Bug ID").setRequired(true))
    .addStringOption(o => o.setName("workaround").setDescription("Workaround / Geçici çözüm")),
  new SC().setName("unmark-known").setDescription("Unmark bug as known / Bilinen işaretini kaldır").setDefaultMemberPermissions(0)
    .addIntegerOption(o => o.setName("id").setDescription("Bug ID").setRequired(true)),
  new SC().setName("known-issues").setDescription("View known issues / Bilinen sorunları görüntüle"),

  // --- Achievements ---
  new SC().setName("rozetler").setDescription("View badges / Rozetleri görüntüle")
    .addUserOption(o => o.setName("user").setDescription("User / Kullanıcı")),
  new SC().setName("achievements").setDescription("View badges / Rozetleri görüntüle")
    .addUserOption(o => o.setName("user").setDescription("User / Kullanıcı")),

  // --- Automod ---
  new SC().setName("automod-word").setDescription("Manage banned words").setDefaultMemberPermissions(0)
    .addStringOption(o => o.setName("action").setDescription("Action").setRequired(true).addChoices(
      { name: "Add", value: "add" },
      { name: "Remove", value: "remove" }
    ))
    .addStringOption(o => o.setName("word").setDescription("Word").setRequired(true)),
];

module.exports = { commands };

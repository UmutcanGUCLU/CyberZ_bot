// End-to-end flow simulation — builds mock interactions and runs
// through real handlers to catch integration bugs that the syntax checks miss.
const fs = require("fs");
const path = require("path");
// DB lives in src/ (db.js uses __dirname relative paths)
const DB = path.join(__dirname, "src", "data.json");
const BKP = DB + ".real-backup";
if (fs.existsSync(DB)) fs.copyFileSync(DB, BKP);
if (fs.existsSync(DB)) fs.unlinkSync(DB);

const { db } = require("./src/db");

let pass = 0, fail = 0;
function t(name, fn) {
  Promise.resolve()
    .then(() => fn())
    .then(() => { console.log("  ✓", name); pass++; })
    .catch(e => { console.error("  ✗", name, "→", e.message, e.stack?.split("\n")[1] || ""); fail++; });
}

// Build a minimal mock interaction
function mockIx(overrides = {}) {
  const replies = [];
  const updates = [];
  const followups = [];
  const ix = {
    user: { id: "user1", displayName: "Tester", username: "tester", displayAvatarURL: () => "https://example.com/a.png" },
    member: {
      permissions: { has: () => true },
      roles: { cache: { some: () => false, has: () => false, add: async () => {} }, add: async () => {}, remove: async () => {} },
      id: "user1",
      displayName: "Tester",
    },
    guild: {
      id: "guild1",
      name: "Test Guild",
      channels: { cache: { get: () => null, find: () => null, filter: () => new Map() } },
      roles: { cache: { find: () => null }, create: async () => ({ id: "role-new", name: "NewRole" }) },
      members: { fetch: async () => ({ roles: { add: async () => {} } }) },
      invites: { fetch: async () => new Map() },
      memberCount: 100,
      iconURL: () => null,
    },
    guildId: "guild1",
    channel: {
      id: "ch1",
      send: async (opts) => { replies.push({ kind: "channel.send", opts }); return { id: "msg-new", startThread: async () => ({ id: "thread", send: async () => {} }) }; },
      messages: { fetch: async () => null },
      threads: { create: async () => ({ id: "thread", send: async () => {} }) },
    },
    channelId: "ch1",
    commandName: "",
    customId: "",
    options: {
      getString: (k) => overrides.stringOpts?.[k] ?? null,
      getInteger: (k) => overrides.intOpts?.[k] ?? null,
      getUser: (k) => overrides.userOpts?.[k] ?? null,
      getBoolean: (k) => overrides.boolOpts?.[k] ?? null,
    },
    fields: { getTextInputValue: (k) => overrides.fieldValues?.[k] ?? "" },
    values: overrides.values || [],
    replied: false, deferred: false,
    reply: async (opts) => { replies.push({ kind: "reply", opts }); ix.replied = true; return {}; },
    deferReply: async () => { ix.deferred = true; },
    editReply: async (opts) => { replies.push({ kind: "editReply", opts }); return {}; },
    followUp: async (opts) => { followups.push({ kind: "followUp", opts }); return {}; },
    update: async (opts) => { updates.push({ kind: "update", opts }); return {}; },
    deferUpdate: async () => {},
    showModal: async (m) => { replies.push({ kind: "showModal", modal: m }); return {}; },
    isChatInputCommand: () => false,
    isButton: () => false,
    isModalSubmit: () => false,
    isStringSelectMenu: () => false,
    isUserSelectMenu: () => false,
    isAnySelectMenu: () => false,
    ...overrides,
  };
  ix._replies = replies;
  ix._updates = updates;
  ix._followups = followups;
  return ix;
}

const mockClient = {
  user: { id: "bot", tag: "bot#0001" },
  users: { fetch: async () => ({ send: async () => {}, username: "u", displayName: "u" }) },
  guilds: { cache: { get: () => null, first: () => null } },
};

const { handleCommand } = require("./src/interactions/commands");
const { handleButton } = require("./src/interactions/buttons");
const { handleModal } = require("./src/interactions/modals");
const { handleSelect } = require("./src/interactions/selects");

// Test helper that runs a handler and asserts something happens
async function runAndCheck(name, handlerFn, ix, assertFn) {
  try {
    await handlerFn(ix, mockClient);
    assertFn(ix);
    console.log("  ✓", name);
    pass++;
  } catch (e) {
    console.error("  ✗", name, "→", e.message);
    fail++;
  }
}

async function main() {
  const diagBefore = (label) => console.log(`  [diag after ${label}] bugs:`, db.bugsActive().length);

  console.log("\n=== /yardim command ===");
  {
    const ix = mockIx({ commandName: "yardim" });
    await runAndCheck("shows help panel with dropdown", handleCommand, ix, (ix) => {
      if (!ix._replies.length) throw new Error("no reply sent");
      const r = ix._replies[0];
      if (!r.opts.components?.length) throw new Error("no components");
    });
  }

  console.log("\n=== /dil language selector ===");
  {
    const ix = mockIx({ commandName: "dil" });
    await runAndCheck("shows TR/EN buttons", handleCommand, ix, (ix) => {
      const r = ix._replies[0];
      if (!r.opts.components?.length) throw new Error("no components");
    });
  }

  console.log("\n=== /rozetler ===");
  {
    const ix = mockIx({ commandName: "rozetler" });
    await runAndCheck("shows achievement panel", handleCommand, ix, (ix) => {
      const r = ix._replies[0];
      if (!r.opts.embeds?.length) throw new Error("no embed");
    });
  }

  console.log("\n=== /known-issues (empty) ===");
  {
    const ix = mockIx({ commandName: "known-issues" });
    await runAndCheck("handles empty known list gracefully", handleCommand, ix, (ix) => {
      const r = ix._replies[0];
      if (!r.opts.embeds?.length) throw new Error("no embed");
    });
  }

  console.log("\n=== /triage (empty, as admin) ===");
  {
    const ix = mockIx({ commandName: "triage" });
    await runAndCheck("empty queue shows congrats", handleCommand, ix, (ix) => {
      const r = ix._replies[0];
      if (!r.opts.embeds?.length) throw new Error("no embed");
    });
  }

  console.log("\n=== /triage (non-dev user) ===");
  {
    const ix = mockIx({
      commandName: "triage",
      member: {
        permissions: { has: () => false },
        roles: { cache: { some: () => false } },
      },
    });
    await runAndCheck("non-dev gets dev_only message", handleCommand, ix, (ix) => {
      const r = ix._replies[0];
      if (!r.opts.content?.includes("🛡️")) throw new Error("not the dev_only message");
    });
  }

  console.log("\n=== /sss (FAQ empty) ===");
  {
    const ix = mockIx({ commandName: "sss" });
    await runAndCheck("empty FAQ shows empty message", handleCommand, ix, (ix) => {
      const r = ix._replies[0];
      if (!r.opts.embeds?.length) throw new Error("no embed");
    });
  }

  console.log("\n=== /sss-ekle + /sss again ===");
  {
    const addIx = mockIx({
      commandName: "sss-ekle",
      stringOpts: { soru: "Q1", cevap: "A1", kategori: "general" },
    });
    await runAndCheck("adding FAQ works", handleCommand, addIx, (ix) => {
      const r = ix._replies[0];
      if (!r?.opts.content?.match(/#\d+/)) throw new Error("no add confirmation; got: " + JSON.stringify(r));
    });

    const listIx = mockIx({ commandName: "sss" });
    await runAndCheck("FAQ panel shows with dropdown after add", handleCommand, listIx, (ix) => {
      const r = ix._replies[0];
      if (!r.opts.components?.length) throw new Error("no dropdown");
    });
  }

  console.log("\n=== new bug (no duplicates) ===");
  {
    console.log("  [diag] bugs in DB at this point:", db.bugsActive().length);
    const ix = mockIx({
      customId: "m_bug",
      fieldValues: { t: "Totally unique bug title", d: "desc", s: "", v: "high", p: "pc" },
    });
    await runAndCheck("creates bug directly when no similar exists", handleModal, ix, (ix) => {
      // Should have either reply (success with tag) or showModal
      const hasReply = ix._replies.some(r => r.kind === "reply" && r.opts.content?.match(/GAME-\d+/));
      if (!hasReply) throw new Error("no create confirmation; got: " + JSON.stringify(ix._replies.map(r => ({ k: r.kind, opts: r.opts }))));
    });
  }

  console.log("\n=== new bug (duplicate detection) ===");
  {
    // Now the DB has a bug — submitting similar should trigger duplicate UI
    const ix = mockIx({
      customId: "m_bug",
      user: { id: "user2", displayName: "Tester2" },  // different user to bypass rate limit
      fieldValues: { t: "Totally unique bug title again", d: "desc", s: "", v: "high", p: "pc" },
    });
    await runAndCheck("duplicate flow shown for similar title", handleModal, ix, (ix) => {
      const r = ix._replies[0];
      if (!r.opts.embeds?.length) throw new Error("no duplicate UI");
      // Should have embeds + components (vote buttons + create-new/cancel)
      if (!r.opts.components?.length) throw new Error("no dup action buttons");
    });
  }

  console.log("\n=== /mark-known as admin ===");
  {
    // Use the bug created above (id 1)
    const ix = mockIx({
      commandName: "mark-known",
      intOpts: { id: 1 },
      stringOpts: { workaround: "Restart the game" },
    });
    await runAndCheck("admin can mark known via command", handleCommand, ix, (ix) => {
      if (!ix._replies[0]?.opts.content?.includes("işaretlend") && !ix._replies[0]?.opts.content?.includes("marked")) {
        throw new Error("no mark confirmation");
      }
    });
    if (!db.getBug(1)?.known) { console.error("  ✗ DB not updated"); fail++; }
    else { console.log("  ✓ DB reflects known=true"); pass++; }
  }

  console.log("\n=== Mark Known via button (dev UI) ===");
  {
    // First unmark it
    db.unmarkKnown(1, "test");
    const ix = mockIx({ customId: "mk_1" });
    await runAndCheck("mk_ button opens modal for workaround", handleButton, ix, (ix) => {
      if (!ix._replies.some(r => r.kind === "showModal")) throw new Error("no modal shown");
    });
  }

  console.log("\n=== Mark Known button for non-dev ===");
  {
    const ix = mockIx({
      customId: "mk_1",
      member: {
        permissions: { has: () => false },
        roles: { cache: { some: () => false } },
      },
    });
    await runAndCheck("non-dev blocked from mk_ button", handleButton, ix, (ix) => {
      const r = ix._replies[0];
      if (!r.opts.content?.includes("🛡️")) throw new Error("not dev_only");
    });
  }

  console.log("\n=== Assign button opens user picker ===");
  {
    const ix = mockIx({ customId: "asg_1" });
    await runAndCheck("asg_ button replies with UserSelect", handleButton, ix, (ix) => {
      const r = ix._replies[0];
      if (!r.opts.components?.length) throw new Error("no picker");
    });
  }

  console.log("\n=== Severity button opens severity picker ===");
  {
    const ix = mockIx({ customId: "sev_1" });
    await runAndCheck("sev_ button replies with StringSelect", handleButton, ix, (ix) => {
      const r = ix._replies[0];
      if (!r.opts.components?.length) throw new Error("no picker");
    });
  }

  console.log("\n=== Language button flow ===");
  {
    const ix = mockIx({ customId: "lang_en" });
    await runAndCheck("lang_en sets user lang to EN", handleButton, ix, (ix) => {
      if (!ix._updates[0]) throw new Error("no update reply");
    });
    if (db.getMemLang("user1") !== "en") { console.error("  ✗ user lang not EN"); fail++; }
    else { console.log("  ✓ user lang saved as EN"); pass++; }
  }

  console.log("\n=== /reset requires confirm ===");
  {
    const ix = mockIx({ commandName: "reset" });
    await runAndCheck("reset shows confirm dialog (not direct delete)", handleCommand, ix, (ix) => {
      const r = ix._replies[0];
      if (!r.opts.components?.length) throw new Error("no confirm buttons");
    });
  }

  console.log("\n=== Duplicate vote button ===");
  {
    // Give "voter" a duplicate vote
    const ix = mockIx({ customId: "dup_vote_1", user: { id: "voter5", displayName: "V" } });
    await runAndCheck("dup_vote button updates reply", handleButton, ix, (ix) => {
      if (!ix._updates[0]) throw new Error("no update");
    });
  }

  // Force any pending debounced saves to complete, then cleanup
  await new Promise(r => setTimeout(r, 600));

  console.log("\n=== SUMMARY ===");
  console.log(`Pass: ${pass} | Fail: ${fail}`);

  if (fs.existsSync(DB)) fs.unlinkSync(DB);
  if (fs.existsSync(BKP)) fs.renameSync(BKP, DB);
  if (fs.existsSync(DB + ".bak")) fs.unlinkSync(DB + ".bak");

  process.exit(fail > 0 ? 1 : 0);
}

main();

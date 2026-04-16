// Runtime test harness — verifies pure-function logic without Discord.
const fs = require("fs");
const path = require("path");
const DB = path.join(__dirname, "src", "data.json");
const BKP = DB + ".real-backup";

// Protect existing data.json
if (fs.existsSync(DB)) fs.copyFileSync(DB, BKP);
if (fs.existsSync(DB)) fs.unlinkSync(DB);

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); console.log("  ✓", name); pass++; }
  catch (e) { console.error("  ✗", name, "→", e.message); fail++; }
}
function assertEq(actual, expected, msg) {
  if (JSON.stringify(actual) !== JSON.stringify(expected))
    throw new Error((msg || "") + " expected " + JSON.stringify(expected) + " got " + JSON.stringify(actual));
}

console.log("\n=== i18n ===");
const i18n = require("./src/i18n");
t("t(tr) returns Turkish", () => {
  const v = i18n.t("common.not_found", "tr");
  if (v !== "Bulunamadı.") throw new Error("got: " + v);
});
t("t(en) returns English", () => {
  const v = i18n.t("common.not_found", "en");
  if (v !== "Not found.") throw new Error("got: " + v);
});
t("interpolation works", () => {
  const v = i18n.t("bug.created", "tr", { tag: "GAME-0042" });
  if (!v.includes("GAME-0042")) throw new Error("got: " + v);
});
t("missing key returns key itself", () => {
  const v = i18n.t("nonexistent.key", "tr");
  if (v !== "nonexistent.key") throw new Error("got: " + v);
});
t("invalid lang falls back to TR", () => {
  const v = i18n.t("common.not_found", "xx");
  if (v !== "Bulunamadı.") throw new Error("got: " + v);
});

console.log("\n=== pagination ===");
const { paginate } = require("./src/pagination");
t("empty list", () => {
  const r = paginate([], 1, 10);
  assertEq(r.total, 0);
  assertEq(r.totalPages, 1);
});
t("page 1 of many", () => {
  const arr = Array.from({ length: 25 }, (_, i) => i);
  const r = paginate(arr, 1, 10);
  assertEq(r.items.length, 10);
  assertEq(r.totalPages, 3);
  assertEq(r.hasPrev, false);
  assertEq(r.hasNext, true);
});
t("last page has remainder", () => {
  const arr = Array.from({ length: 25 }, (_, i) => i);
  const r = paginate(arr, 3, 10);
  assertEq(r.items.length, 5);
  assertEq(r.hasNext, false);
});
t("clamps out-of-range page", () => {
  const r = paginate([1, 2, 3], 99, 10);
  assertEq(r.page, 1);
});

console.log("\n=== rateLimit ===");
const rl = require("./src/rateLimit");
t("first call allowed", () => assertEq(rl.check("u1", "act", 5), 0));
t("second call blocked", () => {
  if (rl.check("u1", "act", 5) <= 0) throw new Error("should be blocked");
});
t("different user not blocked", () => assertEq(rl.check("u2", "act", 5), 0));
t("different action not blocked", () => assertEq(rl.check("u1", "other", 5), 0));

console.log("\n=== pendingBugs ===");
const pb = require("./src/pendingBugs");
t("put + take works", () => {
  pb.put("u1", { title: "x" });
  const d = pb.take("u1");
  if (d?.title !== "x") throw new Error("mismatch");
  assertEq(pb.take("u1"), null);
});
t("clear removes entry", () => {
  pb.put("u2", { title: "y" });
  pb.clear("u2");
  assertEq(pb.take("u2"), null);
});

console.log("\n=== db ===");
const { db } = require("./src/db");
t("mkBug defaults", () => {
  const b = db.mkBug({ title: "Test bug", desc: "d", sev: "high", uid: "u1", name: "U1" });
  assertEq(b.tag, "GAME-0001");
  assertEq(b.status, "open");
  assertEq(b.known, false);
  assertEq(b.plat, "all");
});
t("search: tag match scores highest", () => {
  db.mkBug({ title: "Render crash on map X", desc: "", sev: "medium", uid: "u1", name: "U1" });
  const results = db.search("game-0002");
  if (results.length === 0 || results[0].tag !== "GAME-0002")
    throw new Error("top: " + (results[0]?.tag || "none"));
});
t("search: title substring", () => {
  const r = db.search("render");
  if (!r.some(x => x.title.toLowerCase().includes("render"))) throw new Error("no match");
});
t("search: typo tolerance", () => {
  const r = db.search("renderr");
  if (!r.some(x => x.title.toLowerCase().includes("render"))) throw new Error("no fuzzy match");
});
t("search: empty returns empty", () => {
  assertEq(db.search(""), []);
  assertEq(db.search("   "), []);
});
t("markKnown + unmarkKnown roundtrip", () => {
  const b = db.mkBug({ title: "KT", desc: "", sev: "medium", uid: "u1", name: "U1" });
  const m = db.markKnown(b.id, "Restart game", "admin");
  assertEq(m.known, true);
  assertEq(m.workaround, "Restart game");
  const u = db.unmarkKnown(b.id, "admin");
  assertEq(u.known, false);
  assertEq(u.workaround, null);
});
t("setSeverity persists + history entry", () => {
  const b = db.mkBug({ title: "Sev", desc: "", sev: "low", uid: "u1", name: "U1" });
  const u = db.setSeverity(b.id, "critical", "admin");
  assertEq(u.sev, "critical");
  if (!db.getHist(b.id).some(h => h.act === "severity_changed"))
    throw new Error("no severity history entry");
});
t("bugsUnassigned filter correctness", () => {
  const list = db.bugsUnassigned();
  if (list.some(x => x.to !== null)) throw new Error("has assigned");
  if (list.some(x => x.status !== "open")) throw new Error("has non-open");
});
t("vote toggles", () => {
  const b = db.mkBug({ title: "V", desc: "", sev: "low", uid: "u1", name: "U1" });
  db.vote(b.id, "voter1");
  assertEq(db.getBug(b.id).votes.length, 1);
  db.vote(b.id, "voter1");
  assertEq(db.getBug(b.id).votes.length, 0);
});
t("FAQ roundtrip", () => {
  const f = db.mkFaq("Q?", "A", "general", "admin");
  if (!db.faqs("general").some(x => x.id === f.id)) throw new Error("not listed");
  db.rmFaq(f.id);
  assertEq(db.getFaq(f.id), null);
});
t("language preference storage", () => {
  db.setMemLang("lang-test", "en");
  assertEq(db.getMemLang("lang-test"), "en");
  db.setMemLang("lang-test", "tr");
  assertEq(db.getMemLang("lang-test"), "tr");
});

console.log("\n=== permissions ===");
const perm = require("./src/permissions");
t("null member → false", () => {
  assertEq(perm.isDevOrMod(null), false);
  assertEq(perm.isDevOrMod(undefined), false);
});
t("admin perm → true", () => {
  const m = { permissions: { has: () => true }, roles: { cache: { some: () => false } } };
  assertEq(perm.isDevOrMod(m), true);
});
t("Developer role → true", () => {
  const m = {
    permissions: { has: () => false },
    roles: { cache: { some: fn => fn({ name: "Developer" }) } },
  };
  assertEq(perm.isDevOrMod(m), true);
});
t("random role → false", () => {
  const m = {
    permissions: { has: () => false },
    roles: { cache: { some: fn => fn({ name: "Random" }) } },
  };
  assertEq(perm.isDevOrMod(m), false);
});

console.log("\n=== trust levels ===");
const trust = require("./src/trust");
t("new user starts at level 0", () => {
  const l = trust.computeLevel("new-user");
  assertEq(l.id, 0);
});
t("verified user reaches level 1", () => {
  db.updMem("verify-user", { verified: true, joined: "2020-01-01 00:00:00" });
  const l = trust.computeLevel("verify-user");
  assertEq(l.id, 1);
});
t("active requires msgs + verified", () => {
  db.updMem("active-user", { verified: true, msgs: 50, joined: "2020-01-01 00:00:00" });
  const l = trust.computeLevel("active-user");
  assertEq(l.id, 2);
});
t("unverified cannot reach active even with msgs", () => {
  db.updMem("noverify-user", { verified: false, msgs: 200, joined: "2020-01-01 00:00:00" });
  const l = trust.computeLevel("noverify-user");
  assertEq(l.id, 0);
});
t("setLevel works with override flag", () => {
  trust.setLevel("manual-user", 3);
  const m = db.getMem("manual-user");
  assertEq(m.trust, 3);
  assertEq(m.trustOverride, true);
});
t("recalculate changes level only when needed", () => {
  db.updMem("recalc-user", { verified: true, joined: "2020-01-01 00:00:00" });
  const r1 = trust.recalculate("recalc-user");
  if (!r1.changed) throw new Error("should change 0→1");
  const r2 = trust.recalculate("recalc-user");
  if (r2.changed) throw new Error("should not re-change");
});

console.log("\n=== raid protection ===");
const raid = require("./src/raidProtection");
t("single join does not trigger", () => {
  const mockMember = {
    id: "u1", displayName: "U",
    guild: { id: "test-g" },
    user: { createdTimestamp: Date.now() - 30 * 86400000 },
  };
  const r = raid.recordJoin(mockMember);
  assertEq(r.triggered, false);
});
t("burst triggers detection", () => {
  for (let i = 0; i < 4; i++) {
    raid.recordJoin({
      id: "u" + i, displayName: "U" + i,
      guild: { id: "burst-g" },
      user: { createdTimestamp: Date.now() - 30 * 86400000 },
    });
  }
  const r = raid.recordJoin({
    id: "u-last", displayName: "ULast",
    guild: { id: "burst-g" },
    user: { createdTimestamp: Date.now() - 1 * 86400000 }, // young account
  });
  if (!r.triggered) throw new Error("should trigger at 5th join");
});
t("suspicious accounts flagged for young age", () => {
  const r = raid.recordJoin({
    id: "young", displayName: "Young",
    guild: { id: "susp-g" },
    user: { createdTimestamp: Date.now() - 1 * 86400000 },
  });
  assertEq(r.suspicious, true);
});

console.log("\n=== auto slow mode ===");
const asm = require("./src/autoSlowMode");
t("tick is safe with missing rate limit fn", async () => {
  const mockMsg = {
    guild: { id: "g" },
    channel: {},  // no setRateLimitPerUser
  };
  const r = await asm.tick(mockMsg);
  assertEq(r, false);
});

console.log("\n=== achievements ===");
const ach = require("./src/achievements");
t("first_bug unlocked after 1 bug", () => {
  db.getMem("ach-user");
  db.incBugs("ach-user");
  const newly = ach.checkAndGrant("ach-user");
  if (!newly.includes("first_bug")) throw new Error("not unlocked");
});
t("bug_hunter unlocked at 10", () => {
  for (let i = 0; i < 9; i++) db.incBugs("ach-user");
  const newly = ach.checkAndGrant("ach-user");
  if (!newly.includes("bug_hunter")) throw new Error("got: " + JSON.stringify(newly));
});
t("no duplicate grants", () => {
  const newly = ach.checkAndGrant("ach-user");
  if (newly.includes("first_bug")) throw new Error("re-granted");
});

console.log("\n=== locale consistency ===");
const tr = require("./src/locales/tr.json");
const en = require("./src/locales/en.json");

function flatKeys(obj, prefix = "") {
  const keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "object" && v !== null && !Array.isArray(v)) {
      keys.push(...flatKeys(v, full));
    } else {
      keys.push(full);
    }
  }
  return keys;
}

const trKeys = new Set(flatKeys(tr));
const enKeys = new Set(flatKeys(en));
t("TR has no keys missing in EN", () => {
  const missing = [...trKeys].filter(k => !enKeys.has(k));
  if (missing.length) throw new Error("missing in EN: " + missing.slice(0, 5).join(", "));
});
t("EN has no keys missing in TR", () => {
  const missing = [...enKeys].filter(k => !trKeys.has(k));
  if (missing.length) throw new Error("missing in TR: " + missing.slice(0, 5).join(", "));
});

console.log("\n=== used keys vs defined keys ===");
// Find all i18n.t("key.path", ...) and t("key.path", ...) references across source
const srcDir = path.join(__dirname, "src");
function collectUsed() {
  const used = new Set();
  const re = /(?:i18n\.t|\bt)\(\s*["'`]([a-z_][a-z0-9_.]*)["'`]/gi;
  const SKIP = new Set(["test-runtime.js"]);
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (SKIP.has(entry.name)) continue;
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.name.endsWith(".js")) {
        const txt = fs.readFileSync(p, "utf-8");
        let m;
        while ((m = re.exec(txt))) used.add(m[1]);
      }
    }
  }
  walk(srcDir);
  const botTxt = fs.readFileSync(path.join(__dirname, "bot.js"), "utf-8");
  let m;
  while ((m = re.exec(botTxt))) used.add(m[1]);
  return used;
}
const used = collectUsed();

// Some keys are built dynamically (e.g. `bug.severity.${sev}`, `achievements.${key}.name`)
// Skip these dynamic leaves by collecting their PARENT namespaces and checking sub-branches exist.
const DYNAMIC_PREFIXES = [
  "bug.severity", "bug.status", "bug.platform", "bug.category",
  "ticket.categories", "suggestion.status", "beta.status",
  "announcement.types", "help.categories", "help.sections",
  "faq.categories", "achievements",
];
function isDynamic(k) {
  return DYNAMIC_PREFIXES.some(p => k === p || k.startsWith(p + "."));
}

t("All used i18n keys exist in TR locale (static only)", () => {
  const missing = [...used].filter(k => !trKeys.has(k) && !isDynamic(k));
  if (missing.length) throw new Error("undefined in TR: " + missing.join(", "));
});
t("All used i18n keys exist in EN locale (static only)", () => {
  const missing = [...used].filter(k => !enKeys.has(k) && !isDynamic(k));
  if (missing.length) throw new Error("undefined in EN: " + missing.join(", "));
});

console.log("\n=== SUMMARY ===");
console.log(`Pass: ${pass} | Fail: ${fail}`);

// Restore real data
if (fs.existsSync(DB)) fs.unlinkSync(DB);
if (fs.existsSync(BKP)) fs.renameSync(BKP, DB);
if (fs.existsSync(DB + ".bak")) fs.unlinkSync(DB + ".bak");

process.exit(fail > 0 ? 1 : 0);

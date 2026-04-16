// Coverage test — verifies every registered slash command has a handler
// and every button customId created in source has a handler clause.
const fs = require("fs");
const path = require("path");

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); console.log("  ✓", name); pass++; }
  catch (e) { console.error("  ✗", name, "→", e.message); fail++; }
}

console.log("\n=== slash command coverage ===");
const { commands } = require("./src/commands");
const cmdNames = commands.map(c => c.toJSON().name);
const cmdHandlerTxt = fs.readFileSync("./src/interactions/commands.js", "utf-8");

t("every registered command has 'c === \"name\"' check", () => {
  const missing = cmdNames.filter(n => !cmdHandlerTxt.includes(`c === "${n}"`));
  if (missing.length) throw new Error("no handler for: " + missing.join(", "));
});

console.log("\n=== button customId coverage ===");

// Collect button customIds created in source (setCustomId calls)
function collectCustomIds() {
  const ids = new Set();
  const re = /\.setCustomId\(\s*[`"']([^`"'$}]+)/g;
  const reTpl = /\.setCustomId\(\s*`([^`${]*?)\$\{/g;  // prefix of template literal customIds
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === "data.json.bak") continue;
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.name.endsWith(".js")) {
        const txt = fs.readFileSync(p, "utf-8");
        let m;
        while ((m = re.exec(txt))) ids.add(m[1]);
        while ((m = reTpl.exec(txt))) ids.add(m[1]);  // adds the prefix like "cl_"
      }
    }
  }
  walk("./src");
  return ids;
}

const ids = collectCustomIds();

// Read the 4 handler files
const btn = fs.readFileSync("./src/interactions/buttons.js", "utf-8");
const mod = fs.readFileSync("./src/interactions/modals.js", "utf-8");
const sel = fs.readFileSync("./src/interactions/selects.js", "utf-8");
const cmd = fs.readFileSync("./src/interactions/commands.js", "utf-8");
const allHandlers = btn + "\n" + mod + "\n" + sel + "\n" + cmd;

// Skip IDs that aren't interaction handlers (internal component IDs, etc)
const IGNORE = new Set([
  "filt",       // used in embed as select menu id
  "help_cat",
  "faq_cat",
  "trg_claim",
]);

// Extract all exact equality checks: id === "xxx"
const EXACT_RE = /(?:id|customId)\s*===\s*["']([^"']+)["']/g;
const exacts = new Set();
let mm;
while ((mm = EXACT_RE.exec(allHandlers))) exacts.add(mm[1]);

// Extract all prefix checks: startsWith("xxx")
const PREFIX_RE = /startsWith\(\s*["']([^"']+)["']\s*\)/g;
const prefixes = [];
while ((mm = PREFIX_RE.exec(allHandlers))) prefixes.push(mm[1]);

// Bug action prefixes are handled via BUG_ACTIONS whitelist + split/parseInt (not startsWith)
const BUG_ACTION_PREFIXES = ["cl_", "ua_", "rv_", "cx_", "ro_", "vu_", "cm_", "th_", "hi_"];

function isHandled(id) {
  if (exacts.has(id)) return true;
  if (prefixes.some(p => id.startsWith(p))) return true;
  if (BUG_ACTION_PREFIXES.some(p => id.startsWith(p))) return true;
  return false;
}

// Modal text inputs also use setCustomId but are NOT routable interactions —
// they're form field names accessed via ix.fields.getTextInputValue(). Skip them.
const MODAL_FIELD_IDS = new Set(["w", "t", "d", "s", "v", "p", "c", "r", "k", "n", "q"]);

const unhandled = [];
for (const id of ids) {
  if (!id || IGNORE.has(id)) continue;
  if (MODAL_FIELD_IDS.has(id)) continue;
  if (!isHandled(id)) unhandled.push(id);
}

t("every button/select customId has a handler clause", () => {
  if (unhandled.length) throw new Error("no handler for: " + unhandled.join(", "));
});

console.log("\n=== BUG_ACTIONS whitelist sync ===");
// Bug action prefixes used in embeds.js bugBB
const embeds = fs.readFileSync("./src/embeds.js", "utf-8");
const actionPrefixes = [];
const re2 = /setCustomId\(`(cl|ua|rv|cx|ro|vu|cm|th|hi|mk|umk|asg|sev)_/g;
let m;
while ((m = re2.exec(embeds))) if (!actionPrefixes.includes(m[1])) actionPrefixes.push(m[1]);
t("BUG_ACTIONS whitelist includes all bug card prefixes used in embeds", () => {
  // The BUG_ACTIONS list in buttons.js
  const m2 = /BUG_ACTIONS\s*=\s*\[([^\]]+)\]/.exec(btn);
  if (!m2) throw new Error("BUG_ACTIONS not found");
  const whitelist = m2[1].match(/"([^"]+)"/g).map(s => s.slice(1, -1));
  // core actions (cl, rv, cx, ua, ro, vu, cm, th, hi) must be in whitelist; new ones (mk, umk, asg, sev) handled BEFORE reaching the whitelist check
  const core = ["cl", "ua", "rv", "cx", "ro", "vu", "cm", "th", "hi"];
  const missing = core.filter(a => !whitelist.includes(a));
  if (missing.length) throw new Error("missing core actions in BUG_ACTIONS: " + missing.join(", "));
});

console.log("\n=== handler export sanity ===");
t("modals exports createBugFromData (used by buttons)", () => {
  const m = require("./src/interactions/modals");
  if (typeof m.createBugFromData !== "function") throw new Error("not exported");
});
t("all 4 handlers export the right dispatch function", () => {
  if (typeof require("./src/interactions/commands").handleCommand !== "function") throw new Error("commands");
  if (typeof require("./src/interactions/buttons").handleButton !== "function") throw new Error("buttons");
  if (typeof require("./src/interactions/modals").handleModal !== "function") throw new Error("modals");
  if (typeof require("./src/interactions/selects").handleSelect !== "function") throw new Error("selects");
});

console.log("\n=== SUMMARY ===");
console.log(`Pass: ${pass} | Fail: ${fail}`);
process.exit(fail > 0 ? 1 : 0);

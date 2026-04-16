const fs = require("fs");
const path = require("path");
const DB = path.join(__dirname, "data.json");
const BAK = path.join(__dirname, "data.json.bak");

const DEF = {
  bugs: [], comments: [], developers: [], configs: [], history: [],
  warnings: [], notes: [], welcomes: [], betaKeys: [], usedKeys: [],
  betaApps: [], tickets: [], suggestions: [], announcements: [],
  members: [], invites: [], giveaways: [], polls: [], faqs: [],
  qaSessions: [],
  automod: { banned_words: [], max_caps: 70, max_mentions: 5, spam_count: 5, spam_ms: 3000 },
  nBug: 1, nApp: 1, nTkt: 1, nSug: 1, nGiv: 1, nPol: 1, nFaq: 1, nQa: 1, nQaQ: 1
};

// ===== CACHE LAYER =====
let cache = null;
let dirty = false;
let saveTimer = null;
const SAVE_DEBOUNCE = 500;

function initCache() {
  try {
    if (fs.existsSync(DB)) {
      const raw = fs.readFileSync(DB, "utf-8");
      const d = JSON.parse(raw);
      for (const k of Object.keys(DEF)) {
        if (!(k in d)) {
          d[k] = typeof DEF[k] === "object" && !Array.isArray(DEF[k])
            ? { ...DEF[k] }
            : Array.isArray(DEF[k]) ? [] : DEF[k];
        }
      }
      // Startup backup
      try { fs.copyFileSync(DB, BAK); } catch {}
      cache = d;
      return;
    }
  } catch (e) {
    console.error("[DB] Load error:", e.message);
    try {
      if (fs.existsSync(BAK)) {
        cache = JSON.parse(fs.readFileSync(BAK, "utf-8"));
        console.warn("[DB] Recovered from backup");
        return;
      }
    } catch (e2) {
      console.error("[DB] Backup also corrupt:", e2.message);
    }
  }
  cache = JSON.parse(JSON.stringify(DEF));
}

function flush() {
  if (!dirty || !cache) return;
  try {
    const tmp = DB + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(cache, null, 2), "utf-8");
    fs.renameSync(tmp, DB);
    dirty = false;
  } catch (e) {
    console.error("[DB] Save error:", e.message);
  }
}

function ld() {
  if (cache === null) initCache();
  return cache;
}

function sv() {
  dirty = true;
  if (saveTimer) return;
  saveTimer = setTimeout(() => { saveTimer = null; flush(); }, SAVE_DEBOUNCE);
}

function flushSync() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  flush();
}

// Graceful shutdown — ensure no data loss
process.on("SIGINT",  () => { flushSync(); process.exit(0); });
process.on("SIGTERM", () => { flushSync(); process.exit(0); });
process.on("beforeExit", () => flushSync());

// ===== HELPERS =====
function now() { return new Date().toISOString().replace("T", " ").slice(0, 19); }
function pad(n) { return String(n).padStart(4, "0"); }
function so(s) { return { critical: 1, high: 2, medium: 3, low: 4 }[s] || 5; }

const db = {
  // MEMBERS & LEVELING (score = invites*50 + bugs*30 + messages)
  getMem(uid) {
    const d = ld();
    let m = d.members.find(x => x.uid === uid);
    if (!m) {
      m = { uid, name: "", xp: 0, lvl: 0, bugs: 0, invs: 0, msgs: 0, joined: now() };
      d.members.push(m);
      sv();
    }
    return m;
  },
  updMem(uid, u) {
    const d = ld();
    let m = d.members.find(x => x.uid === uid);
    if (!m) {
      m = { uid, name: "", xp: 0, lvl: 0, bugs: 0, invs: 0, msgs: 0, joined: now() };
      d.members.push(m);
    }
    Object.assign(m, u);
    sv();
  },
  trackMsg(uid, name) {
    const d = ld();
    let m = d.members.find(x => x.uid === uid);
    if (!m) {
      m = { uid, name, xp: 0, lvl: 0, bugs: 0, invs: 0, msgs: 0, joined: now() };
      d.members.push(m);
    }
    m.name = name;
    m.msgs++;
    m.xp = m.invs * 50 + m.bugs * 30 + m.msgs;
    const nl = Math.floor(m.xp / 100);
    const up = nl > m.lvl;
    m.lvl = nl;
    sv();
    return { xp: m.xp, lvl: m.lvl, up };
  },
  incBugs(uid) {
    const d = ld();
    const m = d.members.find(x => x.uid === uid);
    if (m) {
      m.bugs++;
      m.xp = m.invs * 50 + m.bugs * 30 + m.msgs;
      m.lvl = Math.floor(m.xp / 100);
      sv();
    }
  },
  incInvs(uid) {
    const d = ld();
    const m = d.members.find(x => x.uid === uid);
    if (m) {
      m.invs++;
      m.xp = m.invs * 50 + m.bugs * 30 + m.msgs;
      m.lvl = Math.floor(m.xp / 100);
      sv();
    }
  },
  topMembers() {
    return ld().members
      .map(m => ({ ...m, score: m.invs * 50 + m.bugs * 30 + m.msgs }))
      .sort((a, b) => b.score - a.score);
  },
  storeInvs(inv) { ld().invites = inv; sv(); },
  getInvs() { return ld().invites; },

  // LANGUAGE PREFERENCES
  getMemLang(uid) {
    const m = ld().members.find(x => x.uid === uid);
    return m?.lang || null;
  },
  setMemLang(uid, lang) {
    const d = ld();
    let m = d.members.find(x => x.uid === uid);
    if (!m) {
      m = { uid, name: "", xp: 0, lvl: 0, bugs: 0, invs: 0, msgs: 0, joined: now(), lang };
      d.members.push(m);
    } else {
      m.lang = lang;
    }
    sv();
  },

  // BUGS
  mkBug(f) {
    const d = ld();
    const b = {
      id: d.nBug++, tag: `GAME-${pad(d.nBug - 1)}`,
      title: f.title, desc: f.desc, steps: f.steps || "",
      sev: f.sev, status: "open", plat: f.plat || "all", cat: f.cat || "gameplay",
      by: f.uid, byN: f.name, to: null, toN: null,
      chId: null, msgId: null, thId: null,
      at: now(), upd: now(), resAt: null, resNote: null, votes: [],
      known: false, workaround: null,
      escalated: false
    };
    d.bugs.push(b);
    d.history.push({ bid: b.id, act: "created", by: f.name, at: now() });
    sv();
    return b;
  },
  getBug(id) { return ld().bugs.find(b => b.id === id) || null; },
  assignBug(id, uid, n) {
    const d = ld(), b = d.bugs.find(x => x.id === id);
    if (!b) return;
    b.to = uid; b.toN = n; b.status = "in-progress"; b.upd = now();
    d.history.push({ bid: id, act: "assigned", by: n, at: now(), det: n });
    sv();
  },
  resolveBug(id, note, by) {
    const d = ld(), b = d.bugs.find(x => x.id === id);
    if (!b) return;
    b.status = "resolved"; b.resNote = note; b.resAt = now(); b.upd = now();
    d.history.push({ bid: id, act: "resolved", by, at: now(), det: note });
    sv();
  },
  closeBug(id, by) {
    const d = ld(), b = d.bugs.find(x => x.id === id);
    if (!b) return;
    b.status = "closed"; b.upd = now();
    d.history.push({ bid: id, act: "closed", by, at: now() });
    sv();
  },
  reopenBug(id, by) {
    const d = ld(), b = d.bugs.find(x => x.id === id);
    if (!b) return;
    b.status = "open"; b.resAt = null; b.resNote = null; b.upd = now();
    d.history.push({ bid: id, act: "reopened", by, at: now() });
    sv();
  },
  unassignBug(id, by) {
    const d = ld(), b = d.bugs.find(x => x.id === id);
    if (!b) return;
    b.to = null; b.toN = null; b.status = "open"; b.upd = now();
    d.history.push({ bid: id, act: "unassigned", by, at: now() });
    sv();
  },
  setRef(id, ch, msg) {
    const d = ld(), b = d.bugs.find(x => x.id === id);
    if (b) { b.chId = ch; b.msgId = msg; sv(); }
  },
  setTh(id, th) {
    const d = ld(), b = d.bugs.find(x => x.id === id);
    if (b) { b.thId = th; sv(); }
  },
  vote(id, uid) {
    const d = ld(), b = d.bugs.find(x => x.id === id);
    if (!b) return 0;
    const i = b.votes.indexOf(uid);
    if (i >= 0) b.votes.splice(i, 1);
    else b.votes.push(uid);
    sv();
    return b.votes.length;
  },
  bugsBy(s) {
    return ld().bugs.filter(b => b.status === s)
      .sort((a, b) => so(a.sev) - so(b.sev));
  },
  bugsActive() {
    return ld().bugs.filter(b => ["open", "in-progress"].includes(b.status))
      .sort((a, b) => so(a.sev) - so(b.sev));
  },
  bugsUnassigned() {
    return ld().bugs
      .filter(b => !b.to && b.status === "open")
      .sort((a, b) => so(a.sev) - so(b.sev) || new Date(a.at) - new Date(b.at));
  },
  bugsDev(uid) {
    return ld().bugs.filter(b => b.to === uid && ["open", "in-progress"].includes(b.status));
  },
  bugsUser(uid) {
    return ld().bugs.filter(b => b.by === uid).reverse();
  },
  bugsSev(s) {
    return ld().bugs.filter(b => b.sev === s && ["open", "in-progress"].includes(b.status));
  },
  bugsCat(c) {
    return ld().bugs.filter(b => b.cat === c && ["open", "in-progress"].includes(b.status))
      .sort((a, b) => so(a.sev) - so(b.sev));
  },
  search(q) {
    const query = q.toLowerCase().trim();
    if (!query) return [];
    const tokens = query.split(/\s+/).filter(Boolean);

    // Levenshtein distance for typo tolerance (≤ 2 chars for tokens > 4 chars)
    const levenshtein = (a, b) => {
      if (a === b) return 0;
      if (!a.length || !b.length) return Math.max(a.length, b.length);
      const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
      for (let i = 0; i <= a.length; i++) dp[i][0] = i;
      for (let j = 0; j <= b.length; j++) dp[0][j] = j;
      for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
          dp[i][j] = a[i - 1] === b[j - 1]
            ? dp[i - 1][j - 1]
            : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
      }
      return dp[a.length][b.length];
    };

    const scoreBug = (b) => {
      const title = b.title.toLowerCase();
      const desc = b.desc.toLowerCase();
      const tag = b.tag.toLowerCase();
      let score = 0;
      // Exact tag match scores highest
      if (tag === query) score += 1000;
      else if (tag.includes(query)) score += 100;
      // Full query substring match in title/desc
      if (title.includes(query)) score += 50;
      if (desc.includes(query)) score += 20;
      // Token-level: each token boosts score
      for (const tok of tokens) {
        if (title.includes(tok)) score += 10;
        if (desc.includes(tok)) score += 3;
        // Typo tolerance for meaningful tokens
        if (tok.length > 4) {
          for (const word of title.split(/\s+/)) {
            if (levenshtein(tok, word) === 1) score += 5;
          }
        }
      }
      return score;
    };

    return ld().bugs
      .map(b => ({ b, s: scoreBug(b) }))
      .filter(x => x.s > 0)
      .sort((x, y) => y.s - x.s)
      .slice(0, 15)
      .map(x => x.b);
  },
  addCmt(bid, uid, n, txt) {
    ld().comments.push({ bid, uid, name: n, txt, at: now() });
    sv();
  },
  markEscalated(id) {
    const d = ld(), b = d.bugs.find(x => x.id === id);
    if (!b) return;
    b.escalated = true;
    d.history.push({ bid: id, act: "escalated", by: "bot", at: now() });
    sv();
  },
  setSeverity(id, sev, by) {
    const d = ld(), b = d.bugs.find(x => x.id === id);
    if (!b) return null;
    const prev = b.sev;
    b.sev = sev;
    b.upd = now();
    d.history.push({ bid: id, act: "severity_changed", by, at: now(), det: `${prev} → ${sev}` });
    sv();
    return b;
  },
  markKnown(id, workaround, by) {
    const d = ld(), b = d.bugs.find(x => x.id === id);
    if (!b) return null;
    b.known = true;
    b.workaround = workaround || null;
    b.upd = now();
    d.history.push({ bid: id, act: "marked_known", by, at: now(), det: workaround || "" });
    sv();
    return b;
  },
  unmarkKnown(id, by) {
    const d = ld(), b = d.bugs.find(x => x.id === id);
    if (!b) return null;
    b.known = false;
    b.workaround = null;
    b.upd = now();
    d.history.push({ bid: id, act: "unmarked_known", by, at: now() });
    sv();
    return b;
  },
  knownBugs() {
    return ld().bugs
      .filter(b => b.known && b.status !== "closed")
      .sort((a, b) => so(a.sev) - so(b.sev));
  },
  getCmts(bid) { return ld().comments.filter(c => c.bid === bid).slice(-10); },
  getHist(bid) { return ld().history.filter(h => h.bid === bid).slice(-15); },
  recentActivity(limit = 10) {
    const h = ld().history;
    return h.slice(-limit).reverse().map(entry => {
      const bug = ld().bugs.find(b => b.id === entry.bid);
      return { ...entry, tag: bug?.tag, title: bug?.title };
    });
  },

  // DEVS
  regDev(uid, n, role, spec) {
    const d = ld();
    const i = d.developers.findIndex(x => x.uid === uid);
    const dv = { uid, name: n, role, spec, resolved: 0, at: now() };
    if (i >= 0) { dv.resolved = d.developers[i].resolved; d.developers[i] = dv; }
    else d.developers.push(dv);
    sv();
  },
  devs() { return [...ld().developers].sort((a, b) => b.resolved - a.resolved); },
  incRes(uid) {
    const d = ld(), dv = d.developers.find(x => x.uid === uid);
    if (dv) { dv.resolved++; sv(); }
  },
  devLb() {
    return [...ld().developers].sort((a, b) => b.resolved - a.resolved).slice(0, 10);
  },

  // WARNINGS / NOTES
  warn(uid, n, reason, by) {
    const d = ld();
    d.warnings.push({ uid, name: n, reason, by, at: now() });
    sv();
    return d.warnings.filter(w => w.uid === uid).length;
  },
  warns(uid) { return ld().warnings.filter(w => w.uid === uid); },
  note(uid, n, note, by) {
    ld().notes.push({ uid, name: n, note, by, at: now() });
    sv();
  },
  notes(uid) { return ld().notes.filter(n => n.uid === uid); },
  welcome(uid, n) {
    ld().welcomes.push({ uid, name: n, at: now() });
    sv();
  },

  // CONFIG
  getCfg(gid) { return ld().configs.find(c => c.gid === gid) || null; },
  setCfg(gid, data) {
    const d = ld();
    const i = d.configs.findIndex(c => c.gid === gid);
    if (i >= 0) d.configs[i] = { gid, ...data };
    else d.configs.push({ gid, ...data });
    sv();
  },

  // AUTOMOD
  getAM() { return ld().automod; },
  addBan(w) {
    const d = ld();
    if (!d.automod.banned_words.includes(w.toLowerCase())) {
      d.automod.banned_words.push(w.toLowerCase());
      sv();
    }
  },
  rmBan(w) {
    const d = ld();
    d.automod.banned_words = d.automod.banned_words.filter(x => x !== w.toLowerCase());
    sv();
  },

  // BETA
  addKeys(keys) {
    const d = ld();
    let n = 0;
    keys.forEach(k => {
      if (!d.betaKeys.find(x => x.key === k) && !d.usedKeys.find(x => x.key === k)) {
        d.betaKeys.push({ key: k, at: now() });
        n++;
      }
    });
    sv();
    return { added: n, total: d.betaKeys.length };
  },
  usedKeys() { return ld().usedKeys; },
  clearKeys() {
    const d = ld();
    const n = d.betaKeys.length;
    d.betaKeys = [];
    sv();
    return n;
  },
  applyBeta(uid, n, reason, plat) {
    const d = ld();
    if (d.betaApps.find(a => a.uid === uid && a.status === "pending")) return { err: "pending" };
    if (d.usedKeys.find(x => x.uid === uid)) return { err: "has_key" };
    const a = {
      id: d.nApp++, uid, name: n, reason, plat,
      status: "pending", at: now(),
      reviewer: null, reviewAt: null, key: null
    };
    d.betaApps.push(a);
    sv();
    return a;
  },
  getApp(id) { return ld().betaApps.find(a => a.id === id) || null; },
  apps(s) { return s ? ld().betaApps.filter(a => a.status === s) : ld().betaApps; },
  approveApp(id, rev) {
    const d = ld(), a = d.betaApps.find(x => x.id === id);
    if (!a || a.status !== "pending") return { err: "invalid" };
    if (!d.betaKeys.length) return { err: "no_keys" };
    const k = d.betaKeys.shift();
    a.status = "approved"; a.reviewer = rev; a.reviewAt = now(); a.key = k.key;
    d.usedKeys.push({ key: k.key, uid: a.uid, name: a.name, at: now() });
    sv();
    return { app: a, key: k.key };
  },
  rejectApp(id, rev) {
    const d = ld(), a = d.betaApps.find(x => x.id === id);
    if (!a || a.status !== "pending") return { err: "invalid" };
    a.status = "rejected"; a.reviewer = rev; a.reviewAt = now();
    sv();
    return a;
  },
  betaSt() {
    const d = ld();
    return {
      pool: d.betaKeys.length,
      used: d.usedKeys.length,
      pending: d.betaApps.filter(a => a.status === "pending").length,
      approved: d.betaApps.filter(a => a.status === "approved").length,
      rejected: d.betaApps.filter(a => a.status === "rejected").length
    };
  },

  // TICKETS
  mkTkt(uid, n, cat, desc) {
    const d = ld();
    const t = {
      id: d.nTkt++, tag: `TKT-${pad(d.nTkt - 1)}`,
      uid, name: n, cat, desc, status: "open",
      chId: null, claimUid: null, claimN: null,
      at: now(), closedAt: null, closeReason: null
    };
    d.tickets.push(t);
    sv();
    return t;
  },
  getTkt(id) { return ld().tickets.find(t => t.id === id) || null; },
  getTktByCh(ch) { return ld().tickets.find(t => t.chId === ch) || null; },
  setTktCh(id, ch) {
    const d = ld(), t = d.tickets.find(x => x.id === id);
    if (t) { t.chId = ch; sv(); }
  },
  claimTkt(id, uid, n) {
    const d = ld(), t = d.tickets.find(x => x.id === id);
    if (t) { t.claimUid = uid; t.claimN = n; sv(); }
  },
  closeTkt(id, r) {
    const d = ld(), t = d.tickets.find(x => x.id === id);
    if (t) { t.status = "closed"; t.closedAt = now(); t.closeReason = r || "Closed"; sv(); }
  },
  openTkts() { return ld().tickets.filter(t => t.status === "open"); },
  tktSt() {
    const t = ld().tickets;
    return {
      total: t.length,
      open: t.filter(x => x.status === "open").length,
      closed: t.filter(x => x.status === "closed").length
    };
  },

  // SUGGESTIONS
  mkSug(uid, n, title, desc, cat) {
    const d = ld();
    const s = {
      id: d.nSug++, tag: `IDEA-${pad(d.nSug - 1)}`,
      uid, name: n, title, desc, cat: cat || "general",
      status: "open", up: [], dn: [],
      resp: null, respBy: null, msgId: null, chId: null, at: now()
    };
    d.suggestions.push(s);
    sv();
    return s;
  },
  getSug(id) { return ld().suggestions.find(s => s.id === id) || null; },
  setSugMsg(id, ch, msg) {
    const d = ld(), s = d.suggestions.find(x => x.id === id);
    if (s) { s.chId = ch; s.msgId = msg; sv(); }
  },
  voteSug(id, uid, type) {
    const d = ld(), s = d.suggestions.find(x => x.id === id);
    if (!s) return null;
    s.up = s.up.filter(u => u !== uid);
    s.dn = s.dn.filter(u => u !== uid);
    if (type === "up") s.up.push(uid);
    else s.dn.push(uid);
    sv();
    return { up: s.up.length, dn: s.dn.length };
  },
  respSug(id, st, resp, by) {
    const d = ld(), s = d.suggestions.find(x => x.id === id);
    if (!s) return null;
    s.status = st; s.resp = resp; s.respBy = by;
    sv();
    return s;
  },
  sugs(st) {
    const a = ld().suggestions;
    return (st ? a.filter(s => s.status === st) : a)
      .sort((a, b) => (b.up.length - b.dn.length) - (a.up.length - a.dn.length))
      .slice(0, 25);
  },
  topSugs() {
    return ld().suggestions.filter(s => s.status === "open")
      .sort((a, b) => (b.up.length - b.dn.length) - (a.up.length - a.dn.length))
      .slice(0, 10);
  },

  // GIVEAWAY
  mkGiv(prize, dur, winners, host, guildId) {
    const d = ld();
    const g = {
      id: d.nGiv++, prize,
      ends: new Date(Date.now() + dur).toISOString(),
      winCt: winners, host, gid: guildId || null,
      chId: null, msgId: null,
      entries: [], status: "active", winners: [], at: now()
    };
    d.giveaways.push(g);
    sv();
    return g;
  },
  getGiv(id) { return ld().giveaways.find(g => g.id === id) || null; },
  setGivMsg(id, ch, msg) {
    const d = ld(), g = d.giveaways.find(x => x.id === id);
    if (g) { g.chId = ch; g.msgId = msg; sv(); }
  },
  enterGiv(id, uid) {
    const d = ld(), g = d.giveaways.find(x => x.id === id);
    if (!g || g.status !== "active" || g.entries.includes(uid)) return false;
    g.entries.push(uid);
    sv();
    return true;
  },
  endGiv(id) {
    const d = ld(), g = d.giveaways.find(x => x.id === id);
    if (!g) return null;
    g.status = "ended";
    const pool = [...g.entries], w = [];
    for (let i = 0; i < g.winCt && pool.length; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      w.push(pool.splice(idx, 1)[0]);
    }
    g.winners = w;
    sv();
    return { winners: w, prize: g.prize, count: g.entries.length };
  },
  activeGivs() { return ld().giveaways.filter(g => g.status === "active"); },

  // POLLS
  mkPoll(q, opts, dur, author, guildId) {
    const d = ld();
    const p = {
      id: d.nPol++, q,
      opts: opts.map(o => ({ t: o, v: [] })),
      dur, author, gid: guildId || null,
      status: "active", msgId: null, chId: null, at: now(),
      ends: dur ? new Date(Date.now() + dur).toISOString() : null
    };
    d.polls.push(p);
    sv();
    return p;
  },
  getPoll(id) { return ld().polls.find(p => p.id === id) || null; },
  votePoll(id, oi, uid) {
    const d = ld(), p = d.polls.find(x => x.id === id);
    if (!p || p.status !== "active") return null;
    p.opts.forEach(o => { o.v = o.v.filter(v => v !== uid); });
    if (p.opts[oi]) p.opts[oi].v.push(uid);
    sv();
    return p;
  },
  endPoll(id) {
    const d = ld(), p = d.polls.find(x => x.id === id);
    if (p) { p.status = "ended"; sv(); }
    return p;
  },
  setPollMsg(id, ch, msg) {
    const d = ld(), p = d.polls.find(x => x.id === id);
    if (p) { p.chId = ch; p.msgId = msg; sv(); }
  },
  activePolls() {
    return ld().polls.filter(p => p.status === "active" && p.ends);
  },

  // ANNOUNCEMENTS
  mkAnn(title, content, type, by, version) {
    const d = ld();
    const entry = { id: d.announcements.length + 1, title, content, type, by, at: now() };
    if (version) entry.version = version;
    d.announcements.push(entry);
    sv();
    return entry;
  },
  patchNotes() {
    return ld().announcements
      .filter(a => a.type === "patchnote")
      .slice().reverse();
  },
  patchNoteSearch(q) {
    const query = q.toLowerCase().trim();
    if (!query) return [];
    return ld().announcements.filter(a =>
      a.type === "patchnote" && (
        a.title.toLowerCase().includes(query) ||
        a.content.toLowerCase().includes(query) ||
        (a.version || "").toLowerCase().includes(query)
      )
    ).reverse();
  },

  // STATS
  bugStats() {
    const b = ld().bugs;
    return {
      total: b.length,
      open: b.filter(x => x.status === "open").length,
      prog: b.filter(x => x.status === "in-progress").length,
      resolved: b.filter(x => x.status === "resolved").length,
      closed: b.filter(x => x.status === "closed").length,
      critical: b.filter(x => x.sev === "critical" && ["open", "in-progress"].includes(x.status)).length,
      high: b.filter(x => x.sev === "high" && ["open", "in-progress"].includes(x.status)).length,
      today: b.filter(x => x.at.startsWith(new Date().toISOString().slice(0, 10))).length
    };
  },

  // FAQ
  mkFaq(question, answer, category, by) {
    const d = ld();
    const f = {
      id: d.nFaq++,
      question, answer,
      category: category || "general",
      by, at: now(), views: 0,
    };
    d.faqs.push(f);
    sv();
    return f;
  },
  rmFaq(id) {
    const d = ld();
    const idx = d.faqs.findIndex(f => f.id === id);
    if (idx < 0) return null;
    const removed = d.faqs.splice(idx, 1)[0];
    sv();
    return removed;
  },
  getFaq(id) { return ld().faqs.find(f => f.id === id) || null; },
  faqs(category) {
    const all = ld().faqs;
    return category ? all.filter(f => f.category === category) : all;
  },
  faqCategories() {
    const set = new Set(ld().faqs.map(f => f.category || "general"));
    return [...set].sort();
  },
  faqSearch(q) {
    const query = q.toLowerCase().trim();
    if (!query) return [];
    return ld().faqs.filter(f =>
      f.question.toLowerCase().includes(query) || f.answer.toLowerCase().includes(query)
    ).slice(0, 10);
  },
  incFaqViews(id) {
    const d = ld();
    const f = d.faqs.find(x => x.id === id);
    if (f) { f.views = (f.views || 0) + 1; sv(); }
  },

  // Q&A SESSIONS
  mkQa(topic, host) {
    const d = ld();
    // Close any existing open session
    d.qaSessions.forEach(s => { if (s.status === "open") s.status = "closed"; });
    const qa = {
      id: d.nQa++, topic, host,
      status: "open", at: now(), closedAt: null,
      questions: []
    };
    d.qaSessions.push(qa);
    sv();
    return qa;
  },
  activeQa() {
    return ld().qaSessions.find(s => s.status === "open") || null;
  },
  getQa(id) { return ld().qaSessions.find(s => s.id === id) || null; },
  closeQa(id) {
    const d = ld();
    const qa = d.qaSessions.find(s => s.id === id);
    if (!qa) return null;
    qa.status = "closed";
    qa.closedAt = now();
    sv();
    return qa;
  },
  addQaQuestion(qaId, uid, name, text) {
    const d = ld();
    const qa = d.qaSessions.find(s => s.id === qaId);
    if (!qa || qa.status !== "open") return null;
    const q = {
      id: d.nQaQ++,
      uid, name, text,
      at: now(), up: [],
    };
    qa.questions.push(q);
    sv();
    return q;
  },
  voteQaQuestion(qaId, questionId, uid) {
    const d = ld();
    const qa = d.qaSessions.find(s => s.id === qaId);
    if (!qa) return null;
    const q = qa.questions.find(x => x.id === questionId);
    if (!q) return null;
    const i = q.up.indexOf(uid);
    if (i >= 0) q.up.splice(i, 1);
    else q.up.push(uid);
    sv();
    return q;
  },
  qaTopQuestions(qaId, limit = 10) {
    const qa = ld().qaSessions.find(s => s.id === qaId);
    if (!qa) return [];
    return [...qa.questions].sort((a, b) => b.up.length - a.up.length).slice(0, limit);
  },

  // Manual flush (used by bot shutdown handlers)
  flush: flushSync
};

module.exports = { db };

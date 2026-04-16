// Trust level system — auto-promotes members based on activity and age
const { db } = require("./db");

// Level definitions — each has a role name (for auto-assignment) and requirements
// Ordered from lowest to highest. Missing a requirement keeps member at the highest fully-satisfied level.
const LEVELS = [
  {
    id: 0, key: "newcomer", roleName: "Yeni Üye",
    color: 0x95a5a6,
    requires: () => true, // everyone starts here
  },
  {
    id: 1, key: "verified", roleName: "Doğrulanmış",
    color: 0x2ecc71,
    requires: (m, now) => !!m.verified,
  },
  {
    id: 2, key: "active", roleName: "Aktif",
    color: 0x3498db,
    requires: (m, now) => !!m.verified
      && (m.msgs || 0) >= 20
      && daysSince(m.joined, now) >= 3,
  },
  {
    id: 3, key: "trusted", roleName: "Güvenilir",
    color: 0x9b59b6,
    requires: (m, now, warnings) => !!m.verified
      && (m.msgs || 0) >= 150
      && daysSince(m.joined, now) >= 14
      && warnings.length === 0
      && ((m.bugs || 0) >= 1 || (m.invs || 0) >= 1),
  },
  {
    id: 4, key: "veteran", roleName: "Kıdemli",
    color: 0xe67e22,
    requires: (m, now, warnings) => !!m.verified
      && (m.msgs || 0) >= 1000
      && daysSince(m.joined, now) >= 60
      && warnings.length === 0
      && (m.bugs || 0) >= 5,
  },
];

function daysSince(joinedStr, now = new Date()) {
  if (!joinedStr) return 0;
  const t = new Date(joinedStr.replace(" ", "T"));
  return (now.getTime() - t.getTime()) / (1000 * 60 * 60 * 24);
}

/**
 * Compute the trust level the member should be at based on current state.
 * Returns the highest level whose requirements are satisfied.
 */
function computeLevel(uid) {
  const member = db.getMem(uid);
  const warnings = db.warns(uid);
  const now = new Date();
  let highest = LEVELS[0];
  for (const lvl of LEVELS) {
    if (lvl.requires(member, now, warnings)) highest = lvl;
  }
  return highest;
}

/**
 * Promote (or demote) a member if their computed level differs from stored.
 * Returns { changed, from, to } — `to` is the level object.
 * Does NOT touch Discord roles — caller handles that.
 */
function recalculate(uid) {
  const member = db.getMem(uid);
  const current = member.trust ?? 0;
  const target = computeLevel(uid).id;
  if (current !== target) {
    db.updMem(uid, { trust: target });
    return { changed: true, from: current, to: LEVELS[target] };
  }
  return { changed: false, from: current, to: LEVELS[target] };
}

function getLevel(uid) {
  const member = db.getMem(uid);
  return LEVELS[member.trust ?? 0];
}

function setLevel(uid, levelId) {
  if (levelId < 0 || levelId >= LEVELS.length) return null;
  db.updMem(uid, { trust: levelId, trustOverride: true });
  return LEVELS[levelId];
}

function clearOverride(uid) {
  db.updMem(uid, { trustOverride: false });
  return recalculate(uid);
}

module.exports = {
  LEVELS,
  computeLevel, recalculate,
  getLevel, setLevel, clearOverride,
};

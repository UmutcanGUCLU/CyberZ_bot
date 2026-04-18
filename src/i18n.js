// Internationalization — user/server language preference with fallback chain
const tr = require("./locales/tr.json");
const en = require("./locales/en.json");
const { db } = require("./db");
const logger = require("./logger");

const LOCALES = { tr, en };
const SUPPORTED = ["tr", "en"];
const DEFAULT_LANG = "en";

function resolveKey(obj, path) {
  return path.split(".").reduce((acc, k) => (acc && acc[k] !== undefined) ? acc[k] : null, obj);
}

function interpolate(str, params) {
  if (!params || typeof str !== "string") return str;
  return str.replace(/\{(\w+)\}/g, (m, k) => (params[k] !== undefined ? params[k] : m));
}

/**
 * Translate a key in the given language.
 * @param {string} key - Dotted path like "bug.panel_title"
 * @param {string} lang - "tr" or "en"
 * @param {object} [params] - Placeholders to interpolate like {name}, {count}
 * @returns {string}
 */
function t(key, lang, params) {
  const locale = LOCALES[lang] || LOCALES[DEFAULT_LANG];
  let value = resolveKey(locale, key);
  if (value === null) {
    // Fallback to default language
    value = resolveKey(LOCALES[DEFAULT_LANG], key);
    if (value === null) {
      logger.warn(`Missing translation: ${key} (${lang})`);
      return key;
    }
  }
  return interpolate(value, params);
}

/**
 * Resolve the effective language for a given interaction context.
 * English-only mode: always returns "en" regardless of user/server preferences.
 * The /dil and /language commands still run but have no effect until this is relaxed.
 * @returns {"en"}
 */
function resolveLang(_uid, _gid) {
  return "en";
}

/**
 * Language for interactions — pulls user and guild from an interaction object.
 */
function langOf(ix) {
  return resolveLang(ix?.user?.id, ix?.guildId || ix?.guild?.id);
}

/**
 * Language for a specific user in a specific guild (used for DMs / events).
 */
function langForUser(uid, guildId) {
  return resolveLang(uid, guildId);
}

function setUserLang(uid, lang) {
  if (!SUPPORTED.includes(lang)) return false;
  db.setMemLang(uid, lang);
  return true;
}

function setServerLang(gid, lang) {
  if (!SUPPORTED.includes(lang)) return false;
  const cfg = db.getCfg(gid) || {};
  db.setCfg(gid, { ...cfg, lang });
  return true;
}

module.exports = {
  t, langOf, langForUser, setUserLang, setServerLang, resolveLang,
  SUPPORTED, DEFAULT_LANG,
  meta: (lang) => LOCALES[lang]?.meta || LOCALES[DEFAULT_LANG].meta
};

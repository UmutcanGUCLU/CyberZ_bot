// Language-bound embeds: returns a proxy object where every embed function
// call automatically has the language passed as the last argument.
// Usage: const E = embedsFor(lang); E.bugP(); // auto-passes lang
const base = require("./embeds");

function embedsFor(lang) {
  const wrapped = {};
  for (const [key, value] of Object.entries(base)) {
    if (typeof value === "function") {
      wrapped[key] = (...args) => value(...args, lang);
    } else {
      wrapped[key] = value;
    }
  }
  // Special cases: functions whose signature has optional params BEFORE lang.
  // The generic wrapper can't handle these because it always appends lang last,
  // which would slot into the wrong position when the caller omits optional args.
  wrapped.listE = (bugs, title, pageInfo = null) => base.listE(bugs, title, lang, pageInfo);
  wrapped.lbE = (members, pageInfo = null) => base.lbE(members, lang, pageInfo);
  wrapped.bugE = (bug, history = [], comments = []) => base.bugE(bug, history, comments, lang);
  wrapped.verifyP = (customRules = null) => base.verifyP(lang, customRules);
  return wrapped;
}

module.exports = embedsFor;

// Leveled console logger with timestamps and colors
const LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
const CURRENT = LEVELS[process.env.LOG_LEVEL?.toUpperCase()] ?? LEVELS.INFO;
const COLOR = {
  DEBUG: "\x1b[90m",
  INFO:  "\x1b[36m",
  WARN:  "\x1b[33m",
  ERROR: "\x1b[31m",
  RESET: "\x1b[0m"
};

function ts() {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

function write(level, args) {
  if (LEVELS[level] < CURRENT) return;
  const c = COLOR[level] || "";
  const msg = args.map(a =>
    a instanceof Error ? (a.stack || a.message) :
    typeof a === "object" ? JSON.stringify(a) : String(a)
  ).join(" ");
  const line = `${c}[${ts()}] [${level.padEnd(5)}]${COLOR.RESET} ${msg}`;
  (level === "ERROR" ? console.error : console.log)(line);
}

module.exports = {
  debug: (...a) => write("DEBUG", a),
  info:  (...a) => write("INFO",  a),
  warn:  (...a) => write("WARN",  a),
  error: (...a) => write("ERROR", a),
};

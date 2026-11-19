// Shared helpers for governance scripts. Zero dependencies: Node >= 20.
import { readFileSync, readdirSync, statSync, existsSync, appendFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { execFileSync } from "node:child_process";

export const ROOT = process.cwd();

export function loadConfig() {
  return JSON.parse(readFileSync(join(ROOT, "governance/config.json"), "utf8"));
}

export function read(path) {
  return readFileSync(join(ROOT, path), "utf8");
}

export function exists(path) {
  return existsSync(join(ROOT, path));
}

// ---------- front matter ----------
// Supports the subset used by blueprint docs: `key: value` and `key: [a, b]`.
export function parseFrontMatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!m) return { data: null, body: text };
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!kv) continue;
    let v = kv[2].trim();
    if (v.startsWith("[") && v.endsWith("]")) {
      v = v.slice(1, -1).split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
    } else {
      v = v.replace(/^["']|["']$/g, "");
    }
    data[kv[1]] = v;
  }
  return { data, body: text.slice(m[0].length) };
}

// ---------- globs ----------
export function globToRegExp(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        // "**/" matches zero or more directories; trailing "**" matches anything
        if (glob[i + 2] === "/") { re += "(?:.*/)?"; i += 2; } else { re += ".*"; i += 1; }
      } else re += "[^/]*";
    } else if (c === "?") re += "[^/]";
    else if (".+^${}()|[]\\".includes(c)) re += "\\" + c;
    else re += c;
  }
  return new RegExp("^" + re + "$");
}

export function matchesAny(path, globs) {
  return globs.some((g) => globToRegExp(g).test(path));
}

export function walk(dir = ".", ignore = []) {
  const out = [];
  const abs = join(ROOT, dir);
  if (!existsSync(abs)) return out;
  for (const name of readdirSync(abs)) {
    const rel = toPosix(relative(ROOT, join(abs, name)));
    if (matchesAny(rel, ignore) || matchesAny(rel + "/", ignore) || name === ".git" || name === "node_modules") continue;
    const st = statSync(join(abs, name));
    if (st.isDirectory()) out.push(...walk(rel, ignore));
    else out.push(rel);
  }
  return out;
}

export const toPosix = (p) => p.split(sep).join("/");

// ---------- git ----------
export function git(...args) {
  try {
    return execFileSync("git", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

export function changedFiles(base, head = "HEAD") {
  const out = git("diff", "--name-only", `${base}...${head}`);
  return out ? out.split("\n").filter(Boolean) : [];
}

export function fileAtRef(ref, path) {
  return git("show", `${ref}:${path}`);
}

// ---------- GitHub event ----------
export function githubEvent() {
  const p = process.env.GITHUB_EVENT_PATH;
  if (!p || !existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8"));
}

// ---------- enforcement mode ----------
// governance/config.json `enforcement`: "enforce" (default) or "report". In report mode the gate checks
// (Reporter with { gate: true }) print what would fail but exit 0, so an existing repository can adopt the
// blueprint without every PR going red on day one. In a pull request the mode is read from the BASE branch,
// so a PR can't switch its own gate off. GOVERNANCE_ENFORCEMENT overrides the config for one local run.
export function enforcementMode() {
  const env = process.env.GOVERNANCE_ENFORCEMENT;
  if (env === "report" || env === "enforce") return env;
  let config = null;
  if (process.env.GITHUB_BASE_REF) {
    const base = fileAtRef(`origin/${process.env.GITHUB_BASE_REF}`, "governance/config.json");
    try { config = base ? JSON.parse(base) : null; } catch { config = null; }
  }
  try { config ??= loadConfig(); } catch { return "enforce"; }
  return config.enforcement === "report" ? "report" : "enforce";
}

// ---------- reporting ----------
export class Reporter {
  // gate: true lets report mode downgrade errors. Leave it off for checks that must always hold
  // (e.g. guard-paths on AI output, check-protected on approved specs).
  constructor(name, { gate = false } = {}) {
    this.name = name;
    this.reportOnly = gate && enforcementMode() === "report";
    this.errors = [];
    this.warnings = [];
    this.notes = [];
  }
  error(msg, file) { this.errors.push({ msg, file }); }
  warn(msg, file) { this.warnings.push({ msg, file }); }
  note(msg) { this.notes.push(msg); }

  markdown() {
    const lines = [`### ${this.name}`, ""];
    const status = this.errors.length ? (this.reportOnly ? "📝 report-only: would fail" : "❌ failed") : this.warnings.length ? "⚠️ passed with warnings" : "✅ passed";
    lines.push(`**Result:** ${status} — ${this.errors.length} error(s), ${this.warnings.length} warning(s)`, "");
    for (const e of this.errors) lines.push(`- ${this.reportOnly ? "📝" : "❌"} ${e.file ? `\`${e.file}\`: ` : ""}${e.msg}`);
    for (const w of this.warnings) lines.push(`- ⚠️ ${w.file ? `\`${w.file}\`: ` : ""}${w.msg}`);
    for (const n of this.notes) lines.push(`- ${n}`);
    return lines.join("\n") + "\n";
  }

  // Prints GitHub annotations + step summary, exits non-zero on errors.
  finish({ exit = true } = {}) {
    const inCI = !!process.env.GITHUB_ACTIONS;
    const level = this.reportOnly ? "warning" : "error";
    const prefix = this.reportOnly ? "[report-only, would fail] " : "";
    for (const e of this.errors) console.log(inCI ? `::${level}${e.file ? ` file=${e.file}` : ""}::${prefix}${e.msg}` : `${this.reportOnly ? "WOULD FAIL" : "ERROR"} ${e.file ?? ""} ${e.msg}`);
    for (const w of this.warnings) console.log(inCI ? `::warning${w.file ? ` file=${w.file}` : ""}::${w.msg}` : `WARN  ${w.file ?? ""} ${w.msg}`);
    for (const n of this.notes) console.log(`NOTE  ${n}`);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, this.markdown());
    console.log(`${this.name}: ${this.errors.length} error(s), ${this.warnings.length} warning(s)${this.reportOnly && this.errors.length ? " (report mode: not failing)" : ""}`);
    if (exit && this.errors.length && !this.reportOnly) process.exit(1);
  }
}

export function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = process.argv[i + 1];
  return v && !v.startsWith("--") ? v : true;
}

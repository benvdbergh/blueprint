// Plans and applies a `blueprint init`. Zero dependencies (Node >= 20).
// plan() only reads the target directory; apply() writes. Nothing is ever deleted, and files that belong
// to the project are only changed inside our own marker block or by appending missing lines / JSON keys.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AGENTS_MD_ONLY, BLOCK_END, BLOCK_START, CORE, EXCLUDE, PROVIDERS, RECORD_FILE, SIDECAR_SUFFIX,
} from "./manifest.mjs";

export const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const VERSION = JSON.parse(readFileSync(join(PACKAGE_ROOT, "package.json"), "utf8")).version;

const posix = (p) => p.split(sep).join("/");
const sha = (s) => createHash("sha256").update(s).digest("hex");
const readText = (p) => readFileSync(p, "utf8");

function listFiles(root, rel) {
  const abs = join(root, rel);
  if (!existsSync(abs)) return [];
  if (EXCLUDE.some((re) => re.test(rel))) return [];
  if (!statSync(abs).isDirectory()) return [rel];
  return readdirSync(abs).sort().flatMap((name) => listFiles(root, posix(join(rel, name))));
}

// ---------- inspecting the target ----------

export function inspectTarget(dir) {
  const entries = existsSync(dir) ? readdirSync(dir).filter((n) => n !== ".git") : [];
  const record = readRecord(dir);
  const detected = [];
  let pkg = null;
  try { pkg = JSON.parse(readText(join(dir, "package.json"))); } catch { /* no package.json */ }
  const deps = { ...pkg?.dependencies, ...pkg?.devDependencies };
  for (const [id, p] of Object.entries(PROVIDERS)) {
    if (p.detect.some((f) => existsSync(join(dir, f))) || (p.detectDependency && deps[p.detectDependency])) detected.push(id);
  }
  let mode = null;
  try { mode = JSON.parse(readText(join(dir, "governance/config.json"))).enforcement ?? null; } catch { /* not installed */ }
  return {
    exists: existsSync(dir),
    empty: entries.length === 0,
    isGit: existsSync(join(dir, ".git")),
    installed: !!record,
    record,
    detectedProviders: detected,
    mode,
  };
}

function readRecord(dir) {
  try { return JSON.parse(readText(join(dir, RECORD_FILE))); } catch { return null; }
}

// ---------- providers ----------

export function normalizeProviders(list) {
  const ids = [];
  const notes = [];
  const unknown = [];
  for (const raw of list) {
    const id = raw.trim().toLowerCase();
    if (!id) continue;
    if (id === "none") continue;
    if (PROVIDERS[id]) { if (!ids.includes(id)) ids.push(id); }
    else if (AGENTS_MD_ONLY[id]) notes.push(`${id}: ${AGENTS_MD_ONLY[id]}, nothing extra to install.`);
    else unknown.push(id);
  }
  return { ids, notes, unknown };
}

// ---------- planning ----------

/**
 * @param {string} dir target directory
 * @param {object} opts
 * @param {string[]} opts.providers provider ids (see PROVIDERS)
 * @param {"report"|"enforce"|null} opts.mode enforcement mode to write; null keeps an existing value
 * @param {string|null} opts.owner GitHub handle that replaces @OWNER in CODEOWNERS
 * @param {"skip"|"sidecar"} opts.conflicts what to do with a conflicting managed file
 */
export function plan(dir, { providers = [], mode = null, owner = null, conflicts = "skip" } = {}) {
  const record = readRecord(dir);
  const recorded = record?.files ?? {};
  const entries = [...CORE];
  for (const id of providers) entries.push(...PROVIDERS[id].files);

  const actions = [];
  for (const entry of entries) {
    if (entry.strategy === "json") { actions.push(planJson(dir, entry)); continue; }
    const sources = entry.target ? [entry.path] : listFiles(PACKAGE_ROOT, entry.path);
    if (!sources.length) throw new Error(`package is missing ${entry.path}`);
    for (const src of sources) {
      const target = entry.target ?? src;
      let content = readText(join(PACKAGE_ROOT, src));
      content = transform(target, content, { owner, mode });
      actions.push(planFile(dir, target, content, entry.strategy, recorded[target], { conflicts, mode, owner }));
    }
  }
  return { dir, actions, record };
}

function transform(target, content, { owner, mode }) {
  if (target === ".github/CODEOWNERS" && owner) content = content.replaceAll("@OWNER", owner);
  if (target === "governance/config.json") content = withMode(content, mode ?? "enforce");
  return content;
}

function withMode(jsonText, mode) {
  const data = JSON.parse(jsonText);
  const out = {};
  // keep `enforcement` right after the $comment so it is easy to find
  for (const [k, v] of Object.entries(data)) {
    if (k === "enforcement") continue;
    out[k] = v;
    if (k === "$comment") out.enforcement = mode;
  }
  if (!("enforcement" in out)) return JSON.stringify({ enforcement: mode, ...out }, null, 2) + "\n";
  return JSON.stringify(out, null, 2) + "\n";
}

function planFile(dir, target, content, strategy, recordedHash, { conflicts, mode, owner }) {
  const abs = join(dir, target);
  const base = { path: target, strategy };
  if (!existsSync(abs)) return { ...base, action: "create", content, record: sha(content) };
  const current = readText(abs);

  if (strategy === "lines") return planLines(base, current, content);

  if (strategy === "seed") {
    if (target === "governance/config.json" && mode) {
      let currentMode;
      try { currentMode = JSON.parse(current).enforcement; } catch { return { ...base, action: "keep", reason: "not valid JSON; mode not changed" }; }
      if (currentMode !== mode) return { ...base, action: "set-mode", content: withMode(current, mode), from: currentMode ?? "enforce", to: mode };
    }
    if (target === ".github/CODEOWNERS" && owner && current.includes("@OWNER")) {
      return { ...base, action: "update", content: current.replaceAll("@OWNER", owner), reason: `@OWNER → ${owner}` };
    }
    return { ...base, action: "keep" };
  }

  if (current === content) return { ...base, action: "unchanged", record: sha(content) };

  if (strategy === "block") {
    const block = `${BLOCK_START}\n${content.trimEnd()}\n${BLOCK_END}\n`;
    const start = current.indexOf(BLOCK_START.slice(0, 20));
    const end = current.indexOf(BLOCK_END);
    if (start !== -1 && end > start) {
      const next = current.slice(0, start) + block + current.slice(end + BLOCK_END.length).replace(/^\r?\n/, "");
      return next === current ? { ...base, action: "unchanged" } : { ...base, action: "replace-block", content: next };
    }
    // A file we created whole, which the project has since edited: don't append a second copy.
    if (!recordedHash) return { ...base, action: "append-block", content: current.replace(/\s*$/, "\n\n") + block };
  }

  // managed (or a block file we created that has been edited since)
  if (recordedHash && sha(current) === recordedHash) return { ...base, action: "update", content, record: sha(content) };
  if (conflicts === "sidecar") return { ...base, action: "sidecar", sidecar: target + SIDECAR_SUFFIX, content };
  return { ...base, action: "conflict" };
}

function planLines(base, current, content) {
  // "node_modules" and "node_modules/" count as the same entry
  const key = (l) => l.trim().replace(/^\//, "").replace(/\/$/, "");
  const have = new Set(current.split(/\r?\n/).map(key));
  const missing = content.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith("#") && !have.has(key(l)));
  if (!missing.length) return { ...base, action: "unchanged" };
  const next = current.replace(/\s*$/, "\n\n") + "# Added by blueprint init\n" + missing.join("\n") + "\n";
  return { ...base, action: "append-lines", content: next, added: missing };
}

function planJson(dir, entry) {
  const abs = join(dir, entry.path);
  const base = { path: entry.path, strategy: "json" };
  if (!existsSync(abs)) {
    const content = JSON.stringify(entry.content, null, 2) + "\n";
    return { ...base, action: "create", content, record: sha(content) };
  }
  let current;
  try { current = JSON.parse(readText(abs)); } catch { return { ...base, action: "conflict", reason: "not valid JSON" }; }
  const merged = mergeJson(current, entry.content);
  if (JSON.stringify(merged) === JSON.stringify(current)) return { ...base, action: "unchanged" };
  return { ...base, action: "merge-json", content: JSON.stringify(merged, null, 2) + "\n" };
}

// Adds missing keys; unions arrays (a string is treated as a one-item array). Never removes or replaces a value.
export function mergeJson(current, add) {
  if (Array.isArray(add)) {
    const have = current === undefined ? [] : Array.isArray(current) ? current : [current];
    return [...have, ...add.filter((v) => !have.includes(v))];
  }
  if (add && typeof add === "object") {
    if (current !== undefined && (typeof current !== "object" || current === null || Array.isArray(current))) return current;
    const out = { ...(current ?? {}) };
    for (const [k, v] of Object.entries(add)) out[k] = mergeJson(out[k], v);
    return out;
  }
  return current === undefined ? add : current;
}

// ---------- applying ----------

const WRITES = new Set(["create", "update", "append-block", "replace-block", "append-lines", "merge-json", "set-mode"]);

export function apply({ dir, actions, record }, { providers, mode }) {
  const files = { ...(record?.files ?? {}) };
  for (const a of actions) {
    if (WRITES.has(a.action)) write(join(dir, a.path), a.content);
    if (a.action === "sidecar") write(join(dir, a.sidecar), a.content);
    if (a.record) files[a.path] = a.record;
  }
  const out = {
    $comment: "Written by `blueprint init`. Hashes of the files it installed, so a re-run can update files you haven't changed. Commit this file.",
    version: VERSION,
    providers: [...new Set([...(record?.providers ?? []), ...providers])],
    installedAt: record?.installedAt ?? new Date().toISOString().slice(0, 10),
    updatedAt: new Date().toISOString().slice(0, 10),
    files: Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b))),
  };
  write(join(dir, RECORD_FILE), JSON.stringify(out, null, 2) + "\n");
  return out;
}

function write(abs, content) {
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
}

export function summarize(actions) {
  const by = {};
  for (const a of actions) (by[a.action] ??= []).push(a);
  return by;
}

export const relativeTo = (from, p) => posix(relative(from, p)) || ".";

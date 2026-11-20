// Plans and applies a `blueprint init` / `blueprint upgrade`. Zero dependencies (Node >= 20).
// plan() only reads the target directory; apply() writes. Files that belong to the project are only changed
// inside our own marker block or by adding missing JSON keys. The only deletion is `upgrade` (prune: true)
// removing files an earlier version installed that are no longer part of the blueprint, and only when they
// are byte-for-byte what was installed.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AGENTS_MD_ONLY, BLOCK_END, BLOCK_START, CORE, LEGACY_RECORD_FILE, PROVIDERS, RECORD_FILE, SIDECAR_SUFFIX,
} from "./manifest.mjs";

export const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const VERSION = JSON.parse(readFileSync(join(PACKAGE_ROOT, "package.json"), "utf8")).version;

const posix = (p) => p.split(sep).join("/");
const sha = (s) => createHash("sha256").update(s).digest("hex");
const readText = (p) => readFileSync(p, "utf8");

export function listFiles(root, rel, only = null) {
  const abs = join(root, rel);
  if (!existsSync(abs)) return [];
  if (!statSync(abs).isDirectory()) return !only || only.test(rel) ? [rel] : [];
  return readdirSync(abs).sort().flatMap((name) => listFiles(root, posix(join(rel, name)), only));
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
  return {
    exists: existsSync(dir),
    empty: entries.length === 0,
    isGit: existsSync(join(dir, ".git")),
    installed: !!record,
    record,
    // Setups before 0.3 kept the record in governance/ and had GitHub Actions, scripts and templates.
    legacy: !!record?.legacy,
    detectedProviders: detected,
  };
}

function readRecord(dir) {
  try { return JSON.parse(readText(join(dir, RECORD_FILE))); } catch { /* fall through */ }
  try { return { ...JSON.parse(readText(join(dir, LEGACY_RECORD_FILE))), legacy: true }; } catch { return null; }
}

// ---------- providers ----------

export function normalizeProviders(list) {
  const ids = [];
  const notes = [];
  const unknown = [];
  for (const raw of list) {
    const id = raw.trim().toLowerCase();
    if (!id || id === "none") continue;
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
 * @param {"skip"|"sidecar"} opts.conflicts what to do with a conflicting managed file
 */
export function plan(dir, { providers = [], conflicts = "skip" } = {}) {
  const record = readRecord(dir);
  const recorded = record?.files ?? {};
  const entries = [...CORE];
  for (const id of providers) entries.push(...PROVIDERS[id].files);

  const actions = [];
  for (const entry of entries) {
    if (entry.strategy === "json") { actions.push(planJson(dir, entry)); continue; }
    const sources = listFiles(PACKAGE_ROOT, entry.path, entry.only);
    if (!sources.length) throw new Error(`package is missing ${entry.path}`);
    for (const src of sources) {
      const content = readText(join(PACKAGE_ROOT, src));
      actions.push(planFile(dir, src, content, entry.strategy, recorded[src], { conflicts }));
    }
  }
  return { dir, actions, record, obsolete: planObsolete(dir, actions, recorded) };
}

function planFile(dir, target, content, strategy, recordedHash, { conflicts }) {
  const abs = join(dir, target);
  const base = { path: target, strategy };
  if (!existsSync(abs)) return { ...base, action: "create", content, record: sha(content) };
  const current = readText(abs);

  if (current === content) return { ...base, action: "unchanged", record: sha(content) };
  // Seeds are the project's from the moment they're written. Only a copy nobody has touched since it was
  // installed (still the old template) is refreshed.
  if (strategy === "seed") return recordedHash && sha(current) === recordedHash ? { ...base, action: "update", content, record: sha(content) } : { ...base, action: "keep" };

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

// Files an earlier install recorded that this plan no longer installs: the GitHub Actions, scripts, templates
// and governance docs of versions before 0.3, or a provider file that was renamed. Unchanged ones can be
// pruned; edited ones are kept and reported.
function planObsolete(dir, actions, recorded) {
  const planned = new Set(actions.map((a) => a.path));
  const out = [];
  for (const [path, hash] of Object.entries(recorded)) {
    if (planned.has(path)) continue;
    const abs = join(dir, path);
    if (!existsSync(abs)) out.push({ path, action: "forget" });
    else if (KEEP.includes(path)) out.push({ path, action: "release" });
    else if (sha(readText(abs)) === hash) out.push({ path, action: "remove" });
    else out.push({ path, action: "edited" });
  }
  // Keep the old scripts while anything that stays still calls them (a workflow you edited, or your own
  // package.json scripts).
  const removing = new Set(out.filter((o) => o.action === "remove").map((o) => o.path));
  const scripts = out.filter((o) => o.action === "remove" && o.path.startsWith("scripts/"));
  if (scripts.length) {
    const callers = [...listFiles(dir, ".github/workflows"), ...listFiles(dir, ".github/actions"), "package.json"]
      .filter((p) => !removing.has(p) && existsSync(join(dir, p)) && /scripts\/(governance|ci|setup)\//.test(readText(join(dir, p))));
    if (callers.length) for (const o of scripts) { o.action = "edited"; o.reason = `still called from ${callers.join(", ")}`; }
  }
  return out;
}

// Files older versions installed that the project may well rely on for other reasons. They're no longer
// managed, but they are never removed.
const KEEP = [".gitignore", ".github/CODEOWNERS"];

// ---------- applying ----------

const WRITES = new Set(["create", "update", "append-block", "replace-block", "merge-json"]);

export function apply({ dir, actions, record, obsolete = [] }, { providers, prune = false }) {
  const files = { ...(record?.files ?? {}) };
  for (const a of actions) {
    if (WRITES.has(a.action)) write(join(dir, a.path), a.content);
    if (a.action === "sidecar") write(join(dir, a.sidecar), a.content);
    if (a.record) files[a.path] = a.record;
  }
  for (const o of obsolete) {
    if (o.action === "forget" || o.action === "release") delete files[o.path];
    if (o.action === "remove" && prune) { remove(dir, o.path); delete files[o.path]; }
  }
  const out = {
    $comment: "Written by `blueprint init`. Hashes of the files it installed, so `blueprint upgrade` can update files you haven't changed. Commit this file.",
    version: VERSION,
    providers: [...new Set([...(record?.providers ?? []), ...providers])],
    installedAt: record?.installedAt ?? new Date().toISOString().slice(0, 10),
    updatedAt: new Date().toISOString().slice(0, 10),
    files: Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b))),
  };
  write(join(dir, RECORD_FILE), JSON.stringify(out, null, 2) + "\n");
  // The record has moved to blueprint/; `upgrade` removes the old one.
  if (prune && existsSync(join(dir, LEGACY_RECORD_FILE))) remove(dir, LEGACY_RECORD_FILE);
  return out;
}

// Deletes the file, then any parent folders it leaves empty (never the target folder itself).
function remove(dir, path) {
  unlinkSync(join(dir, path));
  for (let d = dirname(path); d && d !== "."; d = dirname(d)) {
    try { if (readdirSync(join(dir, d)).length) break; rmdirSync(join(dir, d)); } catch { break; }
  }
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

// Plans and applies a `blueprint init`. Zero dependencies (Node >= 20).
// plan() only reads the target directory; apply() writes. Files that belong to the project are only changed
// inside our own marker block or by appending missing lines / JSON keys. The only deletion is `upgrade`
// (prune: true) removing files an earlier version installed that this layout no longer needs, and only
// when they are byte-for-byte what was installed.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AGENTS_MD_ONLY, BLOCK_END, BLOCK_START, CLI_PATTERN, CORE, EXCLUDE, PROVIDERS, RECORD_FILE, SIDECAR_SUFFIX,
  VENDOR, VENDOR_CLI, VENDOR_DIR, cliCommand,
} from "./manifest.mjs";

export const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const VERSION = JSON.parse(readFileSync(join(PACKAGE_ROOT, "package.json"), "utf8")).version;

const posix = (p) => p.split(sep).join("/");
const sha = (s) => createHash("sha256").update(s).digest("hex");
const readText = (p) => readFileSync(p, "utf8");

export function listFiles(root, rel, only = null) {
  const abs = join(root, rel);
  if (!existsSync(abs)) return [];
  if (EXCLUDE.some((re) => re.test(rel))) return [];
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
    // Installs before 0.3 copied scripts/, templates/ and the workflow specs into the project and have no layout.
    layout: record ? (record.layout ?? "legacy") : null,
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
 * @param {"lean"|"vendor"} opts.layout lean: the package runs the checks; vendor: a copy lives in .blueprint/
 */
export function plan(dir, { providers = [], mode = null, owner = null, conflicts = "skip", layout = "lean" } = {}) {
  const record = readRecord(dir);
  const recorded = record?.files ?? {};
  const entries = [...CORE];
  for (const id of providers) entries.push(...PROVIDERS[id].files);
  if (layout === "vendor") entries.push(...VENDOR.map((e) => ({ ...e, prefix: `${VENDOR_DIR}/` })));

  const actions = [];
  for (const entry of entries) {
    if (entry.strategy === "json") { actions.push(planJson(dir, entry)); continue; }
    const sources = entry.target ? [entry.path] : listFiles(PACKAGE_ROOT, entry.path, entry.only);
    if (!sources.length) throw new Error(`package is missing ${entry.path}`);
    for (const src of sources) {
      const target = entry.target ?? (entry.prefix ?? "") + src;
      let content = readText(join(PACKAGE_ROOT, src));
      content = transform(target, content, { owner, mode, layout });
      actions.push(planFile(dir, target, content, entry.strategy, recorded[target], { conflicts, mode, owner }));
    }
  }
  return { dir, actions, record, layout, obsolete: planObsolete(dir, actions, recorded) };
}

// The CLI call written into instruction files, prompts and workflows for this layout.
export const cliFor = (layout) => (layout === "vendor" ? VENDOR_CLI : cliCommand(VERSION));

function transform(target, content, { owner, mode, layout }) {
  if (target === ".github/CODEOWNERS" && owner) content = content.replaceAll("@OWNER", owner);
  if (target === "governance/config.json") content = withMode(content, mode ?? "enforce");
  if (target === `${VENDOR_DIR}/package.json`) {
    // Only what the vendored CLI needs (its version). Not a package anyone installs.
    const pkg = JSON.parse(content);
    return JSON.stringify({ $comment: "Vendored copy of the product-blueprint CLI (`blueprint init --vendor`). Upgrade with `blueprint upgrade`; don't edit.", name: pkg.name, version: pkg.version, private: true, type: pkg.type }, null, 2) + "\n";
  }
  // Pin the CLI call to this version (or to the vendored copy). The action's npx fallback stays an npx call.
  const cli = target === ".github/actions/setup-blueprint/action.yml" ? cliCommand(VERSION) : cliFor(layout);
  return content.replace(CLI_PATTERN, cli);
}

// Files an earlier install recorded that this plan no longer installs (e.g. scripts/ from 0.2, or .blueprint/
// when switching back from --vendor). Unchanged ones can be pruned; edited ones are kept and reported.
function planObsolete(dir, actions, recorded) {
  const planned = new Set(actions.map((a) => a.path));
  const out = [];
  for (const [path, hash] of Object.entries(recorded)) {
    if (planned.has(path)) continue;
    const abs = join(dir, path);
    if (!existsSync(abs)) out.push({ path, action: "forget" });
    else if (sha(readText(abs)) === hash) out.push({ path, action: "remove" });
    else out.push({ path, action: "edited" });
  }
  // Don't remove the old scripts while anything that stays still calls them (a workflow you edited, which
  // kept its old version as a conflict, or your own scripts in package.json).
  const removing = out.filter((o) => o.action === "remove" && o.path.startsWith("scripts/"));
  if (removing.length) {
    const after = (p) => {
      const a = actions.find((x) => x.path === p);
      if (a && "content" in a && !["sidecar", "conflict"].includes(a.action)) return a.content;
      try { return readText(join(dir, p)); } catch { return ""; }
    };
    const callers = [...listFiles(dir, ".github/workflows"), ...listFiles(dir, ".github/actions"), "package.json"]
      .filter((p) => /scripts\/(governance|ci|setup)\//.test(after(p)));
    for (const o of removing) { o.action = "edited"; o.reason = `still called from ${callers.join(", ")}`; }
    if (!callers.length) for (const o of removing) { o.action = "remove"; delete o.reason; }
  }
  return out;
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

export function apply({ dir, actions, record, layout, obsolete = [] }, { providers, prune = false }) {
  const files = { ...(record?.files ?? {}) };
  for (const a of actions) {
    if (WRITES.has(a.action)) write(join(dir, a.path), a.content);
    if (a.action === "sidecar") write(join(dir, a.sidecar), a.content);
    if (a.record) files[a.path] = a.record;
  }
  for (const o of obsolete) {
    if (o.action === "forget") delete files[o.path];
    if (o.action === "remove" && prune) { remove(dir, o.path); delete files[o.path]; }
  }
  const out = {
    $comment: "Written by `blueprint init`. Hashes of the files it installed, so a re-run can update files you haven't changed. Commit this file.",
    version: VERSION,
    layout,
    providers: [...new Set([...(record?.providers ?? []), ...providers])],
    installedAt: record?.installedAt ?? new Date().toISOString().slice(0, 10),
    updatedAt: new Date().toISOString().slice(0, 10),
    files: Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b))),
  };
  write(join(dir, RECORD_FILE), JSON.stringify(out, null, 2) + "\n");
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

export const relativeTo = (from, p) => posix(relative(from, p)) || ".";

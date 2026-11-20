// The commands a project runs through the package instead of keeping copies of the scripts:
// check, guard, facts, run, setup-github, new, docs, prompt. Zero dependencies (Node >= 20).
// Every command works on the current directory (the project root), wherever the package itself lives
// (npx cache, node_modules, or a vendored .blueprint/ copy).
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { CLI_PATTERN, RECORD_FILE } from "./manifest.mjs";
import { PACKAGE_ROOT, VERSION } from "./install.mjs";

const pkg = (...p) => join(PACKAGE_ROOT, ...p);

// ---------- scripts ----------

export const CHECKS = {
  blueprint: { script: "check-blueprint.mjs", what: "blueprint structure, front matter, IDs and references" },
  protected: { script: "check-protected.mjs", what: "approved specs changed only with the approval label" },
  impact: { script: "check-impact.mjs", what: "the PR's Blueprint impact table against the changed files" },
  trace: { script: "trace.mjs", what: "acceptance criteria ↔ tests" },
  terminology: { script: "terminology.mjs", what: "glossary terms from the Avoid column" },
};
// `check` without a name runs the ones that need no PR context.
export const DEFAULT_CHECKS = ["blueprint", "trace", "terminology"];

function node(script, args) {
  const res = spawnSync(process.execPath, [script, ...args], { stdio: "inherit" });
  return res.status ?? 1;
}

export function check(args) {
  warnVersion();
  const [name, ...rest] = args;
  if (name && !name.startsWith("-") && name !== "all") {
    const c = CHECKS[name];
    if (!c) throw new UsageError(`unknown check "${name}". Known: ${Object.keys(CHECKS).join(", ")}, all`);
    return node(pkg("scripts/governance", c.script), rest);
  }
  const names = name === "all" ? Object.keys(CHECKS) : DEFAULT_CHECKS;
  const extra = name === "all" ? rest : args;
  let status = 0;
  for (const n of names) status = Math.max(status, node(pkg("scripts/governance", CHECKS[n].script), extra));
  return status;
}

export const guard = (args) => node(pkg("scripts/governance/guard-paths.mjs"), args);
export const facts = (args) => node(pkg("scripts/governance/health-facts.mjs"), args);
export const run = (args) => node(pkg("scripts/ci/run.mjs"), args);

export function setupGithub(args) {
  const res = spawnSync("bash", [pkg("scripts/setup/configure-github.sh"), ...args], { stdio: "inherit" });
  if (res.error) throw new Error(`setup-github needs bash and the GitHub CLI (gh): ${res.error.message}`);
  return res.status ?? 1;
}

// A project on another version than the one running gets a hint, not a failure.
function warnVersion() {
  try {
    const installed = JSON.parse(readFileSync(RECORD_FILE, "utf8")).version;
    if (installed && installed !== VERSION) {
      console.error(`note: this repository was set up with product-blueprint ${installed}; running ${VERSION}. Use npx product-blueprint@${installed}, or run \`blueprint upgrade\`.`);
    }
  } catch { /* not set up, or no record */ }
}

// ---------- new ----------

const today = () => new Date().toISOString().slice(0, 10);
const slug = (s) => s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 60);

export const KINDS = {
  feature: { what: "feature spec with acceptance criteria", dir: "blueprint/features", prefix: "FEAT", width: 3, template: "blueprint/features/_TEMPLATE.md", title: "<Short feature name>" },
  adr: { what: "architecture decision record", dir: "blueprint/decisions", prefix: "ADR", width: 4, template: "blueprint/decisions/_TEMPLATE.md", title: "<Decision in a few words>" },
  deviation: { what: "recorded blueprint ↔ implementation difference", dir: "blueprint/deviations", prefix: "DEV", width: 3, template: "blueprint/deviations/_TEMPLATE.md", title: "<What differs, in a few words>", shortTitle: "<What differs>" },
  openapi: { what: "OpenAPI starter (WF-04)", template: "templates/openapi.yaml", target: "contracts/openapi.yaml" },
  "dependency-cruiser": { what: "module boundary rules for check:architecture (WF-05, WF-03)", template: "templates/dependency-cruiser.cjs", target: ".dependency-cruiser.cjs" },
  "visual-test": { what: "Playwright visual regression starter for test:visual (WF-02)", template: "templates/visual.spec.ts", target: "tests/visual/visual.spec.ts" },
  "package-scripts": { what: "the script contract CI calls; printed, merge into package.json yourself", template: "templates/package-scripts.json", print: true },
};

function nextId(kind) {
  const k = KINDS[kind];
  const re = new RegExp(`^${k.prefix}-(\\d{${k.width}})`);
  const used = existsSync(k.dir) ? readdirSync(k.dir).map((f) => re.exec(f)?.[1]).filter(Boolean).map(Number) : [];
  return `${k.prefix}-${String(Math.max(0, ...used) + 1).padStart(k.width, "0")}`;
}

/** Creates a file from a template. Returns the path written, or null when printed. */
export function newFile(kind, words, { out = console.log } = {}) {
  const k = KINDS[kind];
  if (!k) throw new UsageError(`unknown kind "${kind ?? ""}". Known: ${Object.keys(KINDS).join(", ")}`);
  let text = readFileSync(pkg(k.template), "utf8");
  if (k.print) { out(text.trimEnd()); return null; }
  let target = k.target;
  if (k.prefix) {
    const title = words.join(" ").trim();
    if (!title) throw new UsageError(`give a title: blueprint new ${kind} "<title>"`);
    const id = nextId(kind);
    const zero = `${k.prefix}-${"0".repeat(k.width)}`;
    // Acceptance criteria, including the examples in the template's comments, belong to the new ID.
    text = text.replaceAll(zero, id).replace(/\bAC-\d{3}\./g, `AC-${id.slice(5)}.`)
      .replaceAll(k.title, title).replaceAll(k.shortTitle ?? k.title, title)
      .replace(/^(date|recorded): \d{4}-\d{2}-\d{2}$/m, `$1: ${today()}`)
      // The template's "Copy to …-nnn-name.md" hint is done by now.
      .replace(/^(<!--\s*)?Copy to [^\n]*?\.md[^.\n]*\.\s*/m, (m, open) => (open ? "<!-- " : ""));
    target = `${k.dir}/${id}-${slug(title) || "untitled"}.md`;
  }
  if (existsSync(target)) throw new Error(`${target} already exists; nothing written`);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, text);
  out(`Created ${target}`);
  return target;
}

// ---------- docs and prompts ----------

export const DOCS = {
  governance: { file: "governance/README.md", what: "rules, ownership, workflows, script contract, phases, enforcement mode" },
  conventions: { file: "blueprint/README.md", what: "blueprint documents, IDs, statuses and writing conventions" },
  "WF-00": { file: "governance/workflows/WF-00-onboarding.md", what: "onboarding: fill the blueprint from an existing codebase" },
  "WF-01": { file: "governance/workflows/WF-01-feature-definition.md", what: "product & feature definition" },
  "WF-02": { file: "governance/workflows/WF-02-ux-sync.md", what: "UX & design sync" },
  "WF-03": { file: "governance/workflows/WF-03-architecture-integrity.md", what: "architecture & data integrity" },
  "WF-04": { file: "governance/workflows/WF-04-api-contracts.md", what: "API contract sync" },
  "WF-05": { file: "governance/workflows/WF-05-quality-gate.md", what: "code quality gate" },
  "WF-06": { file: "governance/workflows/WF-06-blueprint-sync.md", what: "blueprint sync after merges" },
  "WF-07": { file: "governance/workflows/WF-07-drift-audit.md", what: "drift audit and health report" },
  "health-report": { file: "governance/health-report-template.md", what: "template for the WF-07 health report" },
  prototypes: { file: "blueprint/prototypes/README.md", what: "how to store UX prototypes" },
  contracts: { file: "contracts/README.md", what: "API contracts (OpenAPI) conventions" },
  templates: { file: "templates/README.md", what: "starters available through `blueprint new`" },
  lovable: { file: "governance/agents/lovable-knowledge.md", what: "text to paste into Lovable's project Knowledge" },
};

export function docKey(name) {
  if (!name) return null;
  const n = name.trim();
  const wf = /^(?:wf-?)?0?(\d)$/i.exec(n) ?? /^wf-?0(\d)\b/i.exec(n);
  if (wf) return `WF-0${wf[1]}`;
  const lower = n.toLowerCase();
  if (DOCS[lower]) return lower;
  if (lower === "onboarding") return "WF-00";
  return Object.keys(DOCS).find((k) => DOCS[k].file.toLowerCase().includes(lower)) ?? null;
}

export function docs([name], { out = console.log } = {}) {
  if (!name) {
    out(`blueprint ${VERSION} · documentation served by the package (blueprint docs <name>)\n`);
    for (const [k, d] of Object.entries(DOCS)) out(`  ${k.padEnd(14)} ${d.what}`);
    return 0;
  }
  const key = docKey(name);
  if (!key) throw new UsageError(`no document "${name}". Run "blueprint docs" for the list.`);
  out(withCli(readFileSync(pkg(DOCS[key].file), "utf8")).trimEnd());
  return 0;
}

export function listPrompts() {
  const local = existsSync(".claude/commands") ? readdirSync(".claude/commands") : [];
  const ours = readdirSync(pkg(".claude/commands"));
  return [...new Set([...ours, ...local])].filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3)).sort();
}

// The AI workflow instructions. The project's own .claude/commands/<name>.md wins, so a project that edits
// a command gets the same behaviour locally (as a Claude Code slash command) and in CI.
export function prompt([name, ...args], { out = console.log } = {}) {
  if (!name) {
    out("Prompts (blueprint prompt <name> [arguments]):");
    for (const p of listPrompts()) out(`  ${p}`);
    return 0;
  }
  const file = name.replace(/\.md$/, "") + ".md";
  const local = join(".claude/commands", file);
  const source = existsSync(local) ? local : pkg(".claude/commands", file);
  if (!existsSync(source)) throw new UsageError(`no prompt "${name}". Known: ${listPrompts().join(", ")}`);
  let text = readFileSync(source, "utf8").replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n+/, "");
  text = text.replaceAll("$ARGUMENTS", args.join(" "));
  out(withCli(text).trimEnd());
  return 0;
}

// In CI, setup-blueprint puts the exact CLI call in $BLUEPRINT. Printed instructions use that call, so they
// match the allowed tools of the AI step whether the CLI comes from npm or from a vendored copy.
const withCli = (text) => (process.env.BLUEPRINT ? text.replace(CLI_PATTERN, process.env.BLUEPRINT) : text);

export class UsageError extends Error {}

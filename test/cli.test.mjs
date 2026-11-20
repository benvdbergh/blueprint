// Tests for `blueprint init` and `blueprint upgrade` (bin/blueprint.mjs). Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const BIN = join(ROOT, "bin/blueprint.mjs");

const ENV = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("GITHUB_")));
const tmp = () => mkdtempSync(join(tmpdir(), "blueprint-test-"));
const bp = (cwd, ...args) => spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: "utf8", env: ENV });
const cli = (cwd, ...args) => {
  const res = bp(cwd, ...args);
  assert.equal(res.status, 0, res.stderr + res.stdout);
  return res.stdout;
};
const run = (dir, ...args) => cli(dir, "init", dir, "--yes", ...args);
const upgrade = (dir, ...args) => cli(dir, "upgrade", dir, "--yes", ...args);
const read = (dir, p) => readFileSync(join(dir, p), "utf8");
const put = (dir, p, s) => { mkdirSync(join(dir, p, ".."), { recursive: true }); writeFileSync(join(dir, p), s); };
const sha = (s) => createHash("sha256").update(s).digest("hex");
const record = (dir) => JSON.parse(read(dir, "blueprint/.install.json"));

const WORKFLOWS = ["align.md", "audit.md", "define-feature.md", "onboard.md", "review.md", "sync.md"];

test("empty folder: AGENTS.md, the blueprint documents and the workflow instructions, nothing else", () => {
  const dir = tmp();
  run(dir);
  assert.deepEqual(readdirSync(dir).sort(), [".claude", "AGENTS.md", "CLAUDE.md", "blueprint"]);
  assert.deepEqual(readdirSync(join(dir, "blueprint/workflows")).sort(), WORKFLOWS);
  for (const f of ["00-product-core.md", "07-roadmap.md", "README.md", ".install.json"]) assert.ok(existsSync(join(dir, "blueprint", f)), f);
  assert.deepEqual(readdirSync(join(dir, ".claude/commands")).sort(), WORKFLOWS.map((w) => `blueprint-${w}`));
  for (const f of ["package.json", "bin", "cli", "test", ".github", "scripts", "governance", "LICENSE", "CHANGELOG.md"]) {
    assert.ok(!existsSync(join(dir, f)), `${f} belongs to this package, not to projects`);
  }
});

test("the instructions only point at files that exist in a project", () => {
  const dir = tmp();
  run(dir, "--providers", "claude,cursor,copilot");
  const texts = ["AGENTS.md", "CLAUDE.md", ".cursor/rules/blueprint.mdc", ".github/copilot-instructions.md", "blueprint/README.md",
    ...WORKFLOWS.map((w) => `blueprint/workflows/${w}`), ...readdirSync(join(dir, ".claude/commands")).map((f) => `.claude/commands/${f}`)];
  for (const f of texts) {
    const text = read(dir, f);
    assert.doesNotMatch(text, /scripts\/|governance\/|\.github\/workflows\/wf|npx product-blueprint@|_TEMPLATE\.md|\bWF-0\d\b/, `${f} refers to something that no longer exists`);
    for (const [, path] of text.matchAll(/`(blueprint\/workflows\/[\w-]+\.md)`/g)) assert.ok(existsSync(join(dir, path)), `${f} → ${path}`);
  }
});

test("workflow instructions say when they run, what they may change and how they end", () => {
  for (const w of WORKFLOWS) {
    const text = readFileSync(join(ROOT, "blueprint/workflows", w), "utf8");
    assert.match(text, /^# /, w);
    for (const part of ["**Run:**", "**Changes:**", "**Ends with:**", "## Goal"]) assert.ok(text.includes(part), `${w} has ${part}`);
  }
});

test("existing repo: nothing of the app's is overwritten; instruction files get a marked block", () => {
  const dir = tmp();
  put(dir, "package.json", JSON.stringify({ name: "app", devDependencies: { "lovable-tagger": "1.0.0" } }));
  put(dir, "src/main.ts", "console.log('app')\n");
  put(dir, "AGENTS.md", "# My app\n\nUse pnpm.\n");
  put(dir, "blueprint/workflows/sync.md", "my own sync\n");

  const out = run(dir, "--providers", "claude,copilot,gemini,lovable");
  assert.match(out, /Existing repository/);
  assert.equal(read(dir, "package.json"), JSON.stringify({ name: "app", devDependencies: { "lovable-tagger": "1.0.0" } }));
  assert.equal(read(dir, "src/main.ts"), "console.log('app')\n");
  assert.equal(read(dir, "blueprint/workflows/sync.md"), "my own sync\n", "conflict is left alone");
  assert.match(out, /Conflicts, left as they are[\s\S]*blueprint\/workflows\/sync\.md/);

  const agents = read(dir, "AGENTS.md");
  assert.ok(agents.startsWith("# My app\n\nUse pnpm.\n"), "own content kept on top");
  assert.match(agents, /<!-- blueprint:start[\s\S]*## Rules[\s\S]*<!-- blueprint:end -->/);
  assert.ok(existsSync(join(dir, ".github/copilot-instructions.md")));
  assert.deepEqual(JSON.parse(read(dir, ".gemini/settings.json")), { context: { fileName: ["AGENTS.md", "GEMINI.md"] } });
  assert.match(out, /Paste this into Lovable[\s\S]*blueprint\/03-domain-data\.md/);
  assert.match(out, /follow blueprint\/workflows\/onboard\.md.*\/blueprint-onboard/);
});

test("re-running is idempotent and keeps edited files", () => {
  const dir = tmp();
  put(dir, "README.md", "# app\n");
  put(dir, "AGENTS.md", "# My app\n");
  run(dir);
  const agents = read(dir, "AGENTS.md");
  put(dir, "blueprint/00-product-core.md", "my product core\n");
  put(dir, "blueprint/workflows/audit.md", "# my audit\n");

  const out = run(dir);
  assert.match(out, /Already set up/);
  assert.equal(read(dir, "AGENTS.md"), agents, "block replaced in place, not appended twice");
  assert.equal(read(dir, "blueprint/00-product-core.md"), "my product core\n", "edited documents are never touched");
  assert.equal(read(dir, "blueprint/workflows/audit.md"), "# my audit\n", "edited workflow is a conflict");
  assert.match(out, /create 0 /);
});

test("upgrade refreshes files that weren't edited since they were installed, documents included", () => {
  const dir = tmp();
  run(dir);
  const r = record(dir);
  for (const f of ["blueprint/workflows/sync.md", "blueprint/03-domain-data.md"]) {
    put(dir, f, "# old version\n");
    r.files[f] = sha("# old version\n");
  }
  writeFileSync(join(dir, "blueprint/.install.json"), JSON.stringify(r));
  const out = upgrade(dir);
  assert.match(out, /Updated \(unchanged since the last install\)[\s\S]*blueprint\/03-domain-data\.md[\s\S]*sync\.md/);
  assert.equal(read(dir, "blueprint/workflows/sync.md"), readFileSync(join(ROOT, "blueprint/workflows/sync.md"), "utf8"));
  assert.equal(read(dir, "blueprint/03-domain-data.md"), readFileSync(join(ROOT, "blueprint/03-domain-data.md"), "utf8"));
});

test("upgrade adds a workflow and command that are new since the last install", () => {
  const dir = tmp();
  run(dir);
  const r = record(dir);
  for (const f of ["blueprint/workflows/align.md", ".claude/commands/blueprint-align.md"]) {
    rmSync(join(dir, f));
    delete r.files[f];
  }
  writeFileSync(join(dir, "blueprint/.install.json"), JSON.stringify(r));
  upgrade(dir);
  assert.equal(read(dir, "blueprint/workflows/align.md"), readFileSync(join(ROOT, "blueprint/workflows/align.md"), "utf8"));
  assert.ok(existsSync(join(dir, ".claude/commands/blueprint-align.md")));
  assert.ok(record(dir).files["blueprint/workflows/align.md"], "recorded for the next upgrade");
});

test("--conflicts sidecar writes our version next to the conflicting file", () => {
  const dir = tmp();
  put(dir, "blueprint/workflows/review.md", "mine\n");
  run(dir, "--conflicts", "sidecar");
  assert.equal(read(dir, "blueprint/workflows/review.md"), "mine\n");
  assert.equal(read(dir, "blueprint/workflows/review.md.blueprint-new"), readFileSync(join(ROOT, "blueprint/workflows/review.md"), "utf8"));
});

test("--dry-run writes nothing", () => {
  const dir = tmp();
  assert.match(run(dir, "--dry-run"), /Dry run/);
  assert.deepEqual(readdirSync(dir), []);
});

test("gemini settings merge keeps existing keys and file names", () => {
  const dir = tmp();
  put(dir, ".gemini/settings.json", JSON.stringify({ theme: "dark", context: { fileName: "CONTEXT.md" } }));
  run(dir, "--providers", "gemini");
  assert.deepEqual(JSON.parse(read(dir, ".gemini/settings.json")), { theme: "dark", context: { fileName: ["CONTEXT.md", "AGENTS.md", "GEMINI.md"] } });
});

test("codex is accepted and needs nothing beyond AGENTS.md; unknown providers and old options fail", () => {
  const dir = tmp();
  const out = run(dir, "--providers", "codex");
  assert.match(out, /codex: OpenAI Codex reads AGENTS\.md directly/);
  assert.ok(!existsSync(join(dir, "CLAUDE.md")));
  const bad = bp(tmp(), "init", ".", "--yes", "--providers", "nope");
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /unknown provider/);
  assert.equal(bp(tmp(), "init", ".", "--yes", "--mode", "report").status, 2);
  assert.equal(bp(tmp(), "check").status, 2, "the check commands are gone");
});

// What 0.2 installed: Actions, scripts, templates, governance docs, the record in governance/.
function legacySetup(dir) {
  const files = {
    ".github/workflows/wf05-governance-gate.yml": "run: node scripts/governance/check-blueprint.mjs\n",
    ".github/workflows/wf06-blueprint-sync.yml": "name: WF-06\n",
    ".github/actions/setup-project/action.yml": "run: node scripts/ci/run.mjs --detect\n",
    ".github/pull_request_template.md": "## Blueprint impact\n",
    ".github/CODEOWNERS": "* @ben\n",
    ".gitignore": "node_modules/\n.env\n",
    ".claude/commands/wf06-blueprint-sync.md": "old command\n",
    ".cursor/rules/governance.mdc": "old rule\n",
    "scripts/governance/lib.mjs": "// lib\n",
    "scripts/ci/run.mjs": "// run\n",
    "templates/openapi.yaml": "openapi: 3.1.0\n",
    "contracts/README.md": "# Contracts\n",
    "governance/README.md": "# Governance\n",
    "governance/config.json": "{}\n",
    "governance/workflows/WF-06-blueprint-sync.md": "# WF-06\n",
    "blueprint/features/_TEMPLATE.md": "---\nid: FEAT-000\n---\n",
    "blueprint/03-domain-data.md": "old 03 template\n",
  };
  for (const [f, text] of Object.entries(files)) put(dir, f, text);
  put(dir, "blueprint/01-product.md", "our product, written by us\n");
  put(dir, "AGENTS.md", "old agents\n");
  const hashes = Object.fromEntries(Object.entries(files).map(([f, t]) => [f, sha(t)]));
  hashes["blueprint/01-product.md"] = sha("01 as installed\n");
  hashes["AGENTS.md"] = sha("old agents\n");
  put(dir, "governance/.blueprint-install.json", JSON.stringify({ version: "0.2.0", providers: ["claude", "cursor"], installedAt: "2026-11-01", files: hashes }));
}

test("upgrade from 0.2 removes the Actions, scripts and templates it installed, and keeps what you edited", () => {
  const dir = tmp();
  legacySetup(dir);
  put(dir, "templates/openapi.yaml", "openapi: 3.1.0\n# edited\n");

  const initOut = run(dir);
  assert.match(initOut, /from before 0\.3/);
  assert.match(initOut, /run "blueprint upgrade" to remove them/);
  assert.ok(existsSync(join(dir, "scripts/governance/lib.mjs")), "init never deletes");
  assert.ok(existsSync(join(dir, "blueprint/.install.json")));

  const out = upgrade(dir);
  for (const f of [".github/workflows", ".github/actions", ".github/pull_request_template.md", "scripts", "contracts", "governance",
    ".claude/commands/wf06-blueprint-sync.md", ".cursor/rules/governance.mdc", "blueprint/features"]) {
    assert.ok(!existsSync(join(dir, f)), `${f} removed`);
  }
  assert.match(out, /kept[\s\S]*templates\/openapi\.yaml \(edited/);
  assert.equal(read(dir, "templates/openapi.yaml"), "openapi: 3.1.0\n# edited\n");
  assert.match(initOut, /left in place[\s\S]*\.github\/CODEOWNERS[\s\S]*\.gitignore/);
  assert.equal(read(dir, ".gitignore"), "node_modules/\n.env\n", ".gitignore is never removed");
  assert.equal(read(dir, ".github/CODEOWNERS"), "* @ben\n");
  assert.equal(read(dir, "blueprint/01-product.md"), "our product, written by us\n", "filled documents stay");
  assert.equal(read(dir, "blueprint/03-domain-data.md"), readFileSync(join(ROOT, "blueprint/03-domain-data.md"), "utf8"), "untouched template refreshed");
  assert.match(read(dir, "AGENTS.md"), /blueprint\/workflows\/sync\.md/);
  assert.ok(existsSync(join(dir, ".cursor/rules/blueprint.mdc")) && existsSync(join(dir, ".claude/commands/blueprint-sync.md")));
  assert.deepEqual(Object.keys(record(dir).files).filter((f) => /^(scripts|governance|\.github)\//.test(f)), []);
  assert.equal(bp(tmp(), "upgrade", "--yes").status, 2, "upgrade needs an existing setup");
});

test("upgrade keeps the old scripts while a workflow you edited still calls them", () => {
  const dir = tmp();
  legacySetup(dir);
  put(dir, ".github/workflows/wf05-governance-gate.yml", "# mine\nrun: node scripts/governance/check-blueprint.mjs\n");
  const out = upgrade(dir);
  assert.match(out, /scripts\/governance\/lib\.mjs \(still called from \.github\/workflows\/wf05-governance-gate\.yml\)/);
  assert.ok(existsSync(join(dir, "scripts/governance/lib.mjs")));
  assert.ok(!existsSync(join(dir, ".github/workflows/wf06-blueprint-sync.yml")), "unedited workflows still go");
});

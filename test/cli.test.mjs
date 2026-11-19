// Tests for `blueprint init` (bin/blueprint.mjs). Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const BIN = join(ROOT, "bin/blueprint.mjs");

// Child processes must not see the CI runner's GitHub variables (annotations, base ref, step summary).
const ENV = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("GITHUB_") && k !== "GOVERNANCE_ENFORCEMENT"));
const tmp = () => mkdtempSync(join(tmpdir(), "blueprint-test-"));
const run = (dir, ...args) => {
  const res = spawnSync(process.execPath, [BIN, "init", dir, "--yes", ...args], { encoding: "utf8", env: ENV });
  assert.equal(res.status, 0, res.stderr + res.stdout);
  return res.stdout;
};
const read = (dir, p) => readFileSync(join(dir, p), "utf8");
const put = (dir, p, s) => { mkdirSync(join(dir, p, ".."), { recursive: true }); writeFileSync(join(dir, p), s); };
const config = (dir) => JSON.parse(read(dir, "governance/config.json"));

test("empty folder: full install in enforce mode with the default provider", () => {
  const dir = tmp();
  run(dir);
  for (const f of ["AGENTS.md", "CLAUDE.md", "blueprint/00-product-core.md", "governance/config.json", "scripts/governance/lib.mjs",
    ".github/workflows/wf05-governance-gate.yml", ".claude/commands/impact-analysis.md", ".gitignore", "governance/.blueprint-install.json"]) {
    assert.ok(existsSync(join(dir, f)), `${f} should exist`);
  }
  assert.equal(config(dir).enforcement, "enforce");
  assert.ok(!existsSync(join(dir, ".cursor")), "cursor not selected");
  assert.ok(!existsSync(join(dir, "package.json")), "the scaffolder's own package.json is not installed");
  assert.ok(!existsSync(join(dir, "cli")) && !existsSync(join(dir, "bin")), "the CLI itself is not installed");
  for (const f of [".github/workflows/package-ci.yml", ".github/workflows/package-release.yml", "LICENSE", "CHANGELOG.md", "CONTRIBUTING.md", "SECURITY.md"]) {
    assert.ok(!existsSync(join(dir, f)), `${f} belongs to this repository, not to projects`);
  }
});

test("the installed governance checks run green in the new folder", () => {
  const dir = tmp();
  run(dir);
  execFileSync(process.execPath, ["scripts/governance/check-blueprint.mjs"], { cwd: dir, encoding: "utf8", env: ENV });
  execFileSync(process.execPath, ["scripts/governance/trace.mjs"], { cwd: dir, encoding: "utf8", env: ENV });
});

test("existing repo: nothing of the app's is overwritten; instruction files get a marked block", () => {
  const dir = tmp();
  put(dir, "package.json", JSON.stringify({ name: "app", devDependencies: { "lovable-tagger": "1.0.0" } }));
  put(dir, "src/main.ts", "console.log('app')\n");
  put(dir, "AGENTS.md", "# My app\n\nUse pnpm.\n");
  put(dir, ".gitignore", "node_modules\n.env\n");
  put(dir, ".github/workflows/wf05-quality-gate.yml", "name: mine\n");
  put(dir, ".github/pull_request_template.md", "## Summary\n");

  const out = run(dir, "--providers", "claude,copilot,gemini,lovable");
  assert.match(out, /Existing repository/);
  assert.equal(read(dir, "package.json"), JSON.stringify({ name: "app", devDependencies: { "lovable-tagger": "1.0.0" } }));
  assert.equal(read(dir, "src/main.ts"), "console.log('app')\n");
  assert.equal(read(dir, ".github/workflows/wf05-quality-gate.yml"), "name: mine\n", "conflict is left alone");
  assert.match(out, /Conflicts, left as they are[\s\S]*wf05-quality-gate\.yml/);

  const agents = read(dir, "AGENTS.md");
  assert.ok(agents.startsWith("# My app\n\nUse pnpm.\n"), "own content kept on top");
  assert.match(agents, /<!-- blueprint:start[\s\S]*Non-negotiable rules[\s\S]*<!-- blueprint:end -->/);
  assert.match(read(dir, ".github/pull_request_template.md"), /^## Summary[\s\S]*\| 00 Product Core \| none \|/);

  const gi = read(dir, ".gitignore");
  assert.ok(gi.startsWith("node_modules\n.env\n"));
  assert.match(gi, /\.governance-out\//);
  assert.equal(gi.match(/^node_modules\/?$/gm).length, 1, "no duplicate lines (node_modules and node_modules/ are the same)");

  assert.equal(config(dir).enforcement, "report", "existing repo defaults to report mode");
  assert.ok(existsSync(join(dir, ".github/copilot-instructions.md")));
  assert.ok(existsSync(join(dir, "governance/agents/lovable-knowledge.md")));
  assert.deepEqual(JSON.parse(read(dir, ".gemini/settings.json")), { context: { fileName: ["AGENTS.md", "GEMINI.md"] } });
});

test("re-running is idempotent and keeps edited files", () => {
  const dir = tmp();
  put(dir, "README.md", "# app\n");
  put(dir, "AGENTS.md", "# My app\n");
  run(dir);
  const agents = read(dir, "AGENTS.md");
  put(dir, "blueprint/00-product-core.md", "my product core\n");
  put(dir, "scripts/governance/trace.mjs", "// locally patched\n");

  const out = run(dir);
  assert.match(out, /Already set up/);
  assert.equal(read(dir, "AGENTS.md"), agents, "block replaced in place, not appended twice");
  assert.equal(read(dir, "blueprint/00-product-core.md"), "my product core\n", "seed files are never touched again");
  assert.equal(read(dir, "scripts/governance/trace.mjs"), "// locally patched\n", "edited managed file is a conflict");
  assert.match(out, /create 0 /);
  assert.equal(config(dir).enforcement, "report", "re-run keeps the mode");
});

test("re-run updates managed files that weren't edited since install", () => {
  const dir = tmp();
  run(dir);
  const recordPath = join(dir, "governance/.blueprint-install.json");
  const record = JSON.parse(readFileSync(recordPath, "utf8"));
  // Simulate an older install: the file on disk matches what that older version wrote.
  put(dir, "scripts/governance/trace.mjs", "// old version\n");
  record.files["scripts/governance/trace.mjs"] = createHash("sha256").update("// old version\n").digest("hex");
  writeFileSync(recordPath, JSON.stringify(record));
  const out = run(dir);
  assert.match(out, /Updated \(unchanged since the last install\)[\s\S]*scripts\/governance\/trace\.mjs/);
  assert.equal(read(dir, "scripts/governance/trace.mjs"), readFileSync(join(ROOT, "scripts/governance/trace.mjs"), "utf8"));
});

test("--conflicts sidecar writes our version next to the conflicting file", () => {
  const dir = tmp();
  put(dir, ".github/ISSUE_TEMPLATE/config.yml", "blank_issues_enabled: false\n");
  run(dir, "--conflicts", "sidecar");
  assert.equal(read(dir, ".github/ISSUE_TEMPLATE/config.yml"), "blank_issues_enabled: false\n");
  assert.equal(read(dir, ".github/ISSUE_TEMPLATE/config.yml.blueprint-new"), readFileSync(join(ROOT, ".github/ISSUE_TEMPLATE/config.yml"), "utf8"));
});

test("--mode, --owner and --dry-run", () => {
  const dir = tmp();
  const out = run(dir, "--dry-run");
  assert.match(out, /Dry run/);
  assert.ok(!existsSync(join(dir, "AGENTS.md")));

  run(dir, "--owner", "@ben");
  assert.doesNotMatch(read(dir, ".github/CODEOWNERS"), /@OWNER/);
  assert.match(read(dir, ".github/CODEOWNERS"), /^\*\s+@ben$/m);
  run(dir, "--mode", "report");
  assert.equal(config(dir).enforcement, "report");
});

test("gemini settings merge keeps existing keys and file names", () => {
  const dir = tmp();
  put(dir, ".gemini/settings.json", JSON.stringify({ theme: "dark", context: { fileName: "CONTEXT.md" } }));
  run(dir, "--providers", "gemini");
  assert.deepEqual(JSON.parse(read(dir, ".gemini/settings.json")), { theme: "dark", context: { fileName: ["CONTEXT.md", "AGENTS.md", "GEMINI.md"] } });
});

test("codex is accepted and needs nothing beyond AGENTS.md; unknown providers fail", () => {
  const dir = tmp();
  const out = run(dir, "--providers", "codex");
  assert.match(out, /codex: OpenAI Codex reads AGENTS\.md directly/);
  assert.ok(!existsSync(join(dir, "CLAUDE.md")));
  const bad = spawnSync(process.execPath, [BIN, "init", tmp(), "--yes", "--providers", "nope"], { encoding: "utf8", env: ENV });
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /unknown provider/);
});

test("report mode: gate checks print but don't fail; guard checks still fail", () => {
  const dir = tmp();
  run(dir, "--mode", "report");
  // An approved-looking feature without acceptance criteria is a check-blueprint error.
  put(dir, "blueprint/features/FEAT-001-x.md", "---\nid: FEAT-001\ntitle: X\nstatus: approved\nowner: me\n---\n\n## Acceptance criteria\n");
  const res = spawnSync(process.execPath, ["scripts/governance/check-blueprint.mjs"], { cwd: dir, encoding: "utf8", env: ENV });
  assert.equal(res.status, 0, res.stdout);
  assert.match(res.stdout, /WOULD FAIL[\s\S]*report mode: not failing/);
  const enforced = spawnSync(process.execPath, ["scripts/governance/check-blueprint.mjs"], { cwd: dir, encoding: "utf8", env: { ...ENV, GOVERNANCE_ENFORCEMENT: "enforce" } });
  assert.equal(enforced.status, 1);
});

test("in a pull request the mode comes from the base branch, so a PR can't switch its own gate off", () => {
  const dir = tmp();
  run(dir, "--mode", "enforce");
  const git = (...a) => execFileSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...a], { cwd: dir, encoding: "utf8", env: ENV });
  git("init", "-q", "-b", "main");
  git("add", "-A");
  git("commit", "-qm", "base");
  git("update-ref", "refs/remotes/origin/main", "HEAD");
  run(dir, "--mode", "report"); // the PR's change
  put(dir, "blueprint/features/FEAT-001-x.md", "---\nid: FEAT-001\ntitle: X\nstatus: approved\nowner: me\n---\n\n## Acceptance criteria\n");
  const env = { ...ENV, GITHUB_BASE_REF: "main" };
  const res = spawnSync(process.execPath, ["scripts/governance/check-blueprint.mjs"], { cwd: dir, encoding: "utf8", env });
  assert.equal(res.status, 1, res.stdout);
});

test("existing repo: init points to the onboarding step; an empty folder doesn't", () => {
  const existing = tmp();
  put(existing, "src/main.ts", "console.log('app')\n");
  const out = run(existing, "--providers", "cursor");
  assert.match(out, /governance\/workflows\/WF-00-onboarding\.md.*\/wf00-onboard/);
  assert.ok(existsSync(join(existing, "governance/workflows/WF-00-onboarding.md")));
  assert.ok(existsSync(join(existing, ".claude/commands/wf00-onboard.md")));
  assert.doesNotMatch(run(tmp()), /WF-00/);
});

test("guard-paths --workflow WF-00 allows blueprint 01-07, ADRs, config and AGENTS.md, never 00 or code", () => {
  const dir = tmp();
  run(dir);
  const git = (...a) => execFileSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...a], { cwd: dir, encoding: "utf8", env: ENV });
  git("init", "-q", "-b", "main");
  git("add", "-A");
  git("commit", "-qm", "base");
  const guard = () => spawnSync(process.execPath, ["scripts/governance/guard-paths.mjs", "--workflow", "WF-00"], { cwd: dir, encoding: "utf8", env: ENV });
  for (const f of ["blueprint/03-domain-data.md", "blueprint/07-roadmap.md", "AGENTS.md"]) put(dir, f, read(dir, f) + "\nx\n");
  put(dir, "governance/config.json", read(dir, "governance/config.json").replace('"supabase/migrations/**"', '"db/schema/**"'));
  put(dir, "blueprint/decisions/ADR-0001-x.md", "x\n");
  assert.equal(guard().status, 0, guard().stdout);
  put(dir, "blueprint/00-product-core.md", "changed\n");
  put(dir, "src/app.ts", "x\n");
  const res = guard();
  assert.equal(res.status, 1);
  assert.match(res.stdout, /00-product-core\.md/);
  assert.match(res.stdout, /src\/app\.ts/);
});

test("the package's gitignore payload matches this repository's .gitignore", () => {
  assert.equal(readFileSync(join(ROOT, "cli/gitignore.txt"), "utf8"), readFileSync(join(ROOT, ".gitignore"), "utf8"));
});

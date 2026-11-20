// Tests for `blueprint init` (bin/blueprint.mjs). Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const BIN = join(ROOT, "bin/blueprint.mjs");

// Child processes must not see the CI runner's GitHub variables (annotations, base ref, step summary).
const ENV = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("GITHUB_") && k !== "GOVERNANCE_ENFORCEMENT"));
const tmp = () => mkdtempSync(join(tmpdir(), "blueprint-test-"));
const run = (dir, ...args) => cli(dir, "init", dir, "--yes", ...args);
const upgrade = (dir, ...args) => cli(dir, "upgrade", dir, "--yes", ...args);
// Runs the CLI in `cwd`, as a project would through npx; fails the test on a non-zero exit.
const cli = (cwd, ...args) => {
  const res = bp(cwd, ...args);
  assert.equal(res.status, 0, res.stderr + res.stdout);
  return res.stdout;
};
const bp = (cwd, ...args) => spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: "utf8", env: ENV });
const VERSION = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version;
const read = (dir, p) => readFileSync(join(dir, p), "utf8");
const put = (dir, p, s) => { mkdirSync(join(dir, p, ".."), { recursive: true }); writeFileSync(join(dir, p), s); };
const config = (dir) => JSON.parse(read(dir, "governance/config.json"));

test("empty folder: lean install in enforce mode with the default provider", () => {
  const dir = tmp();
  run(dir);
  for (const f of ["AGENTS.md", "CLAUDE.md", "blueprint/00-product-core.md", "blueprint/README.md", "governance/config.json",
    ".github/workflows/wf05-governance-gate.yml", ".github/actions/setup-blueprint/action.yml", ".claude/commands/impact-analysis.md",
    ".gitignore", "governance/.blueprint-install.json"]) {
    assert.ok(existsSync(join(dir, f)), `${f} should exist`);
  }
  // Checks, starters and workflow specs stay in the package.
  for (const f of ["scripts", "templates", "contracts", "governance/workflows", "governance/README.md", "governance/agents",
    "blueprint/features", "blueprint/decisions", "blueprint/deviations", "blueprint/prototypes", ".blueprint"]) {
    assert.ok(!existsSync(join(dir, f)), `${f} should not be installed`);
  }
  assert.deepEqual(readdirSync(join(dir, "governance")).sort(), [".blueprint-install.json", "config.json"]);
  assert.equal(JSON.parse(read(dir, "governance/.blueprint-install.json")).layout, "lean");
  assert.equal(config(dir).enforcement, "enforce");
  assert.ok(!existsSync(join(dir, ".cursor")), "cursor not selected");
  assert.ok(!existsSync(join(dir, "package.json")), "the scaffolder's own package.json is not installed");
  assert.ok(!existsSync(join(dir, "cli")) && !existsSync(join(dir, "bin")), "the CLI itself is not installed");
  for (const f of [".github/workflows/package-ci.yml", ".github/workflows/package-release.yml", "LICENSE", "CHANGELOG.md", "CONTRIBUTING.md", "SECURITY.md"]) {
    assert.ok(!existsSync(join(dir, f)), `${f} belongs to this repository, not to projects`);
  }
});

test("the governance checks run green from the package in the new folder", () => {
  const dir = tmp();
  run(dir);
  assert.match(cli(dir, "check"), /check-blueprint\): 0 error[\s\S]*trace\): 0 error[\s\S]*terminology\): 0 error/);
  cli(dir, "check", "blueprint");
  cli(dir, "check", "trace");
  assert.equal(bp(dir, "check", "nope").status, 2);
});

test("workflows and instruction files call the CLI pinned to this version", () => {
  const dir = tmp();
  run(dir, "--providers", "claude,cursor,copilot");
  const pin = `npx product-blueprint@${VERSION}`;
  assert.match(read(dir, ".github/actions/setup-blueprint/action.yml"), new RegExp(pin.replace(/[.@]/g, "\\$&")));
  for (const f of ["AGENTS.md", ".cursor/rules/governance.mdc", ".github/copilot-instructions.md", ".claude/commands/wf01-define-feature.md"]) {
    assert.ok(read(dir, f).includes(pin), `${f} uses ${pin}`);
  }
  for (const f of readdirSync(join(dir, ".github/workflows"))) {
    const text = read(dir, `.github/workflows/${f}`);
    assert.doesNotMatch(text, /scripts\/(governance|ci)\/|\.claude\/commands\//, `${f} must not need local copies`);
  }
  assert.match(read(dir, ".github/workflows/wf05-governance-gate.yml"), /\$BLUEPRINT check blueprint/);
});

test("every product-blueprint@x.y.z in the package matches package.json (run cli/stamp-version.mjs after a bump)", () => {
  const out = execFileSync(process.execPath, [join(ROOT, "cli/stamp-version.mjs"), "--check"], { cwd: ROOT, encoding: "utf8" });
  assert.match(out, /up to date/);
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
  assert.ok(!existsSync(join(dir, "governance/agents")), "Lovable's text is printed by `blueprint docs lovable`");
  assert.match(out, /docs lovable/);
  assert.deepEqual(JSON.parse(read(dir, ".gemini/settings.json")), { context: { fileName: ["AGENTS.md", "GEMINI.md"] } });
});

test("re-running is idempotent and keeps edited files", () => {
  const dir = tmp();
  put(dir, "README.md", "# app\n");
  put(dir, "AGENTS.md", "# My app\n");
  run(dir);
  const agents = read(dir, "AGENTS.md");
  put(dir, "blueprint/00-product-core.md", "my product core\n");
  put(dir, ".github/workflows/wf07-drift-audit.yml", "# locally patched\n");

  const out = run(dir);
  assert.match(out, /Already set up/);
  assert.equal(read(dir, "AGENTS.md"), agents, "block replaced in place, not appended twice");
  assert.equal(read(dir, "blueprint/00-product-core.md"), "my product core\n", "seed files are never touched again");
  assert.equal(read(dir, ".github/workflows/wf07-drift-audit.yml"), "# locally patched\n", "edited managed file is a conflict");
  assert.match(out, /create 0 /);
  assert.equal(config(dir).enforcement, "report", "re-run keeps the mode");
});

test("re-run updates managed files that weren't edited since install", () => {
  const dir = tmp();
  run(dir);
  const recordPath = join(dir, "governance/.blueprint-install.json");
  const record = JSON.parse(readFileSync(recordPath, "utf8"));
  // Simulate an older install: the file on disk matches what that older version wrote.
  const wf = ".github/workflows/wf07-drift-audit.yml";
  put(dir, wf, "# old version\n");
  record.files[wf] = createHash("sha256").update("# old version\n").digest("hex");
  writeFileSync(recordPath, JSON.stringify(record));
  const out = run(dir);
  assert.match(out, /Updated \(unchanged since the last install\)[\s\S]*wf07-drift-audit\.yml/);
  assert.equal(read(dir, wf), readFileSync(join(ROOT, wf), "utf8"));
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
  const res = bp(dir, "check", "blueprint");
  assert.equal(res.status, 0, res.stdout);
  assert.match(res.stdout, /WOULD FAIL[\s\S]*report mode: not failing/);
  const enforced = spawnSync(process.execPath, [BIN, "check", "blueprint"], { cwd: dir, encoding: "utf8", env: { ...ENV, GOVERNANCE_ENFORCEMENT: "enforce" } });
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
  const res = spawnSync(process.execPath, [BIN, "check", "blueprint"], { cwd: dir, encoding: "utf8", env });
  assert.equal(res.status, 1, res.stdout);
});

test("existing repo: init points to the onboarding step; an empty folder doesn't", () => {
  const existing = tmp();
  put(existing, "src/main.ts", "console.log('app')\n");
  const out = run(existing, "--providers", "cursor");
  assert.match(out, /docs WF-00.*\/wf00-onboard/);
  assert.match(read(existing, "AGENTS.md"), new RegExp(`npx product-blueprint@${VERSION.replace(/\./g, "\\.")} docs WF-00`));
  assert.match(cli(existing, "docs", "WF-00"), /^# WF-00 · Onboarding/);
  assert.ok(!existsSync(join(existing, ".claude")), ".claude/commands come with the claude provider");
  assert.doesNotMatch(run(tmp()), /WF-00/);
});

test("guard-paths --workflow WF-00 allows blueprint 01-07, ADRs, config and AGENTS.md, never 00 or code", () => {
  const dir = tmp();
  run(dir);
  const git = (...a) => execFileSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...a], { cwd: dir, encoding: "utf8", env: ENV });
  git("init", "-q", "-b", "main");
  git("add", "-A");
  git("commit", "-qm", "base");
  const guard = () => bp(dir, "guard", "--workflow", "WF-00");
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

test("new: features, ADRs and deviations get the next free ID and pass the blueprint check", () => {
  const dir = tmp();
  run(dir);
  assert.match(cli(dir, "new", "feature", "Export to CSV"), /Created blueprint\/features\/FEAT-001-export-to-csv\.md/);
  assert.match(cli(dir, "new", "feature", "Second one"), /FEAT-002-second-one\.md/);
  const feat = read(dir, "blueprint/features/FEAT-002-second-one.md");
  assert.match(feat, /^id: FEAT-002$/m);
  assert.match(feat, /^# FEAT-002 · Second one$/m);
  assert.match(feat, /^- AC-002\.1: /m);
  assert.doesNotMatch(feat, /Copy to/);
  assert.match(cli(dir, "new", "adr", "Use Supabase"), /ADR-0001-use-supabase\.md/);
  assert.match(cli(dir, "new", "deviation", "Soft delete"), /DEV-001-soft-delete\.md/);
  assert.match(read(dir, "blueprint/decisions/ADR-0001-use-supabase.md"), new RegExp(`^date: ${new Date().toISOString().slice(0, 10)}$`, "m"));
  cli(dir, "check", "blueprint");
  cli(dir, "new", "openapi");
  assert.ok(existsSync(join(dir, "contracts/openapi.yaml")));
  assert.equal(bp(dir, "new", "openapi").status, 1, "never overwrites");
  assert.match(cli(dir, "new", "package-scripts"), /"check:architecture"/);
  assert.equal(bp(dir, "new", "feature").status, 2, "needs a title");
});

test("prompt: the project's own .claude/commands copy wins, and $BLUEPRINT replaces the npx call", () => {
  const dir = tmp();
  run(dir, "--providers", "none");
  const res = spawnSync(process.execPath, [BIN, "prompt", "wf01-define-feature", "42"], { cwd: dir, encoding: "utf8", env: { ...ENV, BLUEPRINT: "node .blueprint/bin/blueprint.mjs" } });
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /^# WF-01/, "front matter is stripped");
  assert.match(res.stdout, /Request: 42/);
  assert.match(res.stdout, /`node \.blueprint\/bin\/blueprint\.mjs new feature/);
  put(dir, ".claude/commands/wf01-define-feature.md", "---\ndescription: x\n---\nmy own steps for $ARGUMENTS\n");
  assert.equal(cli(dir, "prompt", "wf01-define-feature", "7").trim(), "my own steps for 7");
});

test("--vendor: a copy of the CLI in .blueprint/ that the instruction files and CI use", () => {
  const dir = tmp();
  run(dir, "--vendor");
  for (const f of [".blueprint/bin/blueprint.mjs", ".blueprint/scripts/governance/lib.mjs", ".blueprint/templates/openapi.yaml",
    ".blueprint/governance/workflows/WF-00-onboarding.md", ".blueprint/blueprint/features/_TEMPLATE.md", ".blueprint/package.json"]) {
    assert.ok(existsSync(join(dir, f)), `${f} should exist`);
  }
  assert.ok(!existsSync(join(dir, "scripts")) && !existsSync(join(dir, "templates")), "nothing at the top level besides .blueprint/");
  assert.match(read(dir, "AGENTS.md"), /node \.blueprint\/bin\/blueprint\.mjs check blueprint/);
  assert.doesNotMatch(read(dir, "AGENTS.md"), /npx product-blueprint/);
  const vendored = (...args) => {
    const res = spawnSync(process.execPath, [".blueprint/bin/blueprint.mjs", ...args], { cwd: dir, encoding: "utf8", env: ENV });
    assert.equal(res.status, 0, res.stderr + res.stdout);
    return res.stdout;
  };
  assert.equal(vendored("--version").trim(), VERSION);
  vendored("check");
  vendored("new", "feature", "Vendored");
  vendored("check", "blueprint");
  // A re-run keeps the layout; --lean switches back and `upgrade` removes the copy.
  assert.match(run(dir), /unchanged/);
  assert.equal(JSON.parse(read(dir, "governance/.blueprint-install.json")).layout, "vendor");
  assert.match(upgrade(dir, "--lean"), /No longer needed, removed[\s\S]*\.blueprint\/bin\/blueprint\.mjs/);
  assert.ok(!existsSync(join(dir, ".blueprint")));
  assert.match(read(dir, "AGENTS.md"), /npx product-blueprint@/);
});

test("upgrade from a pre-0.3 install removes unedited copies of scripts, templates and specs", () => {
  const dir = tmp();
  run(dir);
  // Recreate what 0.2 installed: copies of scripts/, templates/ and the workflow specs, recorded by hash.
  const recordPath = join(dir, "governance/.blueprint-install.json");
  const record = JSON.parse(readFileSync(recordPath, "utf8"));
  delete record.layout;
  record.version = "0.2.0";
  const legacy = ["scripts/governance/lib.mjs", "scripts/ci/run.mjs", "templates/openapi.yaml", "governance/README.md", "governance/workflows/WF-00-onboarding.md", "blueprint/features/_TEMPLATE.md"];
  for (const f of legacy) {
    const text = readFileSync(join(ROOT, f), "utf8");
    put(dir, f, text);
    record.files[f] = createHash("sha256").update(text).digest("hex");
  }
  put(dir, "templates/openapi.yaml", "# edited\n");
  writeFileSync(recordPath, JSON.stringify(record));

  const initOut = run(dir);
  assert.match(initOut, /from before 0\.3/);
  assert.match(initOut, /run "blueprint upgrade" to remove them/);
  assert.ok(existsSync(join(dir, "scripts/governance/lib.mjs")), "init itself never deletes");

  const out = upgrade(dir);
  assert.match(out, /No longer needed, removed[\s\S]*scripts\/governance\/lib\.mjs/);
  assert.match(out, /kept[\s\S]*templates\/openapi\.yaml \(edited/);
  for (const f of legacy.filter((f) => f !== "templates/openapi.yaml")) assert.ok(!existsSync(join(dir, f)), `${f} removed`);
  assert.ok(!existsSync(join(dir, "scripts")), "empty folders go too");
  assert.equal(read(dir, "templates/openapi.yaml"), "# edited\n");
  assert.equal(JSON.parse(readFileSync(recordPath, "utf8")).layout, "lean");
  assert.equal(bp(tmp(), "upgrade", "--yes").status, 2, "upgrade needs an existing setup");
});

test("upgrade keeps the old scripts while an edited workflow still calls them", () => {
  const dir = tmp();
  run(dir);
  const recordPath = join(dir, "governance/.blueprint-install.json");
  const record = JSON.parse(readFileSync(recordPath, "utf8"));
  const text = readFileSync(join(ROOT, "scripts/governance/lib.mjs"), "utf8");
  put(dir, "scripts/governance/lib.mjs", text);
  record.files["scripts/governance/lib.mjs"] = createHash("sha256").update(text).digest("hex");
  writeFileSync(recordPath, JSON.stringify(record));
  put(dir, ".github/workflows/wf05-governance-gate.yml", "run: node scripts/governance/check-blueprint.mjs\n");
  const out = upgrade(dir);
  assert.match(out, /scripts\/governance\/lib\.mjs \(still called from \.github\/workflows\/wf05-governance-gate\.yml\)/);
  assert.ok(existsSync(join(dir, "scripts/governance/lib.mjs")));
});

test("docs lists and prints the served documents", () => {
  const dir = tmp();
  assert.match(cli(dir, "docs"), /WF-07/);
  assert.match(cli(dir, "docs", "governance"), /^# Engineering Governance/);
  assert.match(cli(dir, "docs", "wf7"), /^# WF-07/);
  assert.match(cli(dir, "docs", "lovable"), /Lovable project knowledge/);
  assert.equal(bp(dir, "docs", "nope").status, 2);
});

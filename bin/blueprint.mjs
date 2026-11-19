#!/usr/bin/env node
// blueprint: installs the Product Engineering Blueprint (blueprint docs, governance scripts, CI workflows and
// agent instructions) into an empty folder or an existing repository.
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout, exit, argv } from "node:process";
import { AGENTS_MD_ONLY, DEFAULT_PROVIDERS, PROVIDERS, SIDECAR_SUFFIX } from "../cli/manifest.mjs";
import { VERSION, apply, inspectTarget, normalizeProviders, plan, summarize } from "../cli/install.mjs";

const HELP = `blueprint ${VERSION}

Usage
  blueprint init [dir] [options]

Sets up blueprint/, governance/, scripts/, the CI workflows and agent instruction files in [dir]
(default: the current folder). Works in an empty folder and in an existing repository. Existing files
are never overwritten: instruction files get a marked block appended, .gitignore gets missing lines,
and anything else that already exists is reported as a conflict and left alone.

Options
  --providers <list>   Agent tools to add instruction files for, comma-separated:
                       ${Object.keys(PROVIDERS).join(", ")} (or "none"). AGENTS.md is always installed.
                       Default: detected from the repo, else ${DEFAULT_PROVIDERS.join(",")}.
  --mode <mode>        report   governance checks print what would fail but never block (default
                                for an existing repository)
                       enforce  governance checks fail the build (default for an empty folder)
  --owner <@handle>    Replace @OWNER in .github/CODEOWNERS
  --conflicts <how>    skip     leave conflicting files alone and list them (default)
                       sidecar  also write our version next to them as <file>${SIDECAR_SUFFIX}
  --dry-run            Show what would happen; write nothing
  -y, --yes            Don't ask; use the options and defaults
  -h, --help           Show this help
  -v, --version        Show the version

Examples
  npx github:benvdbergh/blueprint init my-product --owner @me
  npx github:benvdbergh/blueprint init --providers claude,cursor,copilot --mode report --dry-run`;

function parseArgs(args) {
  const o = { _: [], yes: false, dryRun: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const [flag, inline] = a.startsWith("--") && a.includes("=") ? [a.slice(0, a.indexOf("=")), a.slice(a.indexOf("=") + 1)] : [a, null];
    const value = () => {
      if (inline !== null) return inline;
      const v = args[++i];
      if (v === undefined || v.startsWith("-")) fail(`${flag} needs a value`);
      return v;
    };
    switch (flag) {
      case "-h": case "--help": o.help = true; break;
      case "-v": case "--version": o.version = true; break;
      case "-y": case "--yes": o.yes = true; break;
      case "--dry-run": o.dryRun = true; break;
      case "--providers": o.providers = value(); break;
      case "--mode": o.mode = value(); break;
      case "--owner": o.owner = value(); break;
      case "--conflicts": o.conflicts = value(); break;
      default:
        if (a.startsWith("-")) fail(`unknown option ${a}`);
        o._.push(a);
    }
  }
  return o;
}

function fail(msg) {
  console.error(`blueprint: ${msg}\nRun "blueprint --help" for usage.`);
  exit(2);
}

async function ask(rl, question, fallback) {
  const answer = (await rl.question(`${question} [${fallback}] `)).trim();
  return answer || fallback;
}

async function main() {
  const o = parseArgs(argv.slice(2));
  if (o.version) { console.log(VERSION); return; }
  const [command = "init", dirArg = "."] = o._;
  if (o.help || command === "help") { console.log(HELP); return; }
  if (command !== "init") fail(`unknown command "${command}"`);
  if (o._.length > 2) fail(`unexpected argument "${o._[2]}"`);
  if (o.mode && !["report", "enforce"].includes(o.mode)) fail(`--mode must be report or enforce`);
  if (o.conflicts && !["skip", "sidecar"].includes(o.conflicts)) fail(`--conflicts must be skip or sidecar`);
  if (o.owner && !/^@[\w.\/-]+$/.test(o.owner)) fail(`--owner must look like @handle or @org/team`);

  const dir = resolve(dirArg);
  const t = inspectTarget(dir);
  const existingRepo = !t.empty && !t.installed;
  const interactive = !o.yes && stdin.isTTY && stdout.isTTY;

  let providerInput = o.providers ?? (t.record?.providers ?? (t.detectedProviders.length ? t.detectedProviders : DEFAULT_PROVIDERS)).join(",");
  // Only a fresh install picks a default mode; a re-run keeps what governance/config.json says unless --mode is given.
  let mode = o.mode ?? (t.mode ? null : existingRepo ? "report" : "enforce");

  console.log(`blueprint ${VERSION} → ${dir}`);
  console.log(t.empty ? "Empty folder: full setup." : t.installed ? `Already set up (version ${t.record.version}): upgrading.` : "Existing repository: existing files are kept.");

  if (interactive) {
    const rl = createInterface({ input: stdin, output: stdout });
    console.log("\nAGENTS.md is always installed. OpenAI Codex, Cursor and Copilot's coding agent read it directly.");
    console.log("Extra instruction files are available for:");
    for (const [id, p] of Object.entries(PROVIDERS)) console.log(`  ${id.padEnd(8)} ${p.label}: ${p.why}`);
    providerInput = await ask(rl, "\nProviders (comma-separated, or none)?", providerInput || "none");
    if (!o.mode && !t.mode) {
      mode = await ask(rl, "Mode: report (checks never block) or enforce?", mode);
      if (!["report", "enforce"].includes(mode)) { rl.close(); fail("mode must be report or enforce"); }
    }
    rl.close();
  }

  const { ids: providers, notes, unknown } = normalizeProviders(providerInput.split(","));
  if (unknown.length) fail(`unknown provider(s): ${unknown.join(", ")}. Known: ${[...Object.keys(PROVIDERS), ...Object.keys(AGENTS_MD_ONLY)].join(", ")}`);

  const p = plan(dir, { providers, mode, owner: o.owner ?? null, conflicts: o.conflicts ?? "skip" });
  const by = summarize(p.actions);
  report(by, notes);

  if (o.dryRun) { console.log("\nDry run: nothing was written."); return; }
  apply(p, { providers, mode });
  nextSteps({ t, by, providers, mode: mode ?? t.mode ?? "enforce", owner: o.owner, dir, existingRepo });
}

function report(by, notes) {
  const n = (k) => by[k]?.length ?? 0;
  const line = (label, k, detail = (a) => a.path) => {
    if (!n(k)) return;
    console.log(`\n${label} (${n(k)})`);
    for (const a of by[k]) console.log(`  ${detail(a)}`);
  };
  console.log("");
  console.log(`create ${n("create")} · update ${n("update")} · merge ${n("append-block") + n("replace-block") + n("append-lines") + n("merge-json")} · unchanged ${n("unchanged")} · kept ${n("keep")} · conflicts ${n("conflict") + n("sidecar")}`);
  line("Merged into existing files", "append-block", (a) => `${a.path}: appended a marked blueprint block`);
  line("Refreshed blocks", "replace-block", (a) => `${a.path}: replaced the blueprint block`);
  line("Added lines", "append-lines", (a) => `${a.path}: ${a.added.join(" ")}`);
  line("Merged JSON", "merge-json");
  line("Mode", "set-mode", (a) => `${a.path}: enforcement ${a.from} → ${a.to}`);
  line("Updated (unchanged since the last install)", "update", (a) => a.reason ? `${a.path}: ${a.reason}` : a.path);
  line("Conflicts, left as they are", "conflict", (a) => a.reason ? `${a.path} (${a.reason})` : a.path);
  line("Conflicts, our version written next to them", "sidecar", (a) => `${a.path} → ${a.sidecar}`);
  if (n("conflict")) console.log(`  Compare and merge by hand, or re-run with --conflicts sidecar to get our version as <file>${SIDECAR_SUFFIX}.`);
  for (const note of notes) console.log(`\nNote: ${note}`);
}

function nextSteps({ t, by, providers, mode, owner, dir, existingRepo }) {
  const steps = [];
  if (!t.isGit) steps.push(`git init (the governance checks compare branches with git)`);
  if (existingRepo) {
    steps.push(`Let your agent draft the blueprint from this codebase: ask it to "follow governance/workflows/WF-00-onboarding.md" (in Claude Code: /wf00-onboard). It also fills the "Project specifics" in AGENTS.md and opens one PR to review.`);
    steps.push("Write blueprint/00-product-core.md yourself (the onboarding PR suggests a draft), then review and approve the other documents.");
  } else {
    steps.push("Fill in blueprint/00-product-core.md, then 01 and 07.");
  }
  if (!existingRepo) steps.push(`Fill in the "Project specifics" section of AGENTS.md (stack, install, dev server).`);
  const codeowners = by.create?.some((a) => a.path === ".github/CODEOWNERS");
  steps.push(`On GitHub: scripts/setup/configure-github.sh ${codeowners && !owner ? "--codeowner @your-handle " : ""}--reviews 0  (labels + branch protection; --reviews 0 for solo projects)`);
  steps.push("For the AI workflows: gh secret set ANTHROPIC_API_KEY");
  if (providers.includes("lovable")) steps.push("Paste governance/agents/lovable-knowledge.md into Lovable → Project settings → Knowledge.");
  if (mode === "report") steps.push(`Report mode is on: governance checks list what would fail without blocking. When the team is ready, set "enforcement": "enforce" in governance/config.json (or re-run with --mode enforce).`);
  steps.push("Commit everything, including governance/.blueprint-install.json, through a pull request.");
  console.log(`\nDone. Next steps:`);
  steps.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));
}

main().catch((err) => { console.error(`blueprint: ${err.message}`); exit(1); });

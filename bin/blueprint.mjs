#!/usr/bin/env node
// blueprint: adds the Product Engineering Blueprint (blueprint documents, workflow instructions for agents and
// the shared agent instructions) to an empty folder or an existing repository, and upgrades it later.
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout, exit, argv } from "node:process";
import { AGENTS_MD_ONLY, DEFAULT_PROVIDERS, PROVIDERS, SIDECAR_SUFFIX } from "../cli/manifest.mjs";
import { PACKAGE_ROOT, VERSION, apply, inspectTarget, normalizeProviders, plan, summarize } from "../cli/install.mjs";

const HELP = `blueprint ${VERSION}

Usage
  blueprint init [dir] [options]      add the blueprint to [dir] (default: the current folder)
  blueprint upgrade [dir] [options]   update an existing setup, and remove files older versions installed
                                      that are no longer needed (only if you haven't edited them)

init adds AGENTS.md (+ instruction files for your agent tools), the blueprint documents in blueprint/ and
the workflow instructions in blueprint/workflows/ that agents follow on demand or as scheduled tasks.
Existing files are never overwritten: instruction files get a marked block appended, and anything else
that already exists is reported as a conflict and left alone.

Options
  --providers <list>   Agent tools to add instruction files for, comma-separated:
                       ${Object.keys(PROVIDERS).join(", ")} (or "none"). AGENTS.md is always installed.
                       Default: detected from the repo, else ${DEFAULT_PROVIDERS.join(",")}.
  --conflicts <how>    skip     leave conflicting files alone and list them (default)
                       sidecar  also write our version next to them as <file>${SIDECAR_SUFFIX}
  --dry-run            Show what would happen; write nothing
  -y, --yes            Don't ask; use the options and defaults
  -h, --help           Show this help
  -v, --version        Show the version

Examples
  npx product-blueprint init my-product
  npx product-blueprint init --providers claude,cursor,copilot --dry-run
  npx product-blueprint@latest upgrade`;

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
  const [cmd = "init", dirArg = "."] = o._;
  if (o.help || cmd === "help") { console.log(HELP); return; }
  if (cmd !== "init" && cmd !== "upgrade") fail(`unknown command "${cmd}"`);
  if (o._.length > 2) fail(`unexpected argument "${o._[2]}"`);
  if (o.conflicts && !["skip", "sidecar"].includes(o.conflicts)) fail(`--conflicts must be skip or sidecar`);

  const dir = resolve(dirArg);
  const t = inspectTarget(dir);
  const upgrade = cmd === "upgrade";
  if (upgrade && !t.installed) fail(`${dir} isn't set up yet (no blueprint/.install.json). Run "blueprint init" first.`);
  const existingRepo = !t.empty && !t.installed;
  const interactive = !o.yes && stdin.isTTY && stdout.isTTY;

  let providerInput = o.providers ?? (t.record?.providers ?? (t.detectedProviders.length ? t.detectedProviders : DEFAULT_PROVIDERS)).join(",");

  console.log(`blueprint ${VERSION} → ${dir}`);
  console.log(t.empty ? "Empty folder: full setup." : t.installed ? `Already set up (version ${t.record.version}): upgrading.` : "Existing repository: existing files are kept.");
  if (t.legacy) console.log("This setup is from before 0.3. The GitHub Actions, scripts and templates it installed are no longer used: the workflows are now instructions in blueprint/workflows/.");

  if (interactive && !t.installed) {
    const rl = createInterface({ input: stdin, output: stdout });
    console.log("\nAGENTS.md is always installed. OpenAI Codex, Cursor and Copilot's coding agent read it directly.");
    console.log("Extra instruction files are available for:");
    for (const [id, p] of Object.entries(PROVIDERS)) console.log(`  ${id.padEnd(8)} ${p.label}: ${p.why}`);
    providerInput = await ask(rl, "\nProviders (comma-separated, or none)?", providerInput || "none");
    rl.close();
  }

  const { ids: providers, notes, unknown } = normalizeProviders(providerInput.split(","));
  if (unknown.length) fail(`unknown provider(s): ${unknown.join(", ")}. Known: ${[...Object.keys(PROVIDERS), ...Object.keys(AGENTS_MD_ONLY)].join(", ")}`);

  const p = plan(dir, { providers, conflicts: o.conflicts ?? "skip" });
  const by = summarize(p.actions);
  report(by, notes);
  reportObsolete(p.obsolete, upgrade);

  if (o.dryRun) { console.log("\nDry run: nothing was written."); return; }
  apply(p, { providers, prune: upgrade });
  nextSteps({ t, providers, existingRepo });
}

function report(by, notes) {
  const n = (k) => by[k]?.length ?? 0;
  const line = (label, k, detail = (a) => a.path) => {
    if (!n(k)) return;
    console.log(`\n${label} (${n(k)})`);
    for (const a of by[k]) console.log(`  ${detail(a)}`);
  };
  console.log("");
  console.log(`create ${n("create")} · update ${n("update")} · merge ${n("append-block") + n("replace-block") + n("merge-json")} · unchanged ${n("unchanged")} · kept ${n("keep")} · conflicts ${n("conflict") + n("sidecar")}`);
  line("Merged into existing files", "append-block", (a) => `${a.path}: appended a marked blueprint block`);
  line("Refreshed blocks", "replace-block", (a) => `${a.path}: replaced the blueprint block`);
  line("Merged JSON", "merge-json");
  line("Updated (unchanged since the last install)", "update");
  line("Conflicts, left as they are", "conflict", (a) => a.reason ? `${a.path} (${a.reason})` : a.path);
  line("Conflicts, our version written next to them", "sidecar", (a) => `${a.path} → ${a.sidecar}`);
  if (n("conflict")) console.log(`  Compare and merge by hand, or re-run with --conflicts sidecar to get our version as <file>${SIDECAR_SUFFIX}.`);
  for (const note of notes) console.log(`\nNote: ${note}`);
}

function reportObsolete(obsolete, upgrade) {
  const group = (action) => obsolete.filter((o) => o.action === action);
  const list = (title, items, detail = (o) => o.path) => {
    if (!items.length) return;
    console.log(`\n${title} (${items.length})`);
    for (const o of items) console.log(`  ${detail(o)}`);
  };
  list(upgrade ? "No longer needed, removed" : 'No longer needed (run "blueprint upgrade" to remove them)', group("remove"));
  list("No longer needed, but kept", group("edited"), (o) => `${o.path} (${o.reason ?? "edited since it was installed; delete it when you no longer need it"})`);
  list("No longer managed by blueprint, left in place", group("release"));
}

function nextSteps({ t, providers, existingRepo }) {
  const steps = [];
  if (t.installed) {
    steps.push("Review the changes (git diff) and commit them, including blueprint/.install.json, through a pull request.");
  } else {
    if (existingRepo) {
      steps.push(`Let your agent draft the blueprint from this codebase: ask it to "follow blueprint/workflows/onboard.md"${providers.includes("claude") ? " (in Claude Code: /blueprint-onboard)" : ""}. It opens one PR to review.`);
      steps.push("Write blueprint/00-product-core.md yourself (the onboarding PR suggests a draft), then review and approve the other documents.");
    } else {
      steps.push("Fill in blueprint/00-product-core.md, then 01 and 07, and the \"Project specifics\" in AGENTS.md.");
    }
    steps.push('Set up scheduled agent tasks, e.g. in Claude Code: daily "Follow blueprint/workflows/sync.md" and weekly "Follow blueprint/workflows/audit.md".');
    steps.push("Commit everything, including blueprint/.install.json.");
  }
  if (providers.includes("lovable")) {
    steps.push("Paste this into Lovable → Project settings → Knowledge:\n\n" + readFileSync(join(PACKAGE_ROOT, "cli/lovable-knowledge.md"), "utf8").trimEnd().replace(/^/gm, "     "));
  }
  console.log(`\nDone. Next steps:`);
  steps.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));
}

main().catch((err) => { console.error(`blueprint: ${err.message}`); exit(1); });

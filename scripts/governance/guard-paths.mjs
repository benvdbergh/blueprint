#!/usr/bin/env node
// Enforces the ownership model on AI workflow output. After an agent has edited files (uncommitted),
// this verifies every changed path is allowed for that workflow before anything is committed.
//
// Usage: node scripts/governance/guard-paths.mjs --workflow WF-06
//        node scripts/governance/guard-paths.mjs --allow "blueprint/**" --deny "blueprint/00-product-core.md"
//        node scripts/governance/guard-paths.mjs --none          (read-only workflows: nothing may change)
// Prints the changed files; exits 1 on any violation.
import { appendFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { Reporter, loadConfig, matchesAny, arg } from "./lib.mjs";

const r = new Reporter("AI output path guard (guard-paths)");
const config = loadConfig();

// -z: NUL-separated, no quoting; renames are "XY new\0old\0".
const raw = execFileSync("git", ["status", "--porcelain", "-z", "--untracked-files=all"], { encoding: "utf8" });
const entries = raw.split("\0").filter(Boolean);
const changed = [];
for (let i = 0; i < entries.length; i++) {
  const code = entries[i].slice(0, 2);
  changed.push(entries[i].slice(3));
  if (code.includes("R") || code.includes("C")) changed.push(entries[++i]); // old path counts too
}

let allow = [];
let deny = [];
const wf = arg("workflow");
if (arg("none")) {
  allow = [];
} else if (wf) {
  // Documents whose aiWorkflows include this workflow + the workflow's supporting folders.
  // WF-00 (onboarding) may fill every document except the always-protected ones, also in projects whose
  // config.json predates WF-00.
  for (const d of Object.values(config.documents)) {
    if ((d.aiWorkflows.includes(wf) || wf === "WF-00") && !d.alwaysProtected) allow.push(d.file);
    else deny.push(d.file);
  }
  const extra = {
    "WF-00": ["blueprint/decisions/**", "governance/config.json", "AGENTS.md"],
    "WF-01": ["blueprint/features/**", "blueprint/prototypes/**"],
    "WF-02": ["blueprint/prototypes/**"],
    "WF-03": ["blueprint/decisions/**", "blueprint/deviations/**"],
    "WF-04": ["contracts/**"],
    "WF-06": ["blueprint/features/**", "blueprint/decisions/**", "blueprint/deviations/**"],
  };
  allow.push(...(extra[wf] ?? []));
} else {
  allow = String(arg("allow", "")).split(",").filter(Boolean);
  deny = String(arg("deny", "")).split(",").filter(Boolean);
}

for (const f of changed) {
  if (matchesAny(f, deny) || !matchesAny(f, allow)) r.error(`not allowed to change this file${wf ? ` in ${wf}` : ""}`, f);
}
r.note(`${changed.length} changed file(s): ${changed.join(", ") || "none"}`);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed.length}\n`);
r.finish();

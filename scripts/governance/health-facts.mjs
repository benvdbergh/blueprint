#!/usr/bin/env node
// WF-07 step 1: collect deterministic facts for the Product Engineering Health Report.
// The AI audit (WF-07 step 2) starts from these facts instead of re-deriving them, so the
// report is reproducible where it can be and judgement-based only where it has to be.
//
// Usage: node scripts/governance/health-facts.mjs [--out health-facts.json] [--since "7 days ago"]
import { writeFileSync, readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { git, walk, arg } from "./lib.mjs";
import { loadModel } from "./model.mjs";

const out = arg("out", "health-facts.json");
const since = arg("since", "7 days ago");
const tmp = mkdtempSync(join(tmpdir(), "health-"));
const model = loadModel();
const today = new Date();
const daysSince = (d) => (d ? Math.floor((today - new Date(d)) / 86400000) : null);

function runCheck(script, extra = []) {
  const env = { ...process.env };
  delete env.GITHUB_ACTIONS; delete env.GITHUB_STEP_SUMMARY; delete env.GITHUB_OUTPUT; delete env.GITHUB_EVENT_PATH;
  const res = spawnSync("node", [`scripts/governance/${script}`, ...extra], { encoding: "utf8", env });
  const lines = (res.stdout ?? "").split("\n");
  return {
    passed: res.status === 0,
    errors: lines.filter((l) => l.startsWith("ERROR")).map((l) => l.slice(6).trim()),
    warnings: lines.filter((l) => l.startsWith("WARN")).map((l) => l.slice(6).trim()),
  };
}

const traceJson = join(tmp, "trace.json");
const termJson = join(tmp, "terminology.json");
const checks = {
  blueprint: runCheck("check-blueprint.mjs"),
  traceability: runCheck("trace.mjs", ["--json", traceJson]),
  terminology: runCheck("terminology.mjs", ["--json", termJson]),
};
const readJson = (p) => { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; } };

const countBy = (items, key) => items.reduce((acc, i) => ((acc[i.meta[key] ?? "unknown"] = (acc[i.meta[key] ?? "unknown"] ?? 0) + 1), acc), {});
const roadmap = model.documents.find((d) => d.key === "07");
const roadmapIds = new Set([...(roadmap?.text ?? "").replace(/<!--[\s\S]*?-->/g, "").matchAll(/\bFEAT-\d{3}\b/g)].map((m) => m[0]));

const changedSince = (git("log", `--since=${since}`, "--name-only", "--pretty=format:") ?? "").split("\n").filter(Boolean);
const area = (prefix) => new Set(changedSince.filter((f) => f.startsWith(prefix))).size;

const facts = {
  generated_at: today.toISOString(),
  commit: git("rev-parse", "HEAD"),
  window: since,
  checks,
  documents: model.documents.map((d) => ({
    key: d.key, title: d.title, file: d.file, missing: !!d.missing,
    status: d.meta?.status, last_reviewed: d.meta?.last_reviewed, days_since_review: daysSince(d.meta?.last_reviewed),
  })),
  features: {
    by_status: countBy(model.features, "status"),
    without_acceptance_criteria: model.features.filter((f) => f.acceptanceCriteria.length === 0).map((f) => f.fileId),
    not_on_roadmap: model.features.filter((f) => !roadmapIds.has(f.fileId) && f.meta.status !== "deprecated").map((f) => f.fileId),
    list: model.features.map((f) => ({ id: f.fileId, title: f.meta.title, status: f.meta.status, docs: f.meta.docs, prototype: f.meta.prototype ?? null, acceptance_criteria: f.acceptanceCriteria.length })),
  },
  traceability: readJson(traceJson),
  terminology: readJson(termJson),
  adrs: {
    by_status: countBy(model.adrs, "status"),
    unresolved: model.adrs.filter((a) => a.meta.status === "proposed").map((a) => ({ id: a.fileId, title: a.meta.title, age_days: daysSince(a.meta.date) })),
  },
  deviations: {
    by_status: countBy(model.deviations, "status"),
    open: model.deviations.filter((d) => d.meta.status === "open").map((d) => ({ id: d.fileId, title: d.meta.title, ref: d.meta.blueprint_ref })),
  },
  prototypes: walk("blueprint/prototypes").filter((f) => !f.endsWith("README.md")).map((f) => ({ file: f, last_commit: git("log", "-1", "--format=%cs", "--", f) })),
  activity: {
    commits: Number(git("rev-list", "--count", `--since=${since}`, "HEAD") ?? 0),
    files_changed: { src: area("src/"), blueprint: area("blueprint/"), migrations: area("supabase/migrations/") + area("migrations/"), contracts: area("contracts/") },
  },
};

writeFileSync(out, JSON.stringify(facts, null, 2));
console.log(`Wrote ${out}: blueprint ${checks.blueprint.passed ? "ok" : "FAILED"}, ${facts.features.list.length} features, ${facts.deviations.open.length} open deviations, ${facts.adrs.unresolved.length} unresolved ADRs`);

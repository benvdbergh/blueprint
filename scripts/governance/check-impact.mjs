#!/usr/bin/env node
// WF-05 gate, non-negotiable rule 3: "Implementation changes require impact analysis".
//
// 1. The PR description must contain the Blueprint impact table (see .github/pull_request_template.md)
//    with one row per blueprint document and an impact of: none | updated | proposed | deviation.
// 2. The table must be truthful: "updated" means the document is changed in this PR.
// 3. governance/config.json `impactRules` map code paths to documents. When a rule matches, each mapped
//    document must be updated, have a follow-up ("proposed", with a link), or a recorded deviation.
//    `require` rules fail the gate; `suggest` rules only warn. "none" + a written reason downgrades to a warning.
//
// Usage: blueprint check impact [--base origin/main] [--body-file pr.md]
import { readFileSync, appendFileSync } from "node:fs";
import { Reporter, loadConfig, githubEvent, changedFiles, matchesAny, arg } from "./lib.mjs";

const r = new Reporter("Blueprint impact analysis (check-impact)", { gate: true });
const config = loadConfig();
const event = githubEvent();
const pr = event?.pull_request;

const bodyFile = arg("body-file");
const body = bodyFile ? readFileSync(bodyFile, "utf8") : pr?.body ?? null;
if (body === null) {
  r.note("No pull request context (and no --body-file); impact analysis skipped.");
  r.finish();
  process.exit(0);
}

const exempt = config.impactExemptAuthors ?? ["dependabot[bot]", "renovate[bot]"];
if (pr && exempt.includes(pr.user?.login)) {
  r.note(`Author ${pr.user.login} is exempt from impact analysis.`);
  r.finish();
  process.exit(0);
}

const base = arg("base") || (process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : "origin/main");
const changed = changedFiles(base);
const IMPACTS = ["none", "updated", "proposed", "deviation"];

// ---- parse the table
const rows = {};
for (const line of body.split(/\r?\n/)) {
  const m = /^\|\s*(0[0-7])\b[^|]*\|\s*`?([A-Za-z-]+)`?\s*\|\s*(.*?)\s*\|?\s*$/.exec(line.trim());
  if (m) rows[m[1]] = { impact: m[2].toLowerCase(), note: m[3].replace(/<!--.*?-->/g, "").trim() };
}

const docs = config.documents;
const docChanged = (key) => changed.includes(docs[key].file);

for (const [key, d] of Object.entries(docs)) {
  const row = rows[key];
  if (!row) { r.error(`Impact table has no row for ${key} ${d.title}. Fill in the "Blueprint impact" section of the PR template.`); continue; }
  if (!IMPACTS.includes(row.impact)) { r.error(`${key} ${d.title}: impact \`${row.impact}\` must be one of ${IMPACTS.join(" | ")}`); continue; }
  if (row.impact === "updated" && !docChanged(key)) r.error(`${key} ${d.title} is marked \`updated\` but ${d.file} is not changed in this PR`);
  if (row.impact === "none" && docChanged(key)) r.warn(`${key} ${d.title} is marked \`none\` but ${d.file} IS changed — mark it \`updated\``);
  if (row.impact === "proposed" && !row.note) r.error(`${key} ${d.title}: \`proposed\` needs a link to the follow-up PR/issue in the note column`);
  if (row.impact === "deviation" && !/DEV-\d{3}/.test(row.note)) r.error(`${key} ${d.title}: \`deviation\` needs a DEV-nnn reference (blueprint/deviations/)`);
}

// ---- path rules
const triggered = new Set();
for (const rule of config.impactRules) {
  const hits = changed.filter((f) => matchesAny(f, rule.paths));
  if (!hits.length) continue;
  triggered.add(rule.workflow);
  r.note(`Rule "${rule.name}" (${rule.workflow}) matched ${hits.length} file(s), e.g. \`${hits[0]}\``);
  for (const key of rule.docs) {
    const row = rows[key];
    if (docChanged(key) || ["proposed", "deviation"].includes(row?.impact)) continue;
    const msg = `"${rule.name}" changed (${hits.slice(0, 3).join(", ")}) but ${key} ${docs[key].title} is not updated, proposed or deviated`;
    if (rule.level === "require" && !(row?.impact === "none" && row.note)) r.error(msg + ". Update the doc, link a follow-up, record a deviation, or explain `none` in the note column.");
    else r.warn(msg + (row?.note ? ` (justification: ${row.note})` : ""));
  }
}

if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `workflows=${[...triggered].sort().join(",")}\n`);
r.finish();

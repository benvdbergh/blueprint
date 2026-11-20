#!/usr/bin/env node
// WF-05 gate, non-negotiable rule 2: "Approved specifications are protected".
//
// A PR that modifies (or deletes) a blueprint file whose BASE version has a protected status
// (default: `approved`), or any `alwaysProtected` document (00 Product Core), needs the
// approval label (default: `blueprint:approved-change`) applied by a human with the authority
// listed in governance/config.json. PRs opened by bots may never change 00 Product Core.
//
// Usage: blueprint check protected [--base origin/main] [--labels a,b]
import { Reporter, loadConfig, githubEvent, changedFiles, fileAtRef, parseFrontMatter, arg } from "./lib.mjs";

const r = new Reporter("Protected specifications (check-protected)");
const config = loadConfig();
const event = githubEvent();
const pr = event?.pull_request;
const { approvalLabel, protectedStatuses } = config.protection;

if (!pr && !arg("base")) {
  r.note("No pull request context; protection check skipped.");
  r.finish();
  process.exit(0);
}

const base = arg("base") || `origin/${process.env.GITHUB_BASE_REF || "main"}`;
const labels = arg("labels") ? String(arg("labels")).split(",") : (pr?.labels ?? []).map((l) => l.name);
const author = pr?.user?.login ?? "";
const isBot = pr?.user?.type === "Bot" || author.endsWith("[bot]");
const approved = labels.includes(approvalLabel);

const alwaysProtected = Object.entries(config.documents).filter(([, d]) => d.alwaysProtected).map(([, d]) => d.file);

for (const file of changedFiles(base).filter((f) => f.startsWith("blueprint/") && f.endsWith(".md"))) {
  const before = fileAtRef(base, file);
  if (before === null) continue; // new file: nothing approved yet
  const status = parseFrontMatter(before).data?.status;
  const always = alwaysProtected.includes(file);
  if (!always && !protectedStatuses.includes(status)) continue;

  const owner = Object.values(config.documents).find((d) => d.file === file)?.authority ?? "the document owner (see CODEOWNERS)";
  if (always && isBot) {
    r.error(`${file} may not be changed by an automated author (${author}). Propose the change in an issue instead.`, file);
  } else if (!approved) {
    r.error(`changes ${always ? "a protected core document" : `an \`${status}\` specification`}. Needs review by ${owner} and the \`${approvalLabel}\` label.`, file);
  } else {
    r.note(`\`${file}\` (${status}) change approved via \`${approvalLabel}\`.`);
  }
}

r.finish();

#!/usr/bin/env node
// Terminology drift: flags use of words listed in the "Avoid" column of the Ubiquitous language
// table in blueprint/03-domain-data.md. Warnings only — language drift is a signal, not a build break.
//
// Usage: node scripts/governance/terminology.mjs [--json out.json]
import { writeFileSync } from "node:fs";
import { Reporter, walk, read, matchesAny, arg } from "./lib.mjs";
import { loadModel, loadGlossary } from "./model.mjs";

const r = new Reporter("Terminology (terminology)");
const model = loadModel();
const glossary = loadGlossary(model);
const { scanGlobs, ignoreGlobs } = model.config.terminology;

const findings = [];
if (!glossary.length) r.note("No terms in the Ubiquitous language table of 03 yet — nothing to check.");

const files = walk(".", ignoreGlobs).filter((f) => matchesAny(f, scanGlobs));
for (const g of glossary) {
  for (const bad of g.avoid) {
    const re = new RegExp(`\\b${bad.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    for (const f of files) {
      const lines = read(f).split("\n");
      lines.forEach((line, i) => {
        if (re.test(line)) {
          findings.push({ file: f, line: i + 1, found: bad, preferred: g.term });
          r.warn(`line ${i + 1}: "${bad}" — use the domain term "${g.term}"`, f);
        }
      });
    }
  }
}

r.note(`${glossary.length} glossary term(s), ${files.length} file(s) scanned, ${findings.length} finding(s)`);
if (arg("json")) writeFileSync(arg("json"), JSON.stringify({ glossary, findings }, null, 2));
r.finish();

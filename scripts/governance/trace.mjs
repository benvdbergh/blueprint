#!/usr/bin/env node
// Blueprint ↔ Tests traceability (WF-05 warning, WF-07 input).
// Tests reference acceptance criteria by ID, e.g. `test("AC-012.3 rejects empty title", ...)`
// or a comment `// covers: AC-012.3`. This script lists acceptance criteria without any test reference.
// Criteria of features whose status is in `traceability.enforceForStatuses` (default: implemented)
// fail the check; others only warn.
//
// Usage: blueprint check trace [--json out.json] [--no-fail]
import { writeFileSync } from "node:fs";
import { Reporter, walk, read, matchesAny, arg } from "./lib.mjs";
import { loadModel } from "./model.mjs";

const r = new Reporter("Requirements ↔ tests traceability (trace)", { gate: true });
const model = loadModel();
const t = model.config.traceability;

const testFiles = walk(".", t.ignoreGlobs).filter((f) => matchesAny(f, t.testGlobs));
const referenced = new Map(); // AC id -> [files]
for (const f of testFiles) {
  for (const m of read(f).matchAll(/\bAC-\d{3}\.\d+\b/g)) {
    if (!referenced.has(m[0])) referenced.set(m[0], new Set());
    referenced.get(m[0]).add(f);
  }
}

const result = { testFiles: testFiles.length, features: [] };
const allAcs = new Set();
for (const f of model.features) {
  if (!t.coveredStatuses.includes(f.meta.status)) continue;
  const acs = f.acceptanceCriteria.map((ac) => ({ ...ac, tests: [...(referenced.get(ac.id) ?? [])] }));
  acs.forEach((a) => allAcs.add(a.id));
  const uncovered = acs.filter((a) => a.tests.length === 0);
  result.features.push({ id: f.fileId, title: f.meta.title, status: f.meta.status, total: acs.length, uncovered: uncovered.map((a) => a.id) });
  for (const a of uncovered) {
    const msg = `${a.id} (${f.fileId}, ${f.meta.status}) has no test referencing it`;
    if (t.enforceForStatuses.includes(f.meta.status) && !arg("no-fail")) r.error(msg, f.file);
    else r.warn(msg, f.file);
  }
}
// Tests that reference criteria which no longer exist are a drift signal too.
const knownAcs = new Set(model.features.flatMap((f) => f.acceptanceCriteria.map((a) => a.id)));
result.orphanedReferences = [...referenced.keys()].filter((id) => !knownAcs.has(id));
for (const id of result.orphanedReferences) r.warn(`tests reference ${id}, which is not defined in any feature spec`, [...referenced.get(id)][0]);

const total = [...allAcs].length;
const covered = [...allAcs].filter((id) => referenced.has(id)).length;
result.coverage = { total, covered, percent: total ? Math.round((covered / total) * 100) : 100 };
r.note(`${covered}/${total} acceptance criteria referenced by tests across ${testFiles.length} test file(s)`);

if (arg("json")) writeFileSync(arg("json"), JSON.stringify(result, null, 2));
r.finish();

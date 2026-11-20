#!/usr/bin/env node
// WF-05 / WF-06 / WF-07: structural validation of the blueprint.
// - all eight documents exist with valid front matter
// - feature specs, ADRs and deviations follow naming + front-matter conventions
// - non-draft features have acceptance criteria numbered after their feature
// - every FEAT-/ADR-/DEV- reference resolves; no duplicate IDs
import { Reporter, walk, read } from "./lib.mjs";
import { loadModel, DOC_STATUSES, FEATURE_STATUSES, ADR_STATUSES, DEVIATION_STATUSES } from "./model.mjs";

const r = new Reporter("Blueprint structure (check-blueprint)", { gate: true });
const model = loadModel();

const requireFields = (item, fields) => {
  for (const f of fields) if (!item.meta[f]) r.error(`front matter is missing \`${f}\``, item.file);
};

// --- core documents
for (const d of model.documents) {
  if (d.missing) { r.error(`blueprint document ${d.key} (${d.title}) is missing`, d.file); continue; }
  requireFields(d, ["id", "title", "status", "owner", "last_reviewed"]);
  if (d.meta.id && d.meta.id !== d.key) r.error(`front matter id \`${d.meta.id}\` should be \`${d.key}\``, d.file);
  if (d.meta.status && !DOC_STATUSES.includes(d.meta.status)) r.error(`status \`${d.meta.status}\` not in ${DOC_STATUSES.join("|")}`, d.file);
}

// --- features / ADRs / deviations
const checkCollection = (items, kind, statuses, fields) => {
  const seen = new Map();
  for (const it of items) {
    if (!it.fileId) { r.error(`${kind} file name must start with its ID (create it with \`blueprint new\`)`, it.file); continue; }
    requireFields(it, fields);
    if (it.meta.id && it.meta.id !== it.fileId) r.error(`front matter id \`${it.meta.id}\` does not match file name (${it.fileId})`, it.file);
    if (it.meta.status && !statuses.includes(it.meta.status)) r.error(`status \`${it.meta.status}\` not in ${statuses.join("|")}`, it.file);
    if (seen.has(it.fileId)) r.error(`duplicate ID ${it.fileId} (also ${seen.get(it.fileId)})`, it.file);
    seen.set(it.fileId, it.file);
  }
  return new Set(seen.keys());
};

const featIds = checkCollection(model.features, "Feature", FEATURE_STATUSES, ["id", "title", "status", "owner"]);
const adrIds = checkCollection(model.adrs, "ADR", ADR_STATUSES, ["id", "title", "status", "date"]);
const devIds = checkCollection(model.deviations, "Deviation", DEVIATION_STATUSES, ["id", "title", "status", "blueprint_ref"]);

for (const f of model.features) {
  if (!f.fileId) continue;
  const num = f.fileId.slice(5);
  if (!/^##\s+Acceptance criteria/im.test(f.body)) r.error("missing `## Acceptance criteria` section", f.file);
  if (f.meta.status !== "draft" && f.acceptanceCriteria.length === 0)
    r.error(`status is \`${f.meta.status}\` but no acceptance criteria (AC-${num}.n) are defined`, f.file);
  const seenAc = new Set();
  for (const ac of f.acceptanceCriteria) {
    if (!ac.id.startsWith(`AC-${num}.`)) r.error(`${ac.id} does not belong to ${f.fileId} (expected AC-${num}.n)`, f.file);
    if (seenAc.has(ac.id)) r.error(`duplicate acceptance criterion ${ac.id}`, f.file);
    seenAc.add(ac.id);
  }
  if (!f.meta.docs) r.warn("front matter `docs` (affected blueprint documents) is empty", f.file);
}

for (const a of model.adrs) {
  if (a.meta.status === "superseded" && !a.meta.superseded_by) r.error("superseded ADR needs `superseded_by`", a.file);
}
for (const d of model.deviations) {
  if (!/##\s+Why/i.test(d.body)) r.error("deviation must explain `## Why` it is intentional", d.file);
}

// --- cross references
const known = { FEAT: featIds, ADR: adrIds, DEV: devIds };
const files = walk("blueprint").filter((f) => f.endsWith(".md") && !f.endsWith("_TEMPLATE.md") && !f.endsWith("README.md"));
for (const file of files) {
  const text = read(file).replace(/<!--[\s\S]*?-->/g, ""); // examples in comments don't count
  for (const m of text.matchAll(/\b(FEAT-\d{3}|ADR-\d{4}|DEV-\d{3})\b/g)) {
    const kind = m[1].split("-")[0];
    if (!known[kind].has(m[1])) r.error(`reference to unknown ${m[1]}`, file);
  }
}

r.note(`${model.documents.length} documents, ${model.features.length} features, ${model.adrs.length} ADRs, ${model.deviations.length} deviations checked`);
r.finish();

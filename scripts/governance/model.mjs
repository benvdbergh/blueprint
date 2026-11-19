// Loads the blueprint into a simple in-memory model (documents, features, ADRs, deviations).
import { loadConfig, read, exists, parseFrontMatter, walk } from "./lib.mjs";

export const DOC_STATUSES = ["draft", "proposed", "approved", "deprecated"];
export const FEATURE_STATUSES = ["draft", "proposed", "approved", "in-progress", "implemented", "deprecated"];
export const ADR_STATUSES = ["proposed", "accepted", "rejected", "superseded", "deprecated"];
export const DEVIATION_STATUSES = ["open", "accepted", "resolved"];

const isTemplate = (f) => /\/_TEMPLATE\.md$/.test(f);

function loadDir(dir, pattern) {
  return walk(dir)
    .filter((f) => f.endsWith(".md") && !isTemplate(f) && !f.endsWith("README.md"))
    .map((file) => {
      const text = read(file);
      const { data, body } = parseFrontMatter(text);
      const base = file.split("/").pop();
      const m = pattern.exec(base);
      return { file, text, body, meta: data ?? {}, fileId: m ? m[1] : null };
    });
}

export function loadModel() {
  const config = loadConfig();
  const documents = Object.entries(config.documents).map(([key, d]) => {
    if (!exists(d.file)) return { key, ...d, missing: true };
    const text = read(d.file);
    const { data, body } = parseFrontMatter(text);
    return { key, ...d, text, body, meta: data ?? {} };
  });

  const features = loadDir("blueprint/features", /^(FEAT-\d{3})(?:-|\.md)/).map((f) => ({
    ...f,
    acceptanceCriteria: [...f.body.matchAll(/\b(AC-\d{3}\.\d+)\b[:\s]*(.*)/g)].map((m) => ({ id: m[1], text: m[2].trim() })),
  }));
  const adrs = loadDir("blueprint/decisions", /^(ADR-\d{4})(?:-|\.md)/);
  const deviations = loadDir("blueprint/deviations", /^(DEV-\d{3})(?:-|\.md)/);

  return { config, documents, features, adrs, deviations };
}

// Parses the "Ubiquitous language" table in 03: | Term | Definition | Avoid |
export function loadGlossary(model) {
  const doc = model.documents.find((d) => d.key === "03");
  if (!doc || doc.missing) return [];
  const section = /##\s+Ubiquitous language[\s\S]*?(?=\n##\s|$)/i.exec(doc.body);
  if (!section) return [];
  const rows = section[0].split("\n").filter((l) => /^\|/.test(l) && !/^\|\s*-/.test(l));
  return rows.slice(1).map((r) => {
    const cells = r.split("|").slice(1, -1).map((c) => c.trim());
    return {
      term: cells[0]?.replace(/\*\*/g, ""),
      definition: cells[1],
      avoid: (cells[2] ?? "").split(",").map((s) => s.trim()).filter((s) => s && s !== "—" && s !== "-"),
    };
  }).filter((g) => g.term && !g.term.startsWith("<"));
}

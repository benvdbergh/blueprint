#!/usr/bin/env node
// Writes the package.json version into every `product-blueprint@x.y.z` in the files the package installs or
// serves (workflows, the setup-blueprint action, AGENTS.md, prompts, docs), so the package's own copies
// always name the version they ship with. `init` stamps the installed version again on the way out.
//
// Runs as the npm "version" lifecycle script (npm version <patch|minor|major>). --check only reports.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CORE, PROVIDERS, SERVED, VENDOR } from "./manifest.mjs";
import { PACKAGE_ROOT, VERSION, listFiles } from "./install.mjs";

const PIN = /product-blueprint@\d+\.\d+\.\d+(?:-[\w.]+)?/g;
const check = process.argv.includes("--check");
const entries = [...CORE, ...Object.values(PROVIDERS).flatMap((p) => p.files), ...VENDOR, ...SERVED.map((path) => ({ path })), { path: "README.md" }];
const files = new Set(entries.filter((e) => !e.target && e.strategy !== "json").flatMap((e) => listFiles(PACKAGE_ROOT, e.path, e.only)));

const stale = [];
for (const f of [...files].sort()) {
  if (f.startsWith("cli/") || f === "package.json") continue;
  const text = readFileSync(join(PACKAGE_ROOT, f), "utf8");
  const next = text.replace(PIN, `product-blueprint@${VERSION}`);
  if (next === text) continue;
  stale.push(f);
  if (!check) writeFileSync(join(PACKAGE_ROOT, f), next);
}
if (check && stale.length) {
  console.log(`Not on ${VERSION}: ${stale.join(", ")}. Run: node cli/stamp-version.mjs`);
  process.exit(1);
}
console.log(stale.length ? `Stamped product-blueprint@${VERSION} into ${stale.length} file(s): ${stale.join(", ")}` : `product-blueprint@${VERSION} pins are up to date.`);

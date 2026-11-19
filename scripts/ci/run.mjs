#!/usr/bin/env node
// Runs a package.json script with the repo's package manager, or skips (exit 0) when the
// script is not defined. This is what keeps the template stack-agnostic: CI calls the
// "script contract" (lint, typecheck, test, build, ...) and each project decides what those mean.
//
// Usage: node scripts/ci/run.mjs <script> [--required]
//        node scripts/ci/run.mjs --install
//        node scripts/ci/run.mjs --detect
import { existsSync, readFileSync, appendFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const [cmd, flag] = process.argv.slice(2);

function detect() {
  if (existsSync("bun.lockb") || existsSync("bun.lock")) return "bun";
  if (existsSync("pnpm-lock.yaml")) return "pnpm";
  if (existsSync("yarn.lock")) return "yarn";
  return "npm";
}
const pm = detect();
const hasPkg = existsSync("package.json");

if (cmd === "--detect") {
  console.log(`package_manager=${pm}\nhas_package_json=${hasPkg}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `package_manager=${pm}\nhas_package_json=${hasPkg}\n`);
  process.exit(0);
}

const exec = (bin, args) => {
  console.log(`$ ${bin} ${args.join(" ")}`);
  const res = spawnSync(bin, args, { stdio: "inherit", shell: process.platform === "win32" });
  process.exit(res.status ?? 1);
};

if (!hasPkg) {
  console.log(`No package.json — skipping ${cmd}.`);
  process.exit(0);
}

if (cmd === "--install") {
  const lock = { npm: existsSync("package-lock.json") ? ["ci"] : ["install"], pnpm: ["install", "--frozen-lockfile"], yarn: ["install", "--frozen-lockfile"], bun: ["install", "--frozen-lockfile"] };
  exec(pm, lock[pm]);
}

const scripts = JSON.parse(readFileSync("package.json", "utf8")).scripts ?? {};
if (!scripts[cmd]) {
  const msg = `Script "${cmd}" is not defined in package.json`;
  if (flag === "--required") { console.log(`::error::${msg} but is required by the quality gate.`); process.exit(1); }
  console.log(`::notice::${msg} — skipped. Add it to opt in (see governance/README.md#4-script-contract).`);
  process.exit(0);
}
exec(pm, ["run", cmd]);

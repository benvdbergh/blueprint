# Changelog

All notable changes to the `product-blueprint` installer and the template it installs. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.3.0] - 2026-11-20

A leaner footprint: projects keep only what they own, and the checks, templates and workflow specs run from the package.

### Changed
- `init` no longer copies `scripts/`, `templates/`, `contracts/README.md`, `governance/README.md`, `governance/workflows/`, `governance/health-report-template.md` or the `blueprint/*/_TEMPLATE.md` files into the project. What it writes: `AGENTS.md` (+ provider files), the eight blueprint documents and `blueprint/README.md`, `governance/config.json`, the workflows, actions, PR template, issue forms and `CODEOWNERS`.
- The workflows call the CLI through the new `.github/actions/setup-blueprint` action (`$BLUEPRINT`), pinned to the installed version (`npx product-blueprint@0.3.0`). `AGENTS.md`, the Cursor and Copilot files, the prompts and the specs use the same pinned call.
- AI workflows read their instructions with `blueprint prompt <name>`, which prefers the project's `.claude/commands/<name>.md`. `.claude/commands/` is now installed with the `claude` provider only.
- `lovable` no longer installs `governance/agents/lovable-knowledge.md`; `blueprint docs lovable` prints the text to paste.
- `health-facts` finds its sibling checks next to itself instead of in `scripts/governance/`.

### Added
- Commands: `check [blueprint|protected|impact|trace|terminology|all]`, `guard`, `facts`, `run <script>`, `setup-github`, `new feature|adr|deviation "<title>"` (next free ID, filled-in front matter), `new openapi|dependency-cruiser|visual-test|package-scripts`, `docs [name]`, `prompt [name]`.
- `upgrade`: refreshes an existing setup and removes files an earlier version installed that the layout no longer needs, only when they're unchanged and nothing still calls them. `init` on an old setup reports them without removing anything.
- `--vendor`: copies the CLI and everything it serves into `.blueprint/` for CI without npm access; `--lean` switches back. The install record now has a `layout`.
- `cli/stamp-version.mjs` (the npm `version` script) keeps the `product-blueprint@x.y.z` pins in step with `package.json`.

### Upgrading from 0.2
Run `npx product-blueprint@0.3.0 upgrade` on a branch, review the diff and merge it. Edited copies of the old scripts or specs are kept and listed; delete them once nothing uses them.

## [0.2.0] - 2026-11-20

### Added
- **WF-00 Onboarding** (`governance/workflows/WF-00-onboarding.md`, `/wf00-onboard` in Claude Code): after `init` in an existing repository, your own agent drafts blueprint documents 01–07 from the codebase, marks every claim as seen in code or inferred, sets them to `proposed`, points `impactRules` at the repo's real paths and opens one PR. 00 Product Core stays with the owner; the PR suggests a draft.
- `init` in an existing repository now ends with the onboarding step. `AGENTS.md` tells agents that find unfilled templates in a repo with code that onboarding is pending.
- `guard-paths.mjs --workflow WF-00` checks the onboarding output.

## [0.1.5] - 2026-11-20

### Changed
- First manual release via GitHub Action screen using auto versioning in the workflow
- Releases are started from the Actions tab (*Package · release* → *Run workflow*) instead of by pushing a tag. The workflow reads the version from `package.json`, publishes, and only then creates the tag and the GitHub release. It has a dry-run option.

## [0.1.4] - 2026-11-19

### Changed
- First version published by the automated release workflow, with npm provenance. No changes to the installer or the template.
- CONTRIBUTING: the npm trusted publisher must allow `npm publish` under *Allowed actions*.

## Not published: 0.1.1 – 0.1.3

`v0.1.1` was refused by npm (the trusted publisher only allowed staged publishes). `v0.1.2` and `v0.1.3` were tagged on a commit whose `package.json` didn't match, so the release workflow stopped them.

## [0.1.0] - 2026-11-19

### Added
- `blueprint init`: installs the blueprint, governance scripts, CI workflows and agent instructions into an empty folder or an existing repository, without overwriting existing files (marked blocks, line and JSON merges, reported conflicts, optional `.blueprint-new` sidecars).
- Agent providers: `claude`, `cursor`, `copilot`, `gemini`, `lovable`; `codex` needs only `AGENTS.md`.
- Upgrades: `governance/.blueprint-install.json` records what was installed, so a re-run updates files that weren't edited.
- Enforcement mode (`governance/config.json` → `enforcement: report | enforce`). Existing repositories start in report mode. In a pull request the mode is read from the base branch.
- Template: blueprint documents 00–07, feature/ADR/deviation templates, seven workflows (WF-01 … WF-07), deterministic governance checks.

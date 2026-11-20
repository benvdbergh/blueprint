# Changelog

All notable changes to the `product-blueprint` installer and the template it installs. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- `blueprint/workflows/align.md`: a read-only pass that checks 01–07 against 00 Product Core and against each other, without reading the code, and ends with a rectification list (one sentence to change or delete per row, plus what needs a decision in 00). Run it on demand, and after a spec change that touches more than one of 01–07. `upgrade` adds it to existing projects.
- Claude Code command `/blueprint-align`, pointing to it.

## [0.3.0] - 2026-11-20

The workflows are now plain instructions for agents instead of GitHub Actions. A project gets the blueprint documents, `AGENTS.md` and five instruction files, and nothing to maintain besides them. Point an agent at an instruction file on demand, or from a scheduled task (for example a Claude Code scheduled task with the prompt "Follow `blueprint/workflows/sync.md`").

### Added
- `blueprint/workflows/`: `sync` (update the documents for recent code changes, open a PR; was WF-06), `audit` (read-only health report; was WF-07), `review` (check a branch or PR against the blueprint; was WF-02/03/04 reviews and the impact analysis), `define-feature` (was WF-01), `onboard` (was WF-00). Each says when it runs, what it may change, how to decide, and how it ends.
- `blueprint/README.md` → *Which document covers what*: the code-to-document map agents use (was `impactRules` in `governance/config.json`), plus the ADR and deviation formats.
- `blueprint upgrade`: refreshes installed files you haven't edited, including blueprint documents that are still the untouched template, and removes files an older version installed that are no longer needed. It only removes files that are byte-for-byte what was installed, keeps the old scripts while a workflow you edited still calls them, and never removes `.gitignore` or `CODEOWNERS`. `init` on an old setup lists these files without deleting anything.
- Claude Code commands `/blueprint-sync`, `/blueprint-audit`, `/blueprint-review`, `/blueprint-define-feature`, `/blueprint-onboard`. Each one only points to its instruction file.

### Removed
- The GitHub Actions `wf01`–`wf07`, `.github/actions/`, the PR template with its *Blueprint impact* table, the issue forms and `CODEOWNERS`.
- `scripts/` (check-blueprint, check-impact, check-protected, trace, terminology, guard-paths, health-facts, ci/run, setup/configure-github.sh), `templates/`, `contracts/README.md`.
- `governance/`: `config.json` (ownership, impact rules, enforcement mode), the handbook, the WF-00…07 specs, the health-report template and the Lovable knowledge file. The rules that mattered are in `AGENTS.md` and `blueprint/README.md`. `init --providers lovable` prints the Lovable text.
- The `_TEMPLATE.md` files in `blueprint/features`, `decisions`, `deviations` and `prototypes/README.md`. The formats are in `define-feature.md` and `blueprint/README.md`.
- `init` options `--mode` (report/enforce) and `--owner`, the `.gitignore` merge, and the approval labels.

### Changed
- `AGENTS.md` is shorter: seven rules, with "keep the blueprint true in the same change" first, and no mandatory impact table.
- The install record moved from `governance/.blueprint-install.json` to `blueprint/.install.json`. `upgrade` moves it.
- The Cursor rule is now `.cursor/rules/blueprint.mdc`.

### Upgrading from 0.2
Run `npx product-blueprint@0.3.0 upgrade` on a branch and review the diff. Documents you filled stay as they are. They may still mention WF numbers or labels; the next `sync` run, or a quick edit, cleans that up. If you had made `quality-gate` or `governance-gate` required checks in branch protection, remove them.

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

# Changelog

All notable changes to the `product-blueprint` installer and the template it installs. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed
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

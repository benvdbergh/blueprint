# Product Engineering Blueprint

[![npm](https://img.shields.io/npm/v/product-blueprint)](https://www.npmjs.com/package/product-blueprint)
[![installer tests](https://github.com/benvdbergh/blueprint/actions/workflows/package-ci.yml/badge.svg)](https://github.com/benvdbergh/blueprint/actions/workflows/package-ci.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

Product infrastructure for codebases that **humans and AI agents work on together without drifting apart**.

```bash
npx product-blueprint init            # in an empty folder or an existing repository
```

One command adds the blueprint documents, shared agent instructions (`AGENTS.md` plus `CLAUDE.md`, Copilot, Cursor, Gemini or Lovable files where those tools need them), deterministic drift checks and seven GitHub workflows. In an existing repository nothing of yours is overwritten, and the checks start in report-only mode. [Getting started](#getting-started) has the details.

Lovable, Claude Code, Cursor and people are treated as interchangeable contributors. Three things they all share provide continuity:

1. **The blueprint** (`blueprint/`): eight documents with the agreed product and engineering intent, plus feature specs, ADRs and recorded deviations.
2. **Shared instructions** (`AGENTS.md`): one rulebook for every agent and human. Tool-specific files only point to it.
3. **Automated gates and feedback loops** (`.github/workflows/`): seven workflows that define features, validate every change, sync the documentation and audit for drift.

```
 Product Knowledge / Blueprint 00–07 ──► UX & Design ──┐
        ▲                              ► Architecture & Domain ──► Implementation ──► Testing ──► Documentation ──► Drift checks
        │                                                        (Lovable · Claude Code · Cursor · GitHub)                  │
        └───────────────────────────── feedback into the blueprint and implementation ◄──────────────────────────────────────┘
```

## What's inside

```
AGENTS.md                      shared rules for all agents + humans (single source)
CLAUDE.md                      → AGENTS.md (+ Claude Code commands)
.cursor/rules/governance.mdc   → AGENTS.md
.github/copilot-instructions.md → AGENTS.md (for Copilot surfaces that don't read AGENTS.md)
blueprint/
  00-product-core.md … 07-roadmap.md   the eight blueprint documents
  features/   FEAT-nnn specs with acceptance criteria AC-nnn.n
  decisions/  ADR-nnnn architecture decision records
  deviations/ DEV-nnn  explicit blueprint ↔ implementation differences
  prototypes/ approved UX prototypes
governance/
  README.md        Engineering Governance & Automation spec (rules, ownership, workflows, phases)
  config.json      machine-readable ownership model + impact rules
  workflows/       WF-01 … WF-07 specifications
  agents/lovable-knowledge.md   text to paste into Lovable's project knowledge
  health-report-template.md
contracts/        OpenAPI (machine-readable API truth)
scripts/
  governance/     deterministic checks (zero dependencies, Node ≥ 20)
  ci/run.mjs      stack-agnostic runner for the package.json "script contract"
  setup/configure-github.sh   labels, branch protection, template flag
.claude/commands/ the AI workflows as Claude Code commands (used locally and in CI)
.github/          the WF-01…07 workflows, PR template with impact table, issue forms, CODEOWNERS
templates/        starters: OpenAPI, dependency-cruiser boundaries, visual tests, script contract
bin/, cli/, test/ the `blueprint init` installer (not copied into projects)
.github/workflows/package-*.yml   the installer's own CI and release (not copied into projects)
```

## The seven workflows

| WF | Name | When | What |
|---|---|---|---|
| 00 | Onboarding | Once, after `init` in an existing repo | Your agent drafts the blueprint from the code and opens a PR ([below](#existing-codebase-let-your-agent-fill-the-blueprint)) |
| 01 | Product & Feature Definition | Issue labelled `wf-01:define` | Claude drafts a `FEAT-nnn` spec and opens a **draft PR** for approval |
| 02 | UX & Design Sync | PR touching UI | Playwright visual regression; optional AI UX review |
| 03 | Architecture & Data Integrity | PR touching migrations, deps, infra | Gate: migrations require 03 impact. AI architecture review comment |
| 04 | API Contract Sync | PR touching API / `contracts/` | Redocly lint, oasdiff breaking changes, contract tests |
| 05 | Code Quality Gate | Every PR + `main` | **Hard gate**: lint, types, tests, e2e, build, audit, boundaries, blueprint obligations |
| 06 | Blueprint Sync | Every merge to `main` | Claude proposes precise doc updates as a PR |
| 07 | Drift Audit | Weekly | Facts + AI audit → **Product Engineering Health Report** issue |

Details: [`governance/README.md`](governance/README.md).

## How a change flows

1. **Idea** → *Feature request* issue → a maintainer adds `wf-01:define` → WF-01 opens a draft spec PR → the product owner answers the open questions, sets `status: approved` and merges.
2. **Build** in Lovable, Cursor, Claude Code or by hand, on a branch. Tests reference `AC-nnn.n`.
3. **PR**: fill in the *Blueprint impact* table (`none / updated / proposed / deviation` for 00–07). `quality-gate` and `governance-gate` must pass. WF-02/03/04 add their checks when relevant.
4. **Merge** → WF-06 proposes blueprint updates in a separate PR → the owner reviews.
5. **Weekly** → WF-07 publishes the Health Report: what drifted, how severe, recommended actions.

AI workflows never merge, never push to `main` and never edit `00-product-core.md`. They only edit files, and deterministic steps check the changed paths against the ownership model (`scripts/governance/guard-paths.mjs`) before anything is committed.

## Getting started

The template installs with one command, in an empty folder or in an existing repository (Node ≥ 20):

```bash
npx product-blueprint init [dir] [--providers claude,cursor,copilot,gemini,lovable] [--mode report|enforce] [--owner @you]
```

Before the first npm release, or to try an unreleased version, run it straight from GitHub: `npx github:benvdbergh/blueprint init`.

Without flags it asks which agent tools you use (detected from the repo where possible) and which mode to start in. `--yes` skips the questions, `--dry-run` shows the plan without writing anything.

**Existing repositories are safe.** Nothing is overwritten:

| What | When the file already exists |
|---|---|
| `AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md`, PR template | Our content is appended between `<!-- blueprint:start -->` / `<!-- blueprint:end -->` markers. Re-runs replace only that block. |
| `.gitignore` | Missing lines are appended. |
| `.gemini/settings.json` | Keys are merged; existing values are kept. |
| `blueprint/`, `contracts/`, `governance/config.json`, `CODEOWNERS` | Kept as they are (they're yours to edit). |
| Scripts, workflows, workflow specs | Reported as a conflict and left alone. `--conflicts sidecar` writes our version next to it as `<file>.blueprint-new`. |

In an existing repository the checks start in **report mode**: they show what would fail but never block a PR. Set `"enforcement": "enforce"` in `governance/config.json` when you're ready ([details](governance/README.md#enforcement-mode)). `governance/.blueprint-install.json` records what was installed, so running `init` again later upgrades every file you haven't changed.

### Existing codebase: let your agent fill the blueprint

`init` installs empty templates. The onboarding step (WF-00) has your own coding agent read the codebase and draft the blueprint from it: domain and data from migrations, architecture from the stack, interfaces from routes and functions, deployment from CI and hosting config, screens and capabilities from the UI. Everything is marked *seen in code* or *inferred*, set to `proposed`, and delivered as **one PR**. 00 Product Core stays yours: the PR suggests a draft, you write it.

Tell your agent, in the repository:

> Set up a product blueprint for this repo: run `npx product-blueprint init --yes`, then follow `governance/workflows/WF-00-onboarding.md` and open the PR.

In Claude Code you can also run `/wf00-onboard` after `init`. Any agent that reads `AGENTS.md` (Codex, Cursor, Copilot, Claude Code, Gemini CLI with the `gemini` provider) can follow the same file.

### Agent providers

`AGENTS.md` is always installed. It's the open convention that OpenAI Codex, Cursor and GitHub Copilot's coding agent, CLI and VS Code chat read natively, so for those tools nothing else is needed. The providers below add a file only where a tool still needs one:

| Provider | Adds | Why |
|---|---|---|
| `claude` (default) | `CLAUDE.md` with `@AGENTS.md` | Claude Code reads `AGENTS.md` only when there is no `CLAUDE.md`, and only from v2.1.277 (later on Bedrock/Vertex). The import works everywhere. |
| `cursor` | `.cursor/rules/governance.mdc` | Optional: Cursor reads `AGENTS.md`; this adds an always-apply rule with the short version. |
| `copilot` | `.github/copilot-instructions.md` | github.com Copilot chat and code review don't read `AGENTS.md`. |
| `gemini` | `.gemini/settings.json` → `context.fileName` | Gemini CLI reads `GEMINI.md` unless told to read `AGENTS.md`. |
| `lovable` | `governance/agents/lovable-knowledge.md` | Lovable takes instructions from its project Knowledge, not a repo file. Paste this text there. |

`codex` is accepted but adds nothing. `.claude/commands/` is always installed because the AI workflows in CI run Claude Code with those files as prompts.

### After installing
1. Fill in `blueprint/00-product-core.md` first, then 01 and 07. In an existing repository, run the onboarding step first and review its PR. Leave the rest as `draft` until there is something to describe.
2. Run the setup script (labels, branch protection; use `--reviews 0` if you work alone):
   ```bash
   scripts/setup/configure-github.sh --codeowner @your-handle
   ```
3. Add the Claude key for the AI workflows (deterministic checks work without it):
   ```bash
   gh secret set ANTHROPIC_API_KEY
   ```
4. Create the app (or connect Lovable). Add scripts from `templates/package-scripts.json` as they become real. Each added script becomes part of the gate.

You can still use this repository as a GitHub template instead (**Use this template**). In that case delete what belongs to the installer: `package.json`, `package-lock.json`, `bin/`, `cli/`, `test/`, `.github/workflows/package-*.yml`, `CHANGELOG.md`, `CONTRIBUTING.md`, `SECURITY.md` and `LICENSE` (or keep the license notice).

### Lovable
- Paste [`governance/agents/lovable-knowledge.md`](governance/agents/lovable-knowledge.md) into the project's Knowledge.
- Connect Lovable to a **working branch**, not `main`, so its changes pass the gate through PRs. If it commits straight to `main`, WF-05 still runs there and opens an issue when it fails, and WF-06/07 catch drift afterwards.

## Rolling out in phases
Every workflow can be switched off with a repository variable (`WF01_ENABLED=false` … `WF07_ENABLED=false`).

| Phase | Turn on |
|---|---|
| 1 · Foundation | WF-05 (on by default), AGENTS.md, PR template, branch protection |
| 2 · Blueprint sync | `ANTHROPIC_API_KEY` → WF-06, WF-01 |
| 3 · UX & architecture | add `test:visual`, `check:architecture`, `contracts/openapi.yaml` → WF-02/03/04 |
| 4 · Quality management | WF-07 weekly audit (runs with facts-only output until the key is set) |

## Local commands
```bash
node scripts/governance/check-blueprint.mjs
node scripts/governance/check-impact.mjs --base origin/main --body-file pr.md
node scripts/governance/check-protected.mjs --base origin/main --labels blueprint:approved-change
node scripts/governance/trace.mjs
node scripts/governance/health-facts.mjs --out health-facts.json
```
In Claude Code: `/impact-analysis`, `/wf01-define-feature <idea>`, `/wf03-architecture-review`, `/wf06-blueprint-sync <range>`, `/wf07-drift-audit`.

## Contributing and license

Contributions are welcome: see [CONTRIBUTING.md](CONTRIBUTING.md) for development and release steps, [SECURITY.md](SECURITY.md) to report a vulnerability, and [CHANGELOG.md](CHANGELOG.md) for what changed. Licensed under the [MIT License](LICENSE).

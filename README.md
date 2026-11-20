# Product Engineering Blueprint

[![npm](https://img.shields.io/npm/v/product-blueprint)](https://www.npmjs.com/package/product-blueprint)
[![installer tests](https://github.com/benvdbergh/blueprint/actions/workflows/package-ci.yml/badge.svg)](https://github.com/benvdbergh/blueprint/actions/workflows/package-ci.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

Product infrastructure for codebases that **humans and AI agents work on together without drifting apart**.

```bash
npx product-blueprint init            # in an empty folder or an existing repository
```

One command adds the blueprint documents, shared agent instructions (`AGENTS.md` plus `CLAUDE.md`, Copilot, Cursor or Gemini files where those tools need them) and seven GitHub workflows. The drift checks, templates and workflow specs stay in the package and run with `npx product-blueprint@0.3.0 <command>`, so your repository only holds what it owns. In an existing repository nothing of yours is overwritten, and the checks start in report-only mode. [Getting started](#getting-started) has the details.

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

**In your repository** (what `init` writes, and all of it is yours to commit):

```
AGENTS.md                       shared rules for all agents + humans (single source)
CLAUDE.md, .claude/commands/    → AGENTS.md, plus the AI workflows as Claude Code commands (claude provider)
.cursor/rules/governance.mdc    → AGENTS.md (cursor provider)
.github/copilot-instructions.md → AGENTS.md (copilot provider)
blueprint/
  00-product-core.md … 07-roadmap.md   the eight blueprint documents
  features/ decisions/ deviations/ prototypes/   appear as you add FEAT/ADR/DEV files (`blueprint new`)
governance/
  config.json               ownership model, impact rules, enforcement mode
  .blueprint-install.json   what was installed and at which version (for upgrades)
.github/
  workflows/wf0*.yml        the seven workflows; they call the pinned CLI
  actions/                  setup-blueprint (pins the CLI), setup-project, ai-precheck
  pull_request_template.md, ISSUE_TEMPLATE/, CODEOWNERS
```

**In the package** (`product-blueprint` on npm, run with `npx product-blueprint@0.3.0 <command>`):

| Command | What it gives you |
|---|---|
| `check [blueprint\|protected\|impact\|trace\|terminology\|all]` | the deterministic governance checks (zero dependencies, Node ≥ 20) |
| `guard`, `facts` | the AI-output path guard and the WF-07 facts |
| `run <script>` | the stack-agnostic runner for the `package.json` script contract |
| `new feature\|adr\|deviation "<title>"` | a spec, ADR or deviation from the template, with the next free ID |
| `new openapi\|dependency-cruiser\|visual-test\|package-scripts` | the starters for WF-02, 03, 04 and 05 |
| `docs [governance\|WF-00 … WF-07\|health-report\|lovable\|…]` | the governance handbook and workflow specs |
| `prompt <name>` | the AI workflow prompts (your `.claude/commands/` copy wins) |
| `setup-github` | labels and branch protection |
| `upgrade` | moves the pin and refreshes the files you haven't edited |

The version is pinned in `.github/actions/setup-blueprint` and in `AGENTS.md`, so CI, agents and people run the same checks. Want everything in the repository instead (CI without npm access, or to read every line)? `init --vendor` adds a copy of the CLI and its files under `.blueprint/`, and everything calls `node .blueprint/bin/blueprint.mjs` instead.

This repository is both the package and the template: `bin/`, `cli/`, `test/` and `.github/workflows/package-*.yml` are the installer and its CI and are never copied into projects.

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

AI workflows never merge, never push to `main` and never edit `00-product-core.md`. They only edit files, and deterministic steps check the changed paths against the ownership model (`blueprint guard`) before anything is committed.

## Getting started

The template installs with one command, in an empty folder or in an existing repository (Node ≥ 20):

```bash
npx product-blueprint init [dir] [--providers claude,cursor,copilot,gemini,lovable] [--mode report|enforce] [--owner @you] [--vendor]
```

Before the first npm release, or to try an unreleased version, run it straight from GitHub: `npx github:benvdbergh/blueprint init`.

Without flags it asks which agent tools you use (detected from the repo where possible) and which mode to start in. `--yes` skips the questions, `--dry-run` shows the plan without writing anything.

**Existing repositories are safe.** Nothing is overwritten:

| What | When the file already exists |
|---|---|
| `AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md`, PR template | Our content is appended between `<!-- blueprint:start -->` / `<!-- blueprint:end -->` markers. Re-runs replace only that block. |
| `.gitignore` | Missing lines are appended. |
| `.gemini/settings.json` | Keys are merged; existing values are kept. |
| `blueprint/`, `governance/config.json`, `CODEOWNERS` | Kept as they are (they're yours to edit). |
| Workflows, actions, issue forms, `.claude/commands/` | Reported as a conflict and left alone. `--conflicts sidecar` writes our version next to it as `<file>.blueprint-new`. |

In an existing repository the checks start in **report mode**: they show what would fail but never block a PR. Set `"enforcement": "enforce"` in `governance/config.json` when you're ready ([details](governance/README.md#enforcement-mode)). `governance/.blueprint-install.json` records what was installed, so `npx product-blueprint@latest upgrade` later refreshes every file you haven't changed and moves the pinned version.

### Upgrading from 0.2 or earlier

Setups from before 0.3 have their own copies of `scripts/`, `templates/`, `contracts/README.md`, `governance/README.md`, `governance/workflows/` and the `_TEMPLATE.md` files. Run `npx product-blueprint@latest upgrade` in a branch: it switches the workflows and instruction files to the package and removes those copies, but only the ones that are still exactly what was installed. Files you edited are kept and listed, and if a workflow you edited still calls `scripts/`, the scripts stay until you've updated it. `init` on such a setup does the same without removing anything. Prefer to keep everything in the repository? `upgrade --vendor` moves the copies under `.blueprint/` instead.

### Existing codebase: let your agent fill the blueprint

`init` installs empty templates. The onboarding step (WF-00) has your own coding agent read the codebase and draft the blueprint from it: domain and data from migrations, architecture from the stack, interfaces from routes and functions, deployment from CI and hosting config, screens and capabilities from the UI. Everything is marked *seen in code* or *inferred*, set to `proposed`, and delivered as **one PR**. 00 Product Core stays yours: the PR suggests a draft, you write it.

Tell your agent, in the repository:

> Set up a product blueprint for this repo: run `npx product-blueprint init --yes`, then run `npx product-blueprint docs WF-00`, follow it and open the PR.

In Claude Code you can also run `/wf00-onboard` after `init`. Any agent that reads `AGENTS.md` (Codex, Cursor, Copilot, Claude Code, Gemini CLI with the `gemini` provider) can follow the same file.

### Agent providers

`AGENTS.md` is always installed. It's the open convention that OpenAI Codex, Cursor and GitHub Copilot's coding agent, CLI and VS Code chat read natively, so for those tools nothing else is needed. The providers below add a file only where a tool still needs one:

| Provider | Adds | Why |
|---|---|---|
| `claude` (default) | `CLAUDE.md` with `@AGENTS.md` | Claude Code reads `AGENTS.md` only when there is no `CLAUDE.md`, and only from v2.1.277 (later on Bedrock/Vertex). The import works everywhere. |
| `cursor` | `.cursor/rules/governance.mdc` | Optional: Cursor reads `AGENTS.md`; this adds an always-apply rule with the short version. |
| `copilot` | `.github/copilot-instructions.md` | github.com Copilot chat and code review don't read `AGENTS.md`. |
| `gemini` | `.gemini/settings.json` → `context.fileName` | Gemini CLI reads `GEMINI.md` unless told to read `AGENTS.md`. |
| `lovable` | nothing; `blueprint docs lovable` prints the text | Lovable takes instructions from its project Knowledge, not a repo file. Paste the text there. |

`codex` is accepted but adds nothing. The AI workflows in CI get their prompts from the package (`blueprint prompt`), so `.claude/commands/` comes only with the `claude` provider. If you edit a command there, CI uses your version too.

### After installing
1. Fill in `blueprint/00-product-core.md` first, then 01 and 07. In an existing repository, run the onboarding step first and review its PR. Leave the rest as `draft` until there is something to describe.
2. Set up GitHub (labels, branch protection; use `--reviews 0` if you work alone; needs `gh`):
   ```bash
   npx product-blueprint@0.3.0 setup-github --codeowner @your-handle
   ```
3. Add the Claude key for the AI workflows (deterministic checks work without it):
   ```bash
   gh secret set ANTHROPIC_API_KEY
   ```
4. Create the app (or connect Lovable). Add scripts from `npx product-blueprint@0.3.0 new package-scripts` as they become real. Each added script becomes part of the gate.

You can still use this repository as a GitHub template instead (**Use this template**), but `init` (with `--vendor` if you want every file in the repository) gives you the same result without the installer's own files.

### Lovable
- Paste the output of `npx product-blueprint@0.3.0 docs lovable` ([source](governance/agents/lovable-knowledge.md)) into the project's Knowledge.
- Connect Lovable to a **working branch**, not `main`, so its changes pass the gate through PRs. If it commits straight to `main`, WF-05 still runs there and opens an issue when it fails, and WF-06/07 catch drift afterwards.

## Rolling out in phases
Every workflow can be switched off with a repository variable (`WF01_ENABLED=false` … `WF07_ENABLED=false`).

| Phase | Turn on |
|---|---|
| 1 · Foundation | WF-05 (on by default), AGENTS.md, PR template, branch protection |
| 2 · Blueprint sync | `ANTHROPIC_API_KEY` → WF-06, WF-01 |
| 3 · UX & architecture | add `test:visual`, `check:architecture`, `contracts/openapi.yaml` (`blueprint new visual-test\|dependency-cruiser\|openapi`) → WF-02/03/04 |
| 4 · Quality management | WF-07 weekly audit (runs with facts-only output until the key is set) |

## Local commands
```bash
npx product-blueprint@0.3.0 check                                   # blueprint, trace, terminology
npx product-blueprint@0.3.0 check impact --base origin/main --body-file pr.md
npx product-blueprint@0.3.0 check protected --base origin/main --labels blueprint:approved-change
npx product-blueprint@0.3.0 facts --out health-facts.json
npx product-blueprint@0.3.0 new feature "Export to CSV"
npx product-blueprint@0.3.0 docs WF-06
```
In Claude Code: `/impact-analysis`, `/wf01-define-feature <idea>`, `/wf03-architecture-review`, `/wf06-blueprint-sync <range>`, `/wf07-drift-audit`.

## Contributing and license

Contributions are welcome: see [CONTRIBUTING.md](CONTRIBUTING.md) for development and release steps, [SECURITY.md](SECURITY.md) to report a vulnerability, and [CHANGELOG.md](CHANGELOG.md) for what changed. Licensed under the [MIT License](LICENSE).

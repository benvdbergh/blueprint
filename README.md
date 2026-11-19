# Product Engineering Blueprint: template

Product infrastructure for codebases that **humans and AI agents work on together without drifting apart**.

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
```

## The seven workflows

| WF | Name | When | What |
|---|---|---|---|
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

### A. New project from this template
1. **Use this template** on GitHub, or `gh repo create my-product --template <this-repo> --private --clone`.
2. Fill in `blueprint/00-product-core.md` first, then 01 and 07. Leave the rest as `draft` until there is something to describe.
3. Run the setup script (labels, branch protection; use `--reviews 0` if you work alone):
   ```bash
   scripts/setup/configure-github.sh --codeowner @your-handle
   ```
4. Add the Claude key for the AI workflows (deterministic checks work without it):
   ```bash
   gh secret set ANTHROPIC_API_KEY
   ```
5. Create the app (or connect Lovable). Add scripts from `templates/package-scripts.json` as they become real. Each added script becomes part of the gate.

### B. Existing repository (e.g. one Lovable created)
Copy `AGENTS.md`, `CLAUDE.md`, `.cursor/`, `.claude/`, `.github/`, `blueprint/`, `governance/`, `scripts/`, `contracts/`, `templates/` and the `.gitignore` entries into the repo, open a PR, then follow steps 2–5. Merge your existing `.github/` or `.gitignore` content if you already have some.

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

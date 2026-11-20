# Product Engineering Blueprint

[![npm](https://img.shields.io/npm/v/product-blueprint)](https://www.npmjs.com/package/product-blueprint)
[![installer tests](https://github.com/benvdbergh/blueprint/actions/workflows/package-ci.yml/badge.svg)](https://github.com/benvdbergh/blueprint/actions/workflows/package-ci.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

Product documentation that **humans and AI agents keep in line with the code**.

```bash
npx product-blueprint init            # in an empty folder or an existing repository
```

You get eight short documents that describe what the product is for and how it's built, one set of rules for every agent (`AGENTS.md`), and six workflows written as plain instructions. Your agent follows them on demand, or on a schedule as a Claude Code scheduled task: "Follow `blueprint/workflows/sync.md`". There are no GitHub Actions, scripts or config files to maintain.

## What lands in your repository

```
AGENTS.md                         rules for every agent and person (single source)
CLAUDE.md, .claude/commands/      → AGENTS.md, plus /blueprint-sync, /blueprint-audit, … (claude provider)
.cursor/rules/blueprint.mdc       → AGENTS.md (cursor provider)
.github/copilot-instructions.md   → AGENTS.md (copilot provider)
blueprint/
  README.md                       index, conventions, which document covers which code
  00-product-core.md … 07-roadmap.md
  workflows/                      sync · audit · align · review · define-feature · onboard
  .install.json                   what was installed, for upgrades
```

`features/`, `decisions/`, `deviations/` and `prototypes/` appear in `blueprint/` once you add the first spec, ADR, deviation or prototype.

## The workflows

| File | What the agent does | Changes | Run it |
|---|---|---|---|
| [`sync.md`](blueprint/workflows/sync.md) | Reads recent commits and updates the documents they made outdated | blueprint docs, via a PR | daily scheduled task, or after merges |
| [`audit.md`](blueprint/workflows/audit.md) | Compares the whole blueprint with the code and reports the mismatches that matter | nothing (report only) | weekly scheduled task |
| [`align.md`](blueprint/workflows/align.md) | Checks 01–07 against 00 Product Core and against each other, without reading the code, and lists the sentences to change | nothing (report only) | on demand, and after a spec change that touches more than one of 01–07 |
| [`review.md`](blueprint/workflows/review.md) | Checks a branch or PR against the blueprint and says which docs need an update | nothing (comment or report) | on demand, or on open PRs |
| [`define-feature.md`](blueprint/workflows/define-feature.md) | Turns a request into a feature spec with acceptance criteria | `features/`, 01, 07 | on demand |
| [`onboard.md`](blueprint/workflows/onboard.md) | Drafts the blueprint from an existing codebase | 01–07, via a PR | once |

Each file says when it runs, what it may change, how to decide when the code and the docs (or two docs) disagree, when to stop, and what to report. They work with any agent that can read files and run `git`. Opening PRs or comments needs `gh` or an equivalent; otherwise the agent reports in its final message.

**Scheduled tasks in Claude Code:** create a task for the repository with the prompt `Follow blueprint/workflows/sync.md` (daily) and another with `Follow blueprint/workflows/audit.md` (weekly). The prompt is the whole setup; the instructions live in the repository, so they're versioned and reviewed like everything else. `align` isn't scheduled: run it on demand (`/blueprint-align`) after a spec change that touches more than one of 01–07.

## Getting started

```bash
npx product-blueprint init [dir] [--providers claude,cursor,copilot,gemini,lovable]
```

Without flags it asks which agent tools you use (detected from the repo where possible). `--yes` skips the question, `--dry-run` shows the plan without writing anything.

**Existing repositories are safe.** Nothing is overwritten:

| What | When the file already exists |
|---|---|
| `AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md` | Our content is appended between `<!-- blueprint:start -->` / `<!-- blueprint:end -->` markers. Upgrades replace only that block. |
| `.gemini/settings.json` | Keys are merged; existing values are kept. |
| Blueprint documents | Kept as they are: they're yours. |
| Workflow instructions, Claude commands, Cursor rule | Reported as a conflict and left alone. `--conflicts sidecar` writes our version next to it as `<file>.blueprint-new`. |

Then:
1. **Existing codebase:** ask your agent to "follow `blueprint/workflows/onboard.md`" (`/blueprint-onboard` in Claude Code). It drafts 01–07 from the code, marks what it saw and what it inferred, and opens one PR. 00 Product Core stays yours: the PR suggests a draft.
   **New project:** fill in `blueprint/00-product-core.md`, then 01 and 07.
2. Set up the `sync` and `audit` scheduled tasks.
3. **Lovable:** `init --providers lovable` prints a short text to paste into Lovable's project Knowledge. Connect Lovable to a working branch so its changes arrive as PRs that `review` can check.

### Upgrading

`npx product-blueprint@latest upgrade` refreshes every installed file you haven't edited, including blueprint documents that are still the untouched template. Files you edited are kept and listed.

**From 0.2 or earlier:** `upgrade` also removes what those versions installed and this one no longer needs: the GitHub Actions (`wf01`–`wf07`), `.github/actions/`, the PR template and issue forms, `scripts/`, `templates/`, `contracts/README.md`, `governance/` and the `_TEMPLATE.md` files. It removes a file only if it's still exactly what was installed, and keeps the old scripts while a workflow you edited still calls them. `.gitignore` and `CODEOWNERS` are left in place. Plain `init` on such a setup lists these files without deleting anything. Run it on a branch and review the diff.

## Contributing and license

Contributions are welcome: see [CONTRIBUTING.md](CONTRIBUTING.md) for development and release steps, [SECURITY.md](SECURITY.md) to report a vulnerability, and [CHANGELOG.md](CHANGELOG.md) for what changed. Licensed under the [MIT License](LICENSE).

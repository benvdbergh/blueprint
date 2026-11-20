# Product Engineering Blueprint

[![npm](https://img.shields.io/npm/v/product-blueprint)](https://www.npmjs.com/package/product-blueprint)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

Product documentation that **humans and AI agents keep in line with the code**.

```bash
npx product-blueprint init            # in an empty folder or an existing repository
```

You get eight short documents that describe what the product is for and how it's built, one set of rules for every agent (`AGENTS.md`), and five workflows written as plain instructions. Your agent follows them on demand, or on a schedule as a Claude Code scheduled task: "Follow `blueprint/workflows/sync.md`". There are no GitHub Actions, scripts or config files to maintain.

## What lands in your repository

```
AGENTS.md                         rules for every agent and person (single source)
CLAUDE.md, .claude/commands/      → AGENTS.md, plus /blueprint-sync, /blueprint-audit, … (claude provider)
.cursor/rules/blueprint.mdc       → AGENTS.md (cursor provider)
.github/copilot-instructions.md   → AGENTS.md (copilot provider)
blueprint/
  README.md                       index, conventions, which document covers which code
  00-product-core.md … 07-roadmap.md
  workflows/                      sync · audit · review · define-feature · onboard
  .install.json                   what was installed, for upgrades
```

`features/`, `decisions/`, `deviations/` and `prototypes/` appear in `blueprint/` once you add the first spec, ADR, deviation or prototype.

## The workflows

| File | What the agent does | Changes | Run it |
|---|---|---|---|
| [`sync.md`](blueprint/workflows/sync.md) | Reads recent commits and updates the documents they made outdated | blueprint docs, via a PR | daily scheduled task, or after merges |
| [`audit.md`](blueprint/workflows/audit.md) | Compares the whole blueprint with the code and reports the mismatches that matter | nothing (report only) | weekly scheduled task |
| [`review.md`](blueprint/workflows/review.md) | Checks a branch or PR against the blueprint and says which docs need an update | nothing (comment or report) | on demand, or on open PRs |
| [`define-feature.md`](blueprint/workflows/define-feature.md) | Turns a request into a feature spec with acceptance criteria | `features/`, 01, 07 | on demand |
| [`onboard.md`](blueprint/workflows/onboard.md) | Drafts the blueprint from an existing codebase | 01–07, via a PR | once |

Each file says when it runs, what it may change, how to decide when the code and the docs disagree, when to stop, and what to report. They work with any agent that can read files and run `git`. Opening PRs or comments needs `gh` or an equivalent; otherwise the agent reports in its final message.

## Running the workflows on a schedule

The workflows are the whole automation. There is no CI, no script and no config file behind them: an agent reads the instruction file and does what it says. To run one regularly, create a scheduled task in Claude (Claude Code on the web or the desktop app) for your repository and give it a one-line prompt that points at the file:

| Task | Prompt | Schedule |
|---|---|---|
| Blueprint sync | `Follow blueprint/workflows/sync.md` | daily, or after merges |
| Blueprint audit | `Follow blueprint/workflows/audit.md` | weekly |
| PR review (optional) | `Follow blueprint/workflows/review.md for the open pull requests` | daily |

A few things to know:

- **The prompt only points at the file.** The instructions live in the repository, so a change to `sync.md` is reviewed in a PR like any other change, and the next run picks it up. Don't copy the instructions into the task.
- **Add context after the pointer** when you need it, for example `Follow blueprint/workflows/sync.md. Only look at commits since Monday.` The workflow treats it as notes from the person.
- **Give the task access to GitHub** if it should open a PR (`sync`, `onboard`, `define-feature`) or comment (`review`). Without it, the agent reports in its final message instead.
- **Other agents work the same way.** Any agent that can read files and run `git` can follow the files, on demand or from its own scheduler. In Claude Code the slash commands (`/blueprint-sync`, `/blueprint-audit`, …) do the same on demand.

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
2. Set up the `sync` and `audit` scheduled tasks (see [Running the workflows on a schedule](#running-the-workflows-on-a-schedule)).
3. **Lovable:** `init --providers lovable` prints a short text to paste into Lovable's project Knowledge. Connect Lovable to a working branch so its changes arrive as PRs that `review` can check.

### Upgrading

`npx product-blueprint@latest upgrade` refreshes every installed file you haven't edited, including blueprint documents that are still the untouched template. Files you edited are kept and listed.

**From 0.2 or earlier:** `upgrade` also removes what those versions installed and this one no longer needs: the GitHub Actions (`wf01`–`wf07`), `.github/actions/`, the PR template and issue forms, `scripts/`, `templates/`, `contracts/README.md`, `governance/` and the `_TEMPLATE.md` files. It removes a file only if it's still exactly what was installed, and keeps the old scripts while a workflow you edited still calls them. `.gitignore` and `CODEOWNERS` are left in place. Plain `init` on such a setup lists these files without deleting anything. Run it on a branch and review the diff.

## Contributing and license

Contributions are welcome: see [CONTRIBUTING.md](CONTRIBUTING.md) for development and release steps (the npm release workflow is the only GitHub Action in this repository), [SECURITY.md](SECURITY.md) to report a vulnerability, and [CHANGELOG.md](CHANGELOG.md) for what changed. Licensed under the [MIT License](LICENSE).

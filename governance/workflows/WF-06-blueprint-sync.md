# WF-06 · Blueprint Synchronization

`Event-triggered` · `AI-powered`

**Purpose.** Keep the eight documents up to date and consistent with each other as the application evolves. This is the most important workflow in an AI-assisted setup.

| | |
|---|---|
| **Triggers** | Push to `main` (= merged PR) · significant blueprint change · approved decision · manual dispatch with a commit range |
| **Inputs** | `git diff before..after` · the PR's impact table · the affected documents only · `governance/config.json` |
| **Runtime** | `.github/workflows/wf06-blueprint-sync.yml` → Claude Code Action running the `wf06-blueprint-sync` prompt (`blueprint prompt`; the repository's `.claude/commands/` copy wins) |
| **May write** | Documents whose `aiWorkflows` include WF-06 (01–07), on a branch `blueprint-sync/<sha>`, opened as a PR labelled `blueprint-sync`, `ai-proposal`. **Never 00. Never pushes to `main`.** |

## Flow
| # | Step |
|---|---|
| 1 | Analyse the diff (skip lockfiles, generated files) |
| 2 | Identify affected documents using `impactRules` + judgement, and take the merged PR's impact table into account (`proposed` rows are the to-do list) |
| 3 | Read **only** those documents |
| 4 | Compare implementation with documented intent |
| 5 | Identify missing or outdated information |
| 6 | Make precise, minimal edits (no rewrites, no reformatting, keep the author's voice) |
| 7 | Cross-document consistency: terms (03 glossary), IDs, screen inventory ↔ routes, roadmap status ↔ feature status, ADR index ↔ ADR files |
| 8 | Run `check-blueprint`; open a docs PR with a table *Document · Change · Evidence*. If a change would touch an `approved` section, describe it in the PR and leave the decision to the owner. If nothing needs to change, open no PR and say why in the job summary. |

## Example: "new exercise creation workflow" merged
| Document | Required update |
|---|---|
| 00 Product Core | Usually none |
| 01 Product | New feature and behaviour |
| 02 UX & Design | New screens and interactions |
| 03 Domain & Data | Exercise entity changes, if applicable |
| 04 Architecture | Only if architecture changes |
| 05 Interfaces | New API contracts, if applicable |
| 06 Deployment | Usually none |
| 07 Roadmap | Delivery status and milestone |

That is better than asking an AI to "update all eight documents" after every change.

## Outputs
Consistent blueprint · updated specs · explicitly identified documentation gaps · cross-document consistency report (in the PR body).

## Loop prevention
The workflow skips commits made by blueprint-sync PRs (branch prefix `blueprint-sync/`, or `[skip blueprint-sync]` in the message) and commits that only touch `blueprint/`.

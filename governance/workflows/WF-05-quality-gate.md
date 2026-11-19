# WF-05 · Code Quality & Implementation Validation

`Every pull request` · `CI pipeline` · **Hard gate**

**Purpose.** The same minimum quality bar for every change, whoever or whatever wrote it.

| | |
|---|---|
| **Triggers** | Every PR (opened, synchronize, reopened, edited, labeled) · every push to `main` |
| **Runtime** | `.github/workflows/wf05-quality-gate.yml` (code) and `.github/workflows/wf05-governance-gate.yml` (blueprint/governance). Each ends in a single summary job: **`quality-gate`** and **`governance-gate`**. Both are required status checks. |
| **AI involvement** | None. The gate is deterministic on purpose: no agent can bypass it because it believes its implementation is correct. |

## Checks
| # | Check | Implementation | Fails the gate |
|---|---|---|---|
| 1 | Lint & formatting | `run lint` | yes (if defined) |
| 2 | Type checking | `run typecheck` | yes (if defined) |
| 3 | Unit tests | `run test` | yes (if defined) |
| 4 | Integration tests | `run test:integration` | yes (if defined) |
| 5 | End-to-end tests | `run test:e2e` | yes (if defined) |
| 6 | Build | `run build` | yes (if defined) |
| 7 | Dependency & security scan | `npm audit --audit-level=high` (npm projects), dependency-review on PRs if enabled | yes |
| 8 | Architectural constraints | `run check:architecture` | yes (if defined) |
| 9 | Documentation obligations | `check-blueprint`, `check-protected`, `check-impact`, `trace`, `terminology` | yes, except terminology and trace (warnings), unless a feature is `implemented` |

## Making it a hard gate
Run `scripts/setup/configure-github.sh` (or set it up by hand):
- Branch protection on `main`: require PRs, require status checks `quality-gate` and `governance-gate`, require review from Code Owners, dismiss stale approvals, **include administrators**.
- No bypass actors for bots.

## Lovable caveat
Lovable commits to the branch it is connected to. If that branch is `main`, its commits skip PR checks. Pick one:
1. Point Lovable at a working branch (e.g. `lovable`) and merge to `main` through PRs (recommended), or
2. Accept direct commits and rely on the push-to-`main` run of WF-05, which opens an issue when it fails, plus WF-06/WF-07 after the fact.

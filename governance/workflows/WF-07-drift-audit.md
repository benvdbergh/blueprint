# WF-07 · Product & Engineering Drift Audit

`Scheduled` · `AI-powered`

**Purpose.** Find inconsistencies that individual PRs miss: slow drift, gaps between PRs, and cross-cutting issues.

| | |
|---|---|
| **Triggers** | Weekly (Monday 06:17 UTC) · manual dispatch (e.g. at a milestone) |
| **Inputs** | `health-facts.json` (deterministic) · the whole blueprint · the code · latest WF-05 result on `main` · the previous health report |
| **Runtime** | `.github/workflows/wf07-drift-audit.yml`: `blueprint facts` → Claude Code Action (`blueprint prompt wf07-drift-audit`) → issue labelled `health-report` |
| **May write** | `health-report.md` only (repo permissions are read-only; a guard step fails if any other file changed). Fixes are **proposed** as task lists in the report. Pick them up with `/wf06-blueprint-sync` or a normal PR. |

## Comparisons
| Comparison | Detects |
|---|---|
| Blueprint ↔ Code | Documented functionality that doesn't exist; undocumented functionality |
| Blueprint ↔ UI | Screens and interactions that deviate from 02 (routes vs screen inventory) |
| Blueprint ↔ Architecture | Implementation that violates 04 or accepted ADRs |
| Blueprint ↔ Tests | Acceptance criteria without tests (`trace.mjs`) |

## Additional checks
Orphaned components · unused API endpoints · missing acceptance criteria · duplicate domain concepts · inconsistent terminology · outdated prototypes · unresolved ADRs · roadmap items whose status doesn't match the implementation · stale documents (`last_reviewed` > 90 days) · open deviations past `review_by`.

## Output
The **Product Engineering Health Report** (`npx product-blueprint@0.3.0 docs health-report`): eight dimensions rated Healthy / Warning / Critical, findings by severity with evidence and recommended action, plus the trend against the previous report.

## Guardrail
The audit reports and proposes. It never rewrites approved product decisions.

---
description: WF-07 — Product & Engineering drift audit → Health Report (read-only)
argument-hint: [path to health-facts.json; generated if missing]
---

# WF-07 · Product & Engineering Drift Audit

Facts: $ARGUMENTS (if empty: `health-facts.json`)

This audit is **read-only**. The only file you may write is `health-report.md` in the repository root. Don't edit anything else, don't commit, don't open PRs.

## Steps
1. If the facts file is missing, run `node scripts/governance/health-facts.mjs --out health-facts.json`. Read it first. It holds the deterministic results, so don't re-derive them; build on them.
2. Read `governance/health-report-template.md`, `governance/config.json`, all of `blueprint/` and, if provided in the context, the previous report.
3. Do the four comparisons, sampling the code with Grep/Glob rather than reading everything:
   - **Blueprint ↔ Code:** each feature at `approved`/`in-progress`/`implemented`: does the behaviour exist? Significant code paths (routes, edge functions, tables) that no feature or document describes.
   - **Blueprint ↔ UI:** routes in the router vs the 02 screen inventory; components that bypass the design system (hard-coded colours, ad-hoc components duplicating `components/ui`); prototypes older than the implemented screen.
   - **Blueprint ↔ Architecture:** module table and boundaries in 04, accepted ADRs vs actual imports, dependencies and infrastructure. Migrations vs the 03 domain model (entities, invariants, RLS).
   - **Blueprint ↔ Tests:** use `traceability` from the facts; also look at features whose criteria are referenced but trivially tested.
4. Additional checks: orphaned components (exported, never imported), unused API endpoints (in `contracts/` or functions, never called), missing acceptance criteria, duplicate domain concepts (two names or tables for one concept), terminology (facts + your own reading), outdated prototypes, unresolved ADRs, roadmap status vs implementation, stale documents (`days_since_review` > 90), open deviations past `review_by`.
5. Rate each of the 8 dimensions 🟢 Healthy / 🟡 Warning / 🔴 Critical. Critical = an approved requirement is violated, a security/data-integrity risk, or the gate is failing on `main`.
6. Write `health-report.md` following the template. Every finding needs evidence (`file:line`, document section, or fact key) and one recommended action: *fix code*, *propose blueprint change* (via WF-06/WF-01), *record deviation*, or *decide* (name the authority from `config.json`). Where a fix is low-risk, include the exact proposed text or patch in a collapsible `<details>` block. **Propose, don't apply.**
7. Be calibrated: no padding. If a dimension can't be assessed (e.g. there is no UI yet), say "not assessable" and why instead of guessing.

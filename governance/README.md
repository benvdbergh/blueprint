# Engineering Governance & Automation

How this product is **built and kept consistent**. This is deliberately separate from the eight blueprint documents, which describe **what the product is**.

Lovable, Cursor, Claude Code and humans are interchangeable contributors. Continuity comes from three things they all share: the **repository**, the **blueprint**, and the **automated quality gates**.

```
           ┌──────────────────────── Feedback into blueprint and implementation ───────────────────────┐
           ▼                                                                                            │
  Product knowledge (blueprint 00–07) ─┬─► UX & Design (WF-02)  ─┐                                       │
  WF-01 Product & feature definition    └─► Arch & Domain (WF-03/04) ─► Implementation ─► Testing (WF-05) ─► Documentation (WF-06) ─► Drift checks (WF-07)
                                                                  (Lovable · Claude Code · Cursor · humans)
```

---

## 1. Non-negotiable rules

| # | Rule | How it is enforced |
|---|---|---|
| 1 | **Git is the shared source of truth.** No separate Lovable, Cursor or Claude documentation. | `AGENTS.md` is the only instruction file; tool-specific files (`CLAUDE.md`, `.cursor/rules`, Lovable knowledge) only point to it. |
| 2 | **Approved specifications are protected.** AI proposes, humans approve. | `check-protected` (WF-05) + `CODEOWNERS` + the `blueprint:approved-change` label. |
| 3 | **Implementation changes require impact analysis.** | PR template impact table + `check-impact` (WF-05). |
| 4 | **Generated artifacts are generated.** | OpenAPI is the contract (WF-04); Swagger UI, types and clients derive from it or from code, never the reverse by hand. |
| 5 | **Tests validate behaviour; documentation describes intent.** | Acceptance criteria IDs (`AC-nnn.n`) are referenced from tests; `trace` connects them. |
| 6 | **Every deviation is explicit.** | `blueprint/deviations/DEV-nnn-*.md`; `check-impact` accepts `deviation` + a DEV reference. |
| 7 | **Automate detection before remediation.** | AI workflows open PRs, comments and issues. They never merge, and they never push to `main`. |

---

## 2. Ownership model

Not every workflow may modify every document. Machine-readable version: [`config.json`](config.json) → `documents`.

| Blueprint document | Primary authority | AI workflows allowed to propose |
|---|---|---|
| 00 Product Core | Product owner | WF-01 (as an **issue**, never a file edit) |
| 01 Product | Product management | WF-01, WF-06 |
| 02 UX & Design | UX / Product | WF-02, WF-06 |
| 03 Domain & Data | Architecture | WF-03, WF-06 |
| 04 Architecture | Architecture | WF-03, WF-06 |
| 05 Interfaces | API / Engineering | WF-04, WF-06 |
| 06 Deployment | Engineering / Operations | WF-03, WF-06 |
| 07 Roadmap | Product management | WF-01, WF-06 |

"Propose" means opening or updating a pull request (or an issue for 00). The authority reviews it. If the target document is `approved`, the authority also applies the `blueprint:approved-change` label. `.github/CODEOWNERS` maps each file to the people who hold the authority.

---

## 3. Workflow catalogue

| WF | Name | Trigger | Runtime | Gate? | Phase |
|---|---|---|---|---|---|
| [WF-01](workflows/WF-01-feature-definition.md) | Product & Feature Definition | Issue labelled `wf-01:define`; `/wf01-define-feature` interactively | Claude Code (Action or local) | Human approval of the draft PR | 2 |
| [WF-02](workflows/WF-02-ux-sync.md) | UX & Design Synchronization | PR touching screens/components/tokens | Actions: Playwright visual tests; optional Claude review | Visual tests are required **once they exist** | 3 |
| [WF-03](workflows/WF-03-architecture-integrity.md) | Architecture & Data Integrity | PR touching migrations, schema, deps, infra | Actions: impact rules + boundary check; Claude review comment | Impact rule (`require`) is gating; the AI review is advisory | 3 |
| [WF-04](workflows/WF-04-api-contracts.md) | API & Integration Contract Sync | PR touching `contracts/` or API code | Actions: Redocly lint, oasdiff, contract tests | Yes, breaking changes need `api:breaking-approved` | 3 |
| [WF-05](workflows/WF-05-quality-gate.md) | Code Quality & Implementation Validation | Every PR and push to `main` | Actions (deterministic only) | **Hard gate** (required status checks) | 1 |
| [WF-06](workflows/WF-06-blueprint-sync.md) | Blueprint Synchronization | Push to `main` (merged PR); manual | Claude Code Action → docs PR | Human review of docs PR | 2 |
| [WF-07](workflows/WF-07-drift-audit.md) | Product & Engineering Drift Audit | Weekly (Mon 06:17 UTC); manual; milestones | Deterministic facts + Claude audit → Health Report issue | Report only | 4 |

### Where things run

| Runtime | Role | Never used for |
|---|---|---|
| **GitHub Actions** | Orchestration: CI, deterministic checks, schedules, triggers. Runs the Claude Code Action for the AI workflows. | — |
| **Claude Code** | Impact analysis, documentation sync, architecture review, drift audit, complex refactoring (locally or in Actions). | Merging, pushing to `main`, editing 00. |
| **Cursor** | Interactive development and blueprint maintenance. Reads `AGENTS.md`. Not a CI dependency. | Being the only place a rule lives. |
| **Lovable** | Visual development, preview and publishing against the same repo. | Holding project knowledge that isn't in Git. |

### Deterministic vs AI

Everything that *can* be checked deterministically is a script in `scripts/governance/` and runs in WF-05. AI workflows start from those results, not instead of them:

| Script | Checks | Used by |
|---|---|---|
| `check-blueprint.mjs` | Front matter, naming, statuses, acceptance criteria, ID references | WF-05, WF-06, WF-07 |
| `check-protected.mjs` | Changes to approved / core documents carry the approval label | WF-05 |
| `check-impact.mjs` | PR impact table is complete and truthful; path rules → documents | WF-05 |
| `trace.mjs` | Acceptance criteria ↔ tests (`AC-nnn.n` references) | WF-05 (warn / fail for `implemented`), WF-07 |
| `terminology.mjs` | Words from the *Avoid* column of the glossary in 03 | WF-05 (warn), WF-07 |
| `health-facts.mjs` | Aggregates all of the above + activity, ADRs, deviations, roadmap | WF-07 |

---

## 4. Script contract

CI calls these `package.json` scripts **if they exist**. Missing scripts are skipped with a notice, so the template works before there is an app. As soon as you add a script, it becomes part of the gate. Make one mandatory with `--required` in `wf05-quality-gate.yml`.

| Script | Expectation | Workflow |
|---|---|---|
| `lint` | ESLint / formatter check, no writes | WF-05 |
| `typecheck` | `tsc --noEmit` | WF-05 |
| `test` | Unit tests | WF-05 |
| `test:integration` | Integration tests | WF-05 |
| `test:e2e` | End-to-end (Playwright) | WF-05 |
| `build` | Production build | WF-05 |
| `check:architecture` | Boundary rules from 04 (see `templates/dependency-cruiser.cjs`) | WF-05, WF-03 |
| `test:visual` | Visual regression (Playwright `toHaveScreenshot`) | WF-02 |
| `check:openapi` | Regenerate the OpenAPI spec from code and fail if `contracts/` differs | WF-04 |
| `test:contract` | API contract tests against the spec | WF-04 |

---

## 5. Phased implementation

| Phase | Contents | In this template |
|---|---|---|
| **1 · Engineering foundation** | `AGENTS.md`, blueprint conventions, Actions baseline, lint/type/build/test, PR template | ✅ Ready. Run `scripts/setup/configure-github.sh` to create labels and branch protection. |
| **2 · Blueprint synchronization** | WF-06 docs sync, change-impact analysis, cross-document consistency, AI docs PRs; WF-01 | ✅ Ready once `ANTHROPIC_API_KEY` is set. Until then AI jobs skip with a notice. |
| **3 · UX & architecture governance** | WF-02 visual validation, WF-03 architecture validation, WF-04 OpenAPI sync, migration checks | ✅ Workflows ready. They activate when the app adds `test:visual`, `check:architecture`, `contracts/openapi.yaml`. |
| **4 · Autonomous quality management** | WF-07 weekly drift audit, Health Report, tech-debt detection, remediation proposals | ✅ Audit + report ready. Automatic remediation is **off** on purpose (rule 7); enable it per finding type when the findings have proven reliable. |

Every workflow can be enabled or disabled through repository variables (`WF0x_ENABLED=false`), so you can roll out one phase at a time.

---

## 6. Product Engineering Health Report

Generated by WF-07 as a GitHub issue labelled `health-report`; the previous report is closed. The raw facts are kept as a workflow artifact. Format: [`health-report-template.md`](health-report-template.md).

| Dimension | Example checks | Source |
|---|---|---|
| Product integrity | Features match requirements; roadmap matches implementation | facts + AI |
| UX integrity | UI matches screen inventory and prototypes; outdated prototypes | facts + AI |
| Architecture | No boundary violations; unresolved ADRs | `check:architecture` + AI |
| Data integrity | Migrations match domain model in 03 | AI |
| API integrity | OpenAPI matches implementation; unused endpoints | WF-04 + AI |
| Code quality | Tests, lint, types, build on `main` | latest WF-05 run |
| Documentation | Blueprint completeness, staleness, terminology, cross-doc consistency | facts + AI |
| Operations | Dependency vulnerabilities, deployment health | `npm audit` + AI |

Status per dimension: 🟢 **Healthy** · 🟡 **Warning** · 🔴 **Critical**. Every finding gets a severity, evidence, and a recommended action (*fix code*, *propose blueprint change*, *record deviation*, or *decide*).

---

## 7. Secrets, variables and labels

| Kind | Name | Purpose |
|---|---|---|
| Secret | `ANTHROPIC_API_KEY` | Claude Code Action (WF-01, 02, 03, 06, 07). Alternatively, use `CLAUDE_CODE_OAUTH_TOKEN` and change the `with:` input. |
| Secret (recommended) | `GOVERNANCE_BOT_TOKEN` | A GitHub App or fine-grained token for PRs opened by AI workflows. PRs opened with the default `GITHUB_TOKEN` **do not trigger other workflows**, so WF-05 would not run on them. |
| Variable | `WF01_ENABLED` … `WF07_ENABLED` | Set to `false` to disable a workflow. |
| Variable | `CLAUDE_MODEL` | Optional model override for AI workflows. |
| Labels | `wf-01:define`, `blueprint:approved-change`, `api:breaking-approved`, `ai-proposal`, `blueprint-sync`, `health-report`, `deviation` | Created by `scripts/setup/configure-github.sh`. |

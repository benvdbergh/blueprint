# WF-03 · Architecture & Data Integrity

`Event-triggered` · `Critical`

**Purpose.** Stop architecture, database and domain model from slowly diverging.

| | |
|---|---|
| **Triggers** | Migration · new entity/relationship · new service/module · significant refactor · dependency or technology change |
| **Inputs** | 03 Domain & Data · 04 Architecture · 06 Deployment · the PR diff · migrations · ADRs |
| **Runtime** | Gate: `check-impact` (migrations ⇒ 03 is `require`) + `check:architecture` in WF-05. Review: `.github/workflows/wf03-architecture-review.yml` posts a Claude review comment on the PR. |
| **May write** | PR comments; suggested changes to 03/04/06; draft ADRs. Does not push to the contributor's branch. |

## Flow
| # | Step | Who |
|---|---|---|
| 1–2 | Read 03 and 04 | AI |
| 3 | Analyse the proposed implementation (diff) | AI |
| 4 | Compare actual schema/relationships (migrations) with the domain model | AI |
| 5 | Check boundaries and dependencies | `check:architecture` (deterministic) + AI |
| 6 | Check security, permissions (RLS), data integrity (constraints, cascades) | AI |
| 7 | Identify required documentation and migration updates | `check-impact` + AI |
| 8 | Post a review: proposed blueprint update, ADR draft, or flagged deviation | AI → human decides |

## Outputs
Validated architecture · consistent domain model · proposed documentation updates · ADRs where needed.

## Principle
**Migrations are the technical truth** for the actual database. **03 is the intended model and its meaning.** A mismatch is resolved by changing one of them or by recording a `DEV-nnn`. It is never left implicit.

# WF-01 · Product & Feature Definition

`Event-triggered` · `Human approval`

**Purpose.** Every new feature starts with a definition rather than going straight to code.

| | |
|---|---|
| **Triggers** | New feature or initiative · changed requirements · submitted user story. In practice: an issue from the *Feature request* form labelled `wf-01:define`, or `/wf01-define-feature` in Claude Code. |
| **Inputs** | The issue/request · 00 Product Core · 01 Product · relevant 02–05 · existing features, ADRs, deviations · 07 Roadmap |
| **Runtime** | `.github/workflows/wf01-feature-definition.yml` → Claude Code Action running `.claude/commands/wf01-define-feature.md` |
| **May write** | `blueprint/features/FEAT-*.md` (new, `status: proposed`), `blueprint/prototypes/`, 01, 07 (scope/priority **proposals**). Never 00. |

## Flow
| # | Step | Who |
|---|---|---|
| 1 | Read Product Core (00) | AI |
| 2 | Analyse the request against Product (01): is it new, an extension, or a conflict? Out of scope per 00? | AI |
| 3 | Identify affected UX, domain, architecture and interface specifications (02–05) | AI |
| 4 | Identify dependencies and conflicts (features, ADRs, open deviations) | AI |
| 5 | Create or update the feature spec from `features/_TEMPLATE.md` with numbered acceptance criteria | AI |
| 6 | Create a UX prototype if the feature introduces or changes screens | AI (optional) |
| 7 | Propose changes to Roadmap & Delivery (07) if scope or priorities change | AI |
| 8 | Open a **draft PR** labelled `ai-proposal`, `wf-01`, and comment a summary + open questions on the issue | AI |
| 9 | Review, answer open questions, set `status: approved`, merge | **Human (Product)** |

If the request conflicts with 00, the agent stops at step 2 and comments on the issue. It never edits 00.

## Outputs
Defined feature requirements · acceptance criteria · list of affected blueprint documents · implementation-ready scope (a feature at `approved`).

## Guardrails
- Agents propose; they don't silently change product strategy or approved requirements (`check-protected`).
- The PR must pass WF-05 like any other change.

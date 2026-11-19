---
description: WF-01 — turn a feature request into a proposed feature spec (no code)
argument-hint: <feature request text, or issue number>
---

# WF-01 · Product & Feature Definition

Request: $ARGUMENTS

If the request is an issue number, read it with `gh issue view <n> --comments`. In CI, the issue number is given in the prompt context.

You are **defining**, not implementing. Write no application code.

## Steps
1. Read `AGENTS.md`, `governance/config.json`, `blueprint/00-product-core.md` and `blueprint/01-product.md`.
2. **Fit check against 00 and 01.** Classify the request as *new feature*, *extension of FEAT-nnn*, *conflict with an existing feature or rule*, or *out of scope per 00*.
   - Out of scope or in conflict with 00: **stop**. Explain why in the result (in CI: comment on the issue) and suggest what would have to change in 00. 00 is never edited by an agent.
3. Read only the relevant parts of 02–05, existing `blueprint/features/`, `blueprint/decisions/` and open `blueprint/deviations/`. List the affected documents and any dependencies or conflicts.
4. Create `blueprint/features/FEAT-nnn-<kebab-name>.md` from `_TEMPLATE.md` (next free number; check existing files). Set `status: proposed`, fill `docs:` and `source:`. Write testable acceptance criteria `AC-nnn.1…` in Given/When/Then form. Each criterion must be observable from outside the code.
   - Extending an existing feature: add new criteria with the next free numbers. If that feature is `approved`, don't change its existing criteria; list the proposed changes under *Open questions* instead.
5. If the feature adds or changes screens, add a minimal prototype to `blueprint/prototypes/FEAT-nnn-<name>.md` (layout description + states; a static HTML file if useful) and add rows to the screen inventory in 02 with status `designed`.
6. Add the feature to `blueprint/01-product.md` (capability map) and to the **Next** section of `blueprint/07-roadmap.md`. Don't reorder existing priorities. If the feature should displace something, say so under *Open questions*.
7. Run `node scripts/governance/check-blueprint.mjs` and fix what it reports.
8. Summarise: feature ID, classification, affected documents, dependencies/conflicts, and open questions for the product owner.

## Output
- **Interactive:** show the summary, then offer to create a branch and open a draft PR (title `WF-01: FEAT-nnn <title>`, labels `ai-proposal`, `wf-01`, body = filled `.github/pull_request_template.md` + summary).
- **In CI:** don't commit, push or comment yourself. The workflow prompt says where to write the PR title, PR body and issue comment. The workflow checks the changed paths against the ownership model (`scripts/governance/guard-paths.mjs --workflow WF-01`), then commits and opens the draft PR.

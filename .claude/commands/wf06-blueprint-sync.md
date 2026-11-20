---
description: WF-06 — propose blueprint updates for merged changes (docs-only PR)
argument-hint: <commit range, e.g. abc123..def456; default HEAD~1..HEAD>
---

# WF-06 · Blueprint Synchronization

Range: $ARGUMENTS (if empty: `HEAD~1..HEAD`)

You keep the blueprint aligned with what was merged. Change documentation only, never code.

## Steps
1. **Diff.** `git log --format='%h %s' <range>` and `git diff --stat <range>`, then read the relevant hunks. Ignore lockfiles, generated files and pure formatting. If the merge came from a PR, read its body (`gh pr list --state merged --search <sha>`). Rows marked `proposed` in its impact table are your to-do list, and rows marked `updated` are already done.
2. **Affected documents.** Match changed paths against `governance/config.json` → `impactRules`, then use judgement: a rule match doesn't always mean a change is needed, and a change can be needed without a rule match. Produce the list with a one-line reason each.
3. **Read only those documents** (plus feature specs and ADRs they reference).
4. **Compare** implementation against documented intent. Look for new or changed behaviour, screens, entities, endpoints, config and dependencies, and feature status (e.g. a feature whose acceptance criteria are now all implemented and tested → `implemented`, and the 07 status follows).
5. **Edit precisely.** Minimal diffs. Preserve headings, IDs and wording elsewhere. Update `last_reviewed` on every document you verified.
   - Only documents whose `aiWorkflows` include WF-06. **Never 00.**
   - If the change you'd make touches a document or feature with `status: approved` and **alters intent** (requirements, acceptance criteria, rules), don't edit it. List it under *Needs owner decision* instead. Factual additions (screen inventory row, ADR index row, delivery log row) are fine.
   - If the implementation looks wrong rather than the docs outdated, don't document the bug. List it under *Possible implementation drift* and suggest a `DEV-nnn` or a fix.
6. **Cross-document consistency:** glossary terms used consistently; every FEAT/ADR/DEV reference resolves; 02 screen inventory ↔ router; 04 ADR index ↔ `blueprint/decisions/`; 07 status ↔ feature `status`; 05 ↔ `contracts/openapi.yaml`.
7. `npx product-blueprint@0.3.0 check blueprint` must pass.
8. **Result.** If nothing needs changing, edit nothing and say so with the reasons. Otherwise prepare a PR body: the PR template's impact table (rows you changed `updated`, others `none`), then **Changes** (*Document · Change · Evidence (commit/file)*), **Needs owner decision**, **Possible implementation drift**, **Consistency check** results.
   - **Interactive:** offer to commit on a branch `blueprint-sync/<sha>` with message `docs(blueprint): sync <range> [skip blueprint-sync]` and open the PR (labels `blueprint-sync`, `ai-proposal`).
   - **In CI:** don't commit or push. Write the files the workflow prompt names. The workflow verifies the changed paths (`guard-paths.mjs --workflow WF-06`), then commits and opens the PR.

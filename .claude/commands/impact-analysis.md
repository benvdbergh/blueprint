---
description: Blueprint impact analysis for the current branch — fills the PR impact table
argument-hint: [base ref, default origin/main]
---

# Impact analysis

Base: $ARGUMENTS (if empty: `origin/main`)

1. `git diff --stat <base>...HEAD` and read the diff (skip lockfiles and generated files).
2. Read `governance/config.json` (`documents`, `impactRules`) and determine which rules match.
3. For each blueprint document 00–07, decide: `none`, `updated` (you changed it in this branch), `proposed` (needs a follow-up; create the issue with `gh issue create` if the user agrees), or `deviation` (the code intentionally differs: create `blueprint/deviations/DEV-nnn-*.md`).
   Read the relevant section of each document before deciding. Don't guess from file names alone.
4. For features touched: check that tests reference their `AC-nnn.n` IDs (`npx product-blueprint@0.3.0 check trace`).
5. Output the filled table exactly in the PR template format:

| Doc | Impact | Note |
|---|---|---|
| 00 Product Core | none | |
| … | | |

6. Validate: write the PR body to a temp file and run `npx product-blueprint@0.3.0 check impact --base <base> --body-file <file>`.

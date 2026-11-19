---
description: WF-03 — review a change against the domain model and architecture (advisory)
argument-hint: [PR number or base ref]
---

# WF-03 · Architecture & Data Integrity review

Target: $ARGUMENTS (PR number → `gh pr diff <n>`; otherwise `git diff origin/main...HEAD`)

You review; you do not modify the contributor's code.

1. Read `blueprint/03-domain-data.md`, `blueprint/04-architecture.md`, and `blueprint/06-deployment.md` when the change touches infrastructure, plus accepted ADRs in `blueprint/decisions/`.
2. Read the diff. Focus on migrations, schema files, new modules/services, dependency changes, auth/permission code.
3. Check and report:
   - **Schema ↔ domain model:** new or changed tables, columns, relationships and constraints compared with the entities and invariants in 03. Missing entities, renamed concepts, terms from the *Avoid* column.
   - **Boundaries:** imports that violate the module table in 04; new dependencies (justified? ADR needed?).
   - **Security & integrity:** RLS enabled and policies consistent with the *Data ownership & access* table; service-role usage; cascades/deletes; nullable foreign keys; missing indexes on FKs; destructive migrations without a data plan.
   - **Documentation:** what 03/04/06 need to say after this change (give the concrete text), whether an ADR is warranted (draft its Context/Decision in 3–5 lines), or whether a `DEV-nnn` should be recorded.
4. Output one review, ≤ 60 lines:
   `### WF-03 architecture review` → verdict (✅ consistent / ⚠️ needs blueprint update / ❌ conflicts with the blueprint) → findings table *Severity · Finding · Evidence (file:line) · Suggested action* → proposed blueprint text, if any.
5. **Interactive:** show the review. **In CI:** write it to the file the workflow prompt names; the workflow posts or updates a single PR comment.

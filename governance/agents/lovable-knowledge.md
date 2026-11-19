# Lovable project knowledge

Paste the block below into **Lovable → Project settings → Knowledge** (or set it with the Lovable MCP `set_project_knowledge`). Keep it short: the real rules live in the repository, and Lovable should read them there.

---

This project is governed by the files in its GitHub repository. Before making changes:

1. Read `AGENTS.md` (shared rules for all agents) and `blueprint/00-product-core.md`.
2. For UI work, follow `blueprint/02-ux-design.md`: use the existing design tokens and components in `src/components/ui/`. Don't introduce new colours, spacing or one-off components unless the request asks for them.
3. Use the domain terms from the Ubiquitous language table in `blueprint/03-domain-data.md`.
4. Database changes go through migrations. When you add or change tables, columns or policies, also update the domain model in `blueprint/03-domain-data.md`, or tell me it needs updating.
5. Never edit files in `blueprint/` that have `status: approved` in their front matter, and never edit `blueprint/00-product-core.md`. Tell me what should change instead.
6. Don't modify `.github/`, `governance/` or `scripts/governance/`.

When a request conflicts with the blueprint, say so before implementing.

---

**Recommended setup:** connect Lovable to a working branch (for example `lovable`) instead of `main`, and merge to `main` through pull requests. That way Lovable's changes pass the WF-05 quality gate before they reach `main`. See `governance/workflows/WF-05-quality-gate.md`.

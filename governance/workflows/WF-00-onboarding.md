# WF-00 · Onboarding: fill the blueprint from an existing codebase

`One-off` · `AI-powered` · `Interactive`

**Purpose.** Right after `blueprint init` in an existing repository, the blueprint is empty templates. This workflow turns what the code already shows into a first, reviewable draft of the blueprint, so the other workflows (WF-01…07) have something to check against. It runs once, in the developer's own agent (Claude Code, Cursor, Copilot, Codex, …), and ends in one pull request.

| | |
|---|---|
| **Triggers** | A person asks for it: *"Follow `governance/workflows/WF-00-onboarding.md`"*, or `/wf00-onboard` in Claude Code |
| **Inputs** | The codebase, its README and docs, `package.json` (or equivalent), migrations and schema, routes, CI/deploy config, git history |
| **May write** | `blueprint/01`–`07`, proposed ADRs in `blueprint/decisions/`, `governance/config.json` → `impactRules` paths, `AGENTS.md` → *Project specifics*. **Never `blueprint/00-product-core.md`.** Never code, tests, CI or generated files. |
| **Output** | One branch `blueprint/onboarding` and one PR for the owners to review |

## Ground rules
- **Evidence over imagination.** Every statement is either *seen in code* (give the path) or *inferred* (say so). Prefer a short true document over a complete-looking guess. Leave a section's template comment in place when there is nothing to say yet.
- **Proposals, not decisions.** Set `status: proposed` on every document you fill and update `last_reviewed`. Nothing becomes `approved` in this workflow: approval is the owner's step.
- **00 Product Core is the owner's.** Don't edit it. Draft what you'd suggest for it in the PR description and ask the owner to write it.
- **Describe, don't copy.** Link to the truth (migrations, `contracts/openapi.yaml`, token files, workflow files) instead of pasting it into prose.
- **Keep the structure.** Fill the existing headings and tables. Don't rename, reorder or delete sections. Remove a placeholder row (`<Term>`, `<Entity>`, …) once real rows replace it.
- **Drift is a finding, not a fix.** If the code looks inconsistent with itself or with its README, note it under *Open questions*; don't change code.
- **Ask when it's cheap.** If you're running interactively and a short question to the person would avoid a wrong guess (product purpose, target users, which environments exist), ask it before writing.

## Steps

### 1. Survey (read only)
Build a picture of the codebase before writing anything:
- `README*`, `docs/`, existing ADRs or design docs, `CONTRIBUTING*`.
- Manifest and tooling: `package.json` / `pyproject.toml` / `go.mod` / …, framework config (`vite.config.*`, `next.config.*`, `tsconfig*.json`, `tailwind.config.*`, `components.json`).
- Data: `supabase/migrations/`, `migrations/`, `prisma/schema.prisma`, `drizzle/`, generated types (`src/integrations/supabase/types.ts`, …).
- Interfaces: API routes, `supabase/functions/`, `server/`, `api/`, OpenAPI files, external SDK clients.
- UI: router and pages (`src/pages/`, `src/routes/`, `src/app/`), `src/components/`, design tokens.
- Delivery: `.github/workflows/` (other than the blueprint's own `wf0*`), `Dockerfile`, `vercel.json`, `netlify.toml`, `supabase/config.toml`, `.env.example`.
- History: `git log --oneline -50` and the main contributors' areas, for the roadmap's delivery log.

Write down the source paths you'll cite. Don't read `.env` files or secrets.

### 2. Configure the rules for this repository
- In `governance/config.json` → `impactRules`, make each rule's `paths` match where this repository actually keeps migrations, functions, screens, components and domain code. Keep the rule names, docs and levels. Add a path, don't invent new rules.
- In `AGENTS.md` → *7. Project specifics*, fill in stack, install and dev-server commands from the manifest. Change nothing else in `AGENTS.md`.

### 3. Fill the documents
Work from the most factual to the most interpretive. For each document, the sections below are what the code can usually support:

| Doc | Fill from | Notes |
|---|---|---|
| **04 Architecture** | Manifest, framework config, folder structure | *System context*, *Technology stack* (with versions), *Module structure & boundaries* as it is today, *Cross-cutting concerns* you can see (auth, logging, error handling). Propose an ADR (`status: proposed`) only for a decision that is plainly visible and load-bearing (e.g. Supabase as backend), and list it in the *Architecture decision log*. |
| **03 Domain & Data** | Migrations, schema, generated types, domain code | *Entities* (meaning, identity, lifecycle, invariants, tables), a Mermaid *Domain model*, *Data ownership & access* from RLS policies. *Ubiquitous language*: terms the code and UI already use, one per concept. Fill the *Avoid* column only with synonyms you actually found used for the same concept, because the terminology check flags them. |
| **05 Interfaces** | Routes, functions, SDK clients, OpenAPI | *API overview* (link `contracts/openapi.yaml` if there is one; don't generate it), *Internal interfaces*, *External integrations* with what each is used for. |
| **06 Deployment** | CI/deploy config, `.env.example`, hosting config | *Environments*, *Release process*, *Configuration & secrets* (names only, never values), *Observability* if present. |
| **02 UX & Design** | Router, pages, components, tokens | *Screen inventory* (one row per route), *Design system* tokens and components that exist, *Interaction patterns* you can see. Leave *Design principles* as questions for the owner. |
| **01 Product** | README, screens, routes, roles in code | *Capability map* of what the product does today (each capability → its screens/entities), *Roles & permissions* from the auth model, *Key user journeys* that the screens imply. Mark business rules as inferred unless the code enforces them. Don't create `FEAT-nnn` specs for existing capabilities; list them in the capability map. |
| **07 Roadmap** | Git history, open issues, TODOs | *Delivery log* from recent history. Leave *Now / Next / Later* to the owner, with any TODO or issue you found listed as candidates. |

End every document you touched with an **Open questions** list (as an HTML comment or a final `## Open questions` section) for its owner.

### 4. Check
```bash
node scripts/governance/check-blueprint.mjs     # must pass
node scripts/governance/terminology.mjs         # review any findings: fix the glossary or list them as drift
node scripts/governance/guard-paths.mjs --workflow WF-00   # only allowed files changed
```

### 5. Open the pull request
Branch `blueprint/onboarding`, commit message `docs(blueprint): onboarding draft from existing code`. The PR body:
1. The PR template's **Blueprint impact** table: `updated` for each document you changed, `none` for 00 with the note "owner to write; suggestions below".
2. **Suggested Product Core (00)**: vision, problem, target users, value proposition and scope boundaries as you'd infer them, clearly marked as suggestions for the owner to rewrite in their own words.
3. **What was filled** (*Document · Sections · Main sources*).
4. **Open questions** per owner (product, UX, architecture, operations).
5. **Possible drift** you noticed between code, README and behaviour.
6. **Next steps** for the owners: write 00, review and set `approved` per document, then switch `governance/config.json` → `enforcement` to `enforce` when the team is ready.

If you can't open PRs from where you run, commit on the branch and give the person the PR body to paste.

## Afterwards
The owners review per document. Once 00 is written and the documents they agree with are `approved`, the regular loop takes over: WF-01 for new features, WF-06 after each merge, WF-07 weekly.

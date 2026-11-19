# AGENTS.md

Shared instructions for **every** contributor to this repository: Claude Code, Cursor, Lovable, other agents, and humans. This is the only instruction file. Tool-specific files (`CLAUDE.md`, `.cursor/rules/`, `.github/copilot-instructions.md`, `.gemini/settings.json`, Lovable project knowledge) point here and add nothing that contradicts it.

## 1. How this repository works

| Folder | What it is | Truth for |
|---|---|---|
| `blueprint/` | Agreed product and engineering **intent** (00–07, features, ADRs, deviations, prototypes) | *What* and *why* |
| `src/`, `supabase/`, … | The implementation | *What the product actually does* |
| `supabase/migrations/` (or equivalent) | Database migrations | The *actual* schema |
| `contracts/openapi.yaml` | API contract | The *actual* API surface |
| tests | Executable behaviour | Whether acceptance criteria hold |
| `governance/` | How we work: workflows, ownership, checks | The rules below |

Start of every task: read `blueprint/00-product-core.md`, then **only** the blueprint documents relevant to the task. `governance/config.json` → `impactRules` tells you which documents relate to which code paths.

## 2. Non-negotiable rules

1. **Git is the shared source of truth.** Do not keep plans, specs or decisions anywhere else (no tool-private notes, no Lovable-only knowledge). If it matters, it goes in the repo.
2. **Approved specifications are protected.** You may *propose* changes to the blueprint. You may not silently change approved requirements or product strategy. Never edit `blueprint/00-product-core.md`; open an issue instead. A file with `status: approved` changes only in a PR that its owner approves with the `blueprint:approved-change` label.
3. **Implementation changes require impact analysis.** Every PR fills in the *Blueprint impact* table in the PR template: for each of 00–07, `none`, `updated`, `proposed` (with a link to the follow-up), or `deviation` (with `DEV-nnn`). CI checks this table.
4. **Generated artifacts are generated.** Never hand-edit generated files (OpenAPI output, Supabase types, lockfiles, visual baselines without intent). Change the source and regenerate.
5. **Tests validate behaviour; documentation describes intent.** When you implement an acceptance criterion `AC-nnn.n`, put its ID in the test name or in a `// covers: AC-nnn.n` comment.
6. **Every deviation is explicit.** If you deliberately implement something differently from the blueprint, add `blueprint/deviations/DEV-nnn-*.md` (template in that folder) explaining why. Don't bend the code or the docs just to make them look consistent.
7. **Detection before remediation.** When you notice drift that isn't part of your task, report it (PR description, issue). Don't fix it in passing.

## 3. Ownership (who may change what)

| Document | Authority | AI may propose via |
|---|---|---|
| 00 Product Core | Product owner | issue only |
| 01 Product · 07 Roadmap | Product management | WF-01, WF-06 |
| 02 UX & Design | UX / Product | WF-02, WF-06 |
| 03 Domain & Data · 04 Architecture | Architecture | WF-03, WF-06 |
| 05 Interfaces | API / Engineering | WF-04, WF-06 |
| 06 Deployment | Engineering / Operations | WF-03, WF-06 |

## 4. Working on a change

1. **Is it defined?** New behaviour needs a feature spec in `blueprint/features/` (status `approved` before implementation starts). No spec: propose one first (`/wf01-define-feature` in Claude Code, or the *Feature request* issue form).
2. **Branch + PR.** Never push to `main`. One concern per PR.
3. **Implement** using the domain terms from the Ubiquitous language table in `03` (the *Avoid* column is checked).
4. **Test** each acceptance criterion you touched and reference its ID.
5. **Impact analysis.** Run `node scripts/governance/check-impact.mjs --body-file <your PR body>` locally or let CI do it. Update affected documents in the same PR where you can.
6. **Gate.** The `quality-gate` and `governance-gate` checks must be green. Do not disable, skip or weaken checks, tests or lint rules to get there. If a check is wrong, say so in the PR.

## 5. Writing in the blueprint

- Minimal, precise edits. Preserve structure, headings, IDs and the author's wording. No reformatting of untouched sections.
- Describe intent and link to the truth (`contracts/openapi.yaml`, migrations, token files). Don't copy them into prose.
- IDs (`FEAT-nnn`, `AC-nnn.n`, `ADR-nnnn`, `DEV-nnn`) are permanent: never renumber or reuse them.
- Update `last_reviewed` when you have verified a document against the code.
- Validate with `node scripts/governance/check-blueprint.mjs`.

## 6. Commands

```bash
node scripts/governance/check-blueprint.mjs     # blueprint structure + references
node scripts/governance/check-impact.mjs --base origin/main --body-file pr.md
node scripts/governance/check-protected.mjs --base origin/main
node scripts/governance/trace.mjs               # acceptance criteria ↔ tests
node scripts/governance/terminology.mjs         # glossary "Avoid" terms
node scripts/ci/run.mjs <script>                # lint | typecheck | test | build | … (skips if undefined)
```

<!-- Project-specific additions (stack, commands, conventions) go below this line. Keep them short and in this one file. -->
## 7. Project specifics

- Stack: <fill in, or point to blueprint/04-architecture.md>
- Install: <e.g. npm ci>
- Dev server: <e.g. npm run dev>

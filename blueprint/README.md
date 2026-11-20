# Blueprint

The product's agreed intent: **what** we build and **why**. Code, tests and contracts show what we actually built. The governance workflows (`npx product-blueprint@0.3.0 docs governance`) keep the two aligned.

| # | Document | Primary authority | AI workflows (propose only) |
|---|---|---|---|
| 00 | [Product Core](00-product-core.md) | Product owner | WF-01 (issue only, never edits) |
| 01 | [Product](01-product.md) | Product management | WF-01, WF-06 |
| 02 | [UX & Design](02-ux-design.md) | UX / Product | WF-02, WF-06 |
| 03 | [Domain & Data](03-domain-data.md) | Architecture | WF-03, WF-06 |
| 04 | [Architecture & Technology](04-architecture.md) | Architecture | WF-03, WF-06 |
| 05 | [Interfaces & Integrations](05-interfaces.md) | API / Engineering | WF-04, WF-06 |
| 06 | [Deployment & Operations](06-deployment.md) | Engineering / Operations | WF-03, WF-06 |
| 07 | [Roadmap & Delivery](07-roadmap.md) | Product management | WF-01, WF-06 |

Supporting folders:

| Folder | Contains | ID format |
|---|---|---|
| `features/` | One spec per feature, with acceptance criteria | `FEAT-001`, criteria `AC-001.1` |
| `decisions/` | Architecture decision records | `ADR-0001` |
| `deviations/` | Intentional or known differences between blueprint and implementation | `DEV-001` |
| `prototypes/` | Approved UX prototypes | named after the feature |

## Conventions

1. **Front matter is required.** `id`, `title`, `status`, `owner`, `last_reviewed` on core documents. Create features, ADRs and deviations with `npx product-blueprint@0.3.0 new feature|adr|deviation "<title>"`, which fills in the fields and the next free ID. Validated by `npx product-blueprint@0.3.0 check blueprint`.
2. **Status:** `draft → proposed → approved` (`deprecated` when retired). Features also use `in-progress → implemented`. Changing a file whose current status is `approved` requires the `blueprint:approved-change` label. `00` always requires it.
3. **IDs are permanent.** Never reuse or renumber them. References to IDs that don't exist fail CI.
4. **Describe intent, link to truth.** Don't copy the schema, the OpenAPI spec or token values into prose. Link to the file that holds them and explain what they mean.
5. **One term per concept.** Use the Ubiquitous language table in `03`. Terms in its *Avoid* column are flagged.
6. **Deviations are explicit.** If the code is meant to differ from the blueprint, record a `DEV-nnn` instead of forcing artificial consistency.
7. **Bump `last_reviewed`** whenever you have confirmed that a document is still accurate, even if you made no other change. WF-07 flags stale documents.

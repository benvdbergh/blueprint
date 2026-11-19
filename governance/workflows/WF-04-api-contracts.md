# WF-04 · API & Integration Contract Synchronization

`Event-triggered` · `Automated validation`

**Purpose.** API documentation never goes stale because it is a validated, machine-readable artifact.

| | |
|---|---|
| **Triggers** | Endpoint added/changed · request/response changed · auth changed · domain change affecting a contract |
| **Inputs** | `contracts/openapi.yaml` · API route code · 05 Interfaces & Integrations |
| **Runtime** | `.github/workflows/wf04-api-contract.yml` |
| **May write** | Nothing automatically. Reports breaking changes and drift on the PR. |

## Flow
| # | Step | How |
|---|---|---|
| 1 | Inspect routes and schemas | `check:openapi` (project-defined): regenerate the spec from code, `git diff --exit-code contracts/` |
| 2 | Compare against 05 | `check-impact` rule: `contracts/**` or API code ⇒ 05 |
| 3 | Generate/update OpenAPI | Generator of your stack (e.g. zod-to-openapi, tsoa, FastAPI) behind `check:openapi` |
| 4 | Validate schemas | `redocly lint contracts/openapi.yaml` |
| 5 | Check breaking changes | `oasdiff breaking base head --fail-on ERR`; label `api:breaking-approved` to accept |
| 6 | Contract tests | `test:contract` (e.g. Schemathesis, Dredd, Pact) |
| 7 | Flag consumers | Breaking-change report in the job summary lists affected paths; 05 lists consumers |

## Outputs
Validated OpenAPI · breaking-change report · contract test results · 05 updated (or `proposed`) in the same PR.

Swagger UI / Redoc are **rendered from** `contracts/openapi.yaml` (rule 4). Never maintain them by hand.

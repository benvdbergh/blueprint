# Contracts

Machine-readable interface contracts. **`openapi.yaml` is the source of truth for the HTTP API surface** (rule 4: generated artifacts are generated).

- Add `contracts/openapi.yaml` when the first API exists (starter: `templates/openapi.yaml`). WF-04 then lints it, diffs it against the base branch for breaking changes, and runs `check:openapi` / `test:contract` if they are defined.
- Prefer generating the spec from code (zod-to-openapi, tsoa, …) and having `check:openapi` fail when the committed spec is out of date. If you write the spec first, generate types and clients from it instead.
- Render Swagger UI / Redoc from this file. Don't maintain API docs by hand.
- The intent, consumers and compatibility policy are described in `blueprint/05-interfaces.md`.

# Copilot instructions

Follow `AGENTS.md` at the repository root. It is the single source of instructions for all agents and humans in this repo. Copilot's coding agent, CLI and VS Code chat read it directly; this file exists for the Copilot surfaces that don't (github.com chat and code review).

Short version:
- Read `blueprint/00-product-core.md` and the blueprint documents relevant to the task before changing code.
- Never edit `blueprint/00-product-core.md`. Propose changes to `approved` blueprint files; don't make them silently.
- Fill in the Blueprint impact table in every PR (`none | updated | proposed | deviation` per document 00–07).
- Reference acceptance criteria IDs (`AC-nnn.n`) in tests. Record intentional differences as `blueprint/deviations/DEV-nnn-*.md`.
- Never weaken lint rules, tests or CI checks to get a green build.
- Blueprint still empty templates in a repo with code? Setting it up means following `governance/workflows/WF-00-onboarding.md`.
- When reviewing a pull request, check that its Blueprint impact table matches the files it changes.

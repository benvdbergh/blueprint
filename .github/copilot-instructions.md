# Copilot instructions

Follow `AGENTS.md` at the repository root. It is the single source of instructions for all agents and people in this repo. Copilot's coding agent, CLI and VS Code chat read it directly; this file exists for the Copilot surfaces that don't (github.com chat and code review).

Short version:
- Read `blueprint/00-product-core.md` and the blueprint documents relevant to the task before changing code.
- When your change makes a blueprint statement wrong, update it in the same change, or say which document needs a follow-up.
- Never edit `blueprint/00-product-core.md`. Propose changes to `approved` documents; don't make them silently.
- When reviewing a pull request, follow `blueprint/workflows/review.md`.

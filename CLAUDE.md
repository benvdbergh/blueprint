@AGENTS.md

## Claude Code specifics
- Workflow commands live in `.claude/commands/`: `/wf00-onboard` (fill the blueprint from existing code, once), `/wf01-define-feature`, `/impact-analysis`, `/wf03-architecture-review`, `/wf06-blueprint-sync`, `/wf07-drift-audit`. The GitHub Actions read these same files (through `blueprint prompt`, which prefers the repository's copy), so local and CI behaviour match.
- Don't add instructions here that belong to every agent. Put them in `AGENTS.md`.

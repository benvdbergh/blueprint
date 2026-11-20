@AGENTS.md

## Claude Code specifics
- The workflows are also slash commands: `/blueprint-sync`, `/blueprint-audit`, `/blueprint-align`, `/blueprint-review`, `/blueprint-define-feature`, `/blueprint-onboard`. Each one only points to its file in `blueprint/workflows/`.
- To run one on a schedule, create a scheduled task with the prompt "Follow `blueprint/workflows/<name>.md`".
- Don't add instructions here that belong to every agent. Put them in `AGENTS.md`.

---
id: "06"
title: Deployment & Operations
status: draft
owner: Engineering / Operations
last_reviewed: 2026-11-19
---

# 06 · Deployment & Operations

> **Authority:** Engineering / Operations. **AI policy:** agents propose updates via PR (`workflows/sync.md`).
> **Changes when:** environments, release process, infrastructure or operational practices change.

## Environments
| Environment | URL | Deployed from | Data |
|---|---|---|---|
| Preview | <per-branch preview> | PR branches | <seed / none> |
| Production | <url> | `main` | real |

## Release process
1. PR passes CI (<lint, tests, build>).
2. Review + merge to `main`.
3. <deploy mechanism — e.g. Lovable publish / Vercel auto-deploy>
4. The blueprint sync task (`blueprint/workflows/sync.md`) picks up the merged change.

## Configuration & secrets
| Name | Where set | Used by |
|---|---|---|
| <SUPABASE_URL> | <hosting env> | <frontend> |

## Observability
- **Errors:** <tool>
- **Logs:** <tool>
- **Uptime / alerts:** <tool, who is paged>

## Backup & recovery
- <backup frequency, restore procedure, RPO/RTO>

## Runbooks
- <link or inline procedure for common incidents>

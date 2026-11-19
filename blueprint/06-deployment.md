---
id: "06"
title: Deployment & Operations
status: draft
owner: Engineering / Operations
last_reviewed: 2026-11-19
ai_workflows: [WF-03, WF-06]
---

# 06 · Deployment & Operations

> **Authority:** Engineering / Operations. **AI policy:** WF-03 and WF-06 propose updates via PR.
> **Changes when:** environments, release process, infrastructure or operational practices change.

## Environments
| Environment | URL | Deployed from | Data |
|---|---|---|---|
| Preview | <per-branch preview> | PR branches | <seed / none> |
| Production | <url> | `main` | real |

## Release process
1. PR passes the WF-05 quality gate (required checks).
2. Review + merge to `main`.
3. <deploy mechanism — e.g. Lovable publish / Vercel auto-deploy>
4. WF-06 proposes blueprint sync for the merged change.

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

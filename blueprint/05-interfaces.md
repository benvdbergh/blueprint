---
id: "05"
title: Interfaces & Integrations
status: draft
owner: API / Engineering
last_reviewed: 2026-11-19
ai_workflows: [WF-04, WF-06]
---

# 05 · Interfaces & Integrations

> **Authority:** API / Engineering. **AI policy:** WF-04 and WF-06 propose updates via PR.
> **Source-of-truth split:** `contracts/openapi.yaml` is the machine-readable contract and is validated in CI (WF-04). This document explains intent, consumers, guarantees and integrations. It does **not** copy endpoint definitions, it links to them.

## API overview
| API | Contract | Consumers | Auth | Versioning |
|---|---|---|---|---|
| <Public REST API> | `contracts/openapi.yaml` | <web app, partners> | <JWT / API key> | <URL / header / none> |

## Compatibility policy
- Breaking changes are detected by `oasdiff` in WF-04 and require the `api:breaking-approved` label.
- <deprecation window, communication>

## Internal interfaces
<!-- Direct database access from the client, RPC functions, edge functions, events/webhooks. -->
| Interface | Type | Defined in | Called by |
|---|---|---|---|
| <name> | <edge function / RPC / webhook> | `<path>` | <consumer> |

## External integrations
| Service | Purpose | Direction | Credentials | Failure behaviour |
|---|---|---|---|---|
| <Stripe> | <payments> | <outbound / webhook> | <secret name, never the value> | <retry / degrade> |

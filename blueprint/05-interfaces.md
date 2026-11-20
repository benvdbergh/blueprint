---
id: "05"
title: Interfaces & Integrations
status: draft
owner: API / Engineering
last_reviewed: 2026-11-19
---

# 05 · Interfaces & Integrations

> **Authority:** API / Engineering. **AI policy:** agents propose updates via PR (`workflows/sync.md`, `workflows/review.md`).
> **Source-of-truth split:** `contracts/openapi.yaml` is the machine-readable contract. This document explains intent, consumers, guarantees and integrations. It does **not** copy endpoint definitions, it links to them.

## API overview
| API | Contract | Consumers | Auth | Versioning |
|---|---|---|---|---|
| <Public REST API> | `contracts/openapi.yaml` | <web app, partners> | <JWT / API key> | <URL / header / none> |

## Compatibility policy
- Breaking changes are agreed with the API owner and the consumers listed below before they merge.
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

---
description: WF-00 — fill the blueprint from an existing codebase (one-off, opens a docs PR)
argument-hint: <optional focus or notes, e.g. "skip 02, the UI is being rewritten">
---

# WF-00 · Onboarding

Notes from the person: $ARGUMENTS

Run `npx product-blueprint@0.3.0 docs WF-00` and follow what it prints exactly. It is the single source for this workflow, shared with every other agent.

Before you write, ask the person the few questions that would change the result most (what the product is for, who uses it, which environments exist), unless the notes above already answer them. Then survey, configure, fill, check and prepare the PR as the steps say. Offer to commit on `blueprint/onboarding` and open the PR; don't push to `main`.

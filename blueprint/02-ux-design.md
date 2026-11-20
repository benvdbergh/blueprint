---
id: "02"
title: UX & Design
status: draft
owner: UX / Product
last_reviewed: 2026-11-19
---

# 02 · UX & Design

> **Authority:** UX / Product. **AI policy:** agents propose updates via PR (`workflows/sync.md`, `workflows/review.md`). Intentional visual changes are recorded here; unintentional ones are fixed in code.
> **Changes when:** screens, interactions or the design system change.

Prototypes live in `blueprint/prototypes/`. Implemented components are the visual source of truth once they exist. Storybook, or an equivalent, is introduced when the component library is big enough to need it.

## Design principles
- <principle>

## Design system
### Tokens
<!-- The single source is the code (e.g. tailwind.config / CSS variables). Describe intent, not values. -->
| Token group | Source file | Intent |
|---|---|---|
| Colour | `src/index.css` | <semantic usage rules> |
| Typography | `tailwind.config.ts` | <scale, when to use which> |
| Spacing / radius | `tailwind.config.ts` | <rhythm rules> |

### Components
<!-- Shared components and their usage rules. One row per component that has rules worth stating. -->
| Component | Location | Use for | Don't use for |
|---|---|---|---|
| <Button> | `src/components/ui/button.tsx` | <...> | <...> |

## Screen inventory
<!-- Every route/screen. The drift audit compares this table against the router. -->
| Screen | Route | Feature(s) | Prototype | Status |
|---|---|---|---|---|
| <screen> | `/path` | <!-- FEAT-001 --> | `prototypes/<file>` | <designed / implemented> |

## Interaction patterns
<!-- Forms, validation, empty states, loading, errors, confirmation, navigation. -->
- **Empty states:** <rule>
- **Errors:** <rule>
- **Destructive actions:** <rule>

## Accessibility
- Target: WCAG 2.2 AA
- <specific commitments>

## Visual regression
<!-- Which screens/components have baseline screenshots, where they live, how to update them. -->

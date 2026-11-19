# WF-02 · UX & Design Synchronization

`Event-triggered` · `Visual validation`

**Purpose.** Keep the application visually and behaviourally aligned with the UX blueprint. Repeated generative iterations, in Lovable especially, tend to introduce small inconsistencies.

| | |
|---|---|
| **Triggers** | Prototype approved/changed · design system changed · UI implementation changed (PR paths in `governance/config.json` rules with `"workflow": "WF-02"`) |
| **Inputs** | 02 UX & Design · approved prototypes · changed components/screens · visual baselines |
| **Runtime** | `.github/workflows/wf02-ux-visual.yml`: `test:visual` (Playwright) + optional Claude review (`vars.WF02_AI_REVIEW == 'true'`) |
| **May write** | 02 (via PR proposal), component docs. Baseline screenshots only when a human updates them intentionally. |

## Flow
| # | Step | Who |
|---|---|---|
| 1–3 | Read 02, the approved prototype, identify affected components/screens | AI / developer |
| 4 | Implement | Any contributor |
| 5 | Capture screenshots of the running app | Playwright (`test:visual`) |
| 6 | Compare screenshots against prototypes and design rules | AI review (optional) |
| 7 | Visual regression against baselines | Playwright `toHaveScreenshot` |
| 8 | If the change was intentional: update baselines + component docs + 02 | Developer, proposed via PR |

## Outputs
Consistent UI · updated component docs · visual regression report (artifact) · listed deviations from approved designs.

## Notes
- Baselines are regenerated **deliberately** (`npx playwright test --update-snapshots`) in a PR whose impact table marks 02 as `updated`.
- Introduce Storybook (or Ladle/Histoire) when the component library is big enough. Then point `test:visual` at the stories.

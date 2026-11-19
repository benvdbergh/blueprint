# Templates

Starters that become active once the app exists. Nothing here is executed in place.

| File | Copy to | Enables |
|---|---|---|
| `openapi.yaml` | `contracts/openapi.yaml` | WF-04 lint + breaking-change detection |
| `dependency-cruiser.cjs` | `.dependency-cruiser.cjs` + script `check:architecture` | WF-05 step 8 / WF-03 boundary checks |
| `visual.spec.ts` | `tests/visual/` + script `test:visual` | WF-02 visual regression |
| `package-scripts.json` | merge into `package.json` → `scripts` | The full script contract |

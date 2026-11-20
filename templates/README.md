# Templates

Starters that become active once the app exists. Create them in your project with `npx product-blueprint@0.3.0 new <kind>`; nothing here is executed in place.

| File | `new <kind>` writes | Enables |
|---|---|---|
| `openapi.yaml` | `openapi` → `contracts/openapi.yaml` | WF-04 lint + breaking-change detection |
| `dependency-cruiser.cjs` | `dependency-cruiser` → `.dependency-cruiser.cjs` (+ add script `check:architecture`) | WF-05 step 8 / WF-03 boundary checks |
| `visual.spec.ts` | `visual-test` → `tests/visual/visual.spec.ts` (+ add script `test:visual`) | WF-02 visual regression |
| `package-scripts.json` | `package-scripts` prints it: merge into `package.json` → `scripts` | The full script contract |

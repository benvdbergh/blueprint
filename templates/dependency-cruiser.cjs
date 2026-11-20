// Architecture boundary rules for `npm run check:architecture` (WF-05 step 8, WF-03).
// Mirror the "Module structure & boundaries" table in blueprint/04-architecture.md.
//
// Setup:
//   npm i -D dependency-cruiser
//   npx product-blueprint@0.3.0 new dependency-cruiser    (writes .dependency-cruiser.cjs)
//   package.json → "check:architecture": "depcruise src --config .dependency-cruiser.cjs"
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "components-not-to-pages",
      comment: "04: UI components must not depend on pages.",
      severity: "error",
      from: { path: "^src/components" },
      to: { path: "^src/pages" },
    },
    {
      name: "components-not-to-integrations",
      comment: "04: UI components get data via hooks, not directly from src/integrations.",
      severity: "error",
      from: { path: "^src/components" },
      to: { path: "^src/integrations" },
    },
    {
      name: "integrations-not-to-ui",
      comment: "04: The data access layer must not depend on UI.",
      severity: "error",
      from: { path: "^src/integrations" },
      to: { path: "^src/(components|pages)" },
    },
    {
      name: "no-orphans",
      comment: "WF-07 signal: modules nobody imports.",
      severity: "warn",
      from: { orphan: true, pathNot: ["\\.d\\.ts$", "(^|/)\\.[^/]+\\.(js|cjs|mjs|ts)$", "\\.(test|spec)\\.", "^src/main\\.tsx?$", "^src/vite-env\\.d\\.ts$"] },
      to: {},
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsConfig: { fileName: "tsconfig.json" },
    tsPreCompilationDeps: true,
  },
};

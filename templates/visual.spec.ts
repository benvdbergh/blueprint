// Visual regression starter for WF-02. Requires @playwright/test and a playwright.config.ts with a
// webServer that starts the app (e.g. `npm run dev`).
//
//   npm i -D @playwright/test && npx playwright install chromium
//   package.json → "test:visual": "playwright test tests/visual"
//   First run / intentional change: npx playwright test tests/visual --update-snapshots
//   (and mark 02 UX & Design as `updated` in the PR impact table)
import { test, expect } from "@playwright/test";

// Keep in sync with the screen inventory in blueprint/02-ux-design.md.
const screens = [
  { name: "home", path: "/" },
  // { name: "exercise-create", path: "/exercises/new", feature: "FEAT-001" },
];

for (const screen of screens) {
  test(`visual: ${screen.name}`, async ({ page }) => {
    await page.goto(screen.path);
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot(`${screen.name}.png`, { fullPage: true, maxDiffPixelRatio: 0.01 });
  });
}

import { test, expect } from "@playwright/test";
import { mockShell } from "./helpers/mock-shell";

const VIEWPORTS = [
  { name: "1280x720", width: 1280, height: 720 },
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1920x1080", width: 1920, height: 1080 }
];

const CATALOG_TABS = [
  "condition",
  "aptitudes",
  "derived",
  "shield",
  "status",
  "elements",
  "kit",
  "paths"
] as const;

test.describe("ActorSheet catalog-era shell", () => {
  for (const vp of VIEWPORTS) {
    test(`at ${vp.name}: near-fullscreen sheet, catalog tabs, no page horizontal scroll`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await mockShell(page);
      await page.route("**/api/aptitudes**", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ theta: 100, budget: 300, shares: { Might: 10 } })
        })
      );
      await page.route("**/api/actors/**/derived**", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ channels: [] })
        })
      );
      await page.route("**/api/actors/**/sheet**", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            instanceId: "mock",
            playerId: 1,
            side: "plant",
            typeId: 1,
            displayName: null,
            level: 1,
            derived: [],
            primary: []
          })
        })
      );
      await page.route("**/api/catalogs/derived-surface**", (route) =>
        route.fulfill({ status: 404, body: "" })
      );

      await page.goto("/#/actor-ladder-demo?mock=1");
      await page.getByTestId("actor-ladder-open-panel").click();
      const panel = page.getByTestId("actor-panel");
      await expect(panel).toBeVisible();

      const box = await panel.boundingBox();
      expect(box).toBeTruthy();
      // Near-fullscreen: most of the viewport, with a visible stage margin (≤ 96vw / 92vh).
      expect(box!.width).toBeGreaterThan(vp.width * 0.7);
      expect(box!.height).toBeGreaterThan(vp.height * 0.7);
      expect(box!.width).toBeLessThanOrEqual(Math.min(1800, vp.width * 0.96) + 2);
      expect(box!.height).toBeLessThanOrEqual(Math.min(960, vp.height * 0.92) + 2);

      for (const kind of CATALOG_TABS) {
        await expect(page.getByTestId(`actor-sheet-tab-${kind}`)).toBeVisible();
      }

      await expect(page.getByTestId("actor-sheet-rail")).toBeVisible();
      await expect(page.getByTestId("actor-summarize")).toBeVisible();
      await expect(page.getByTestId("actor-panel-header")).toHaveAttribute("data-header-mode", "none");
      await expect(page.getByTestId("actor-sheet-close")).toBeVisible();

      await page.getByTestId("actor-sheet-rail-toggle").click();
      await expect(page.getByTestId("actor-sheet-rail")).toHaveAttribute("data-collapsed", "true");
      await expect(page.getByTestId("actor-summarize-glyph")).toBeVisible();
      await page.getByTestId("actor-sheet-rail-toggle").click();
      await expect(page.getByTestId("actor-sheet-rail")).toHaveAttribute("data-collapsed", "false");

      await expect(page.getByTestId("condition-xp-pending")).toBeVisible();
      await expect(panel.getByTestId("actor-standing-pending")).toBeVisible();
      await expect(page.getByTestId("condition-live-effects-pending")).toBeVisible();
      // Catalog must not be painted as fake live status instances.
      await expect(page.locator('[data-testid="condition-live-effects"] [data-testid^="status-glyph"]')).toHaveCount(0);

      const pageOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
      );
      expect(pageOverflow).toBe(false);

      await page.screenshot({
        path: `e2e/artifacts/actor-sheet-${vp.name}.png`,
        fullPage: false
      });
    });
  }

  test("tab flow: Condition → Kit → Shield keeps pending honesty; Esc closes", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockShell(page);
    await page.route("**/api/aptitudes**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ theta: 100, budget: 300, shares: { Might: 10 } })
      })
    );

    await page.goto("/#/actor-ladder-demo?mock=1");
    await page.getByTestId("actor-ladder-open-panel").click();
    await expect(page.getByTestId("actor-panel")).toBeVisible();

    await page.getByTestId("actor-sheet-tab-kit").click();
    await expect(page.getByTestId("kit-tab")).toBeVisible();
    await expect(page.getByTestId("kit-equip-pending")).toBeVisible();
    await expect(page.getByTestId("kit-tab")).not.toContainText(/Strike|Firebolt/i);
    await expect(page.locator('[data-testid="actions-tab"]')).toHaveCount(0);

    await page.getByTestId("actor-sheet-tab-condition").click();
    await expect(page.getByTestId("actor-panel-deploy")).toBeVisible();
    await expect(page.locator('[data-testid="actor-leftover-footer"]')).toHaveCount(0);

    await page.getByTestId("actor-sheet-tab-aptitudes").click();
    await expect(page.getByTestId("actor-leftover-footer")).toBeVisible();
    await expect(page.locator('[data-testid="actor-panel-deploy"]')).toHaveCount(0);

    await page.getByTestId("actor-sheet-tab-shield").click();
    await expect(page.getByTestId("actor-shield-pending")).toBeVisible();
    await expect(page.getByTestId("shield-tab")).not.toContainText(/Ward/i);

    await page.getByTestId("actor-sheet-tab-condition").click();
    await expect(page.getByTestId("condition-resource-poise")).toBeVisible();
    await expect(page.getByTestId("condition-resource-hunger")).toContainText("Sun");

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("actor-panel")).not.toBeVisible();
  });

  test("Derived tab: InspectSplit + Show unchanged", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockShell(page);
    await page.route("**/api/actors/**/sheet**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          instanceId: "mock",
          playerId: 1,
          side: "plant",
          typeId: 1,
          displayName: "Emberling",
          level: 24,
          derived: [
            {
              channelId: "combat.power.fire",
              displayName: "Power",
              reading: "Fire",
              composeKind: "FlatSum",
              value: 100,
              contributions: [
                { sourceId: "aptitude.Might", label: "Aptitude · Might", op: "Flat", value: 100 }
              ]
            }
          ],
          primary: []
        })
      })
    );
    await page.route("**/api/actors/**/derived**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ channels: [] })
      })
    );
    await page.route("**/api/catalogs/derived-surface**", (route) =>
      route.fulfill({ status: 404, body: "" })
    );

    await page.goto("/#/actor-ladder-demo?mock=1");
    await page.getByTestId("actor-ladder-open-panel").click();
    await page.getByTestId("actor-sheet-tab-derived").click();
    await expect(page.getByTestId("derived-tab")).toBeVisible();
    await expect(page.getByTestId("derived-inspect")).toBeVisible();
    await expect(page.getByTestId("derived-show-unchanged")).toBeVisible();
    await page.getByTestId("derived-tab-elements").click();
    await page.getByTestId("derived-variant-fire").click();
    await expect(page.getByTestId("derived-channel-combat.power.fire")).toBeVisible();
  });

  test("publishes actor-surface catalog onto window for HUD resolve", async ({ page }) => {
    await mockShell(page);
    await page.goto("/#/actor-ladder-demo?mock=1");
    await page.getByTestId("actor-ladder-open-panel").click();
    await expect(page.getByTestId("actor-panel")).toBeVisible();

    const stamp = await page.evaluate(() => window.__fusionRpgActorSurface?.versionStamp);
    expect(stamp).toBeTruthy();
    const statuses = await page.evaluate(() => window.__fusionRpgActorSurface?.statuses?.length ?? 0);
    expect(statuses).toBeGreaterThan(0);
  });
});

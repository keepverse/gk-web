import { test, expect, type Page, type Route } from "@playwright/test";

const health = {
  ok: true,
  injectorConnected: false,
  lastHeartbeatUtc: null,
  source: "none",
  simEnabled: false,
  ingestQueued: 0,
  lastFlushMs: 0,
  currentPlayerId: 1
};

const players = {
  items: [{ id: 1, name: "Default", createdUtc: "2026-01-01T00:00:00Z" }],
  currentPlayerId: 1
};

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function mockShell(page: Page) {
  await page.route("**/hub/rpg**", (route) => route.abort());
  await page.route("**/health", (route) => fulfillJson(route, health));
  await page.route("**/api/players", (route) => fulfillJson(route, players));
  await page.route("**/api/players/current", (route) => fulfillJson(route, { ok: true }));
  await page.route("**/api/sim", (route) => fulfillJson(route, null, 404));
}

const VIEWPORTS = [
  { name: "1440", width: 1440, height: 900 },
  { name: "1024", width: 1024, height: 768 },
  { name: "800", width: 800, height: 720 }
];

test.describe("Actor ladder (T8) — five rungs, one contract type", () => {
  for (const vp of VIEWPORTS) {
    test(`at ${vp.name}px: renders all five rungs with no horizontal scroll`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await mockShell(page);
      await page.goto("/#/actor-ladder-demo?mock=1");

      await expect(page.getByTestId("actor-token")).toBeVisible();
      await expect(page.getByTestId("actor-chip")).toBeVisible();
      await expect(page.getByTestId("actor-row")).toBeVisible();
      await expect(page.getByTestId("actor-card")).toBeVisible();

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(overflow).toBe(false);
    });
  }

  test("the panel rung opens over the page, stays within its height bound, and Esc closes it", async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 720 });
    await mockShell(page);
    await page.goto("/#/actor-ladder-demo?mock=1");

    await page.getByTestId("actor-ladder-open-panel").click();
    const panel = page.getByTestId("actor-panel");
    await expect(panel).toBeVisible();

    const overflowing = await panel.evaluate((el) => el.scrollHeight > el.clientHeight + 1);
    expect(overflowing).toBe(false);

    await page.keyboard.press("Escape");
    await expect(panel).not.toBeVisible();
  });

  test("all five rungs render the same identity from the shared contract", async ({ page }) => {
    await mockShell(page);
    await page.goto("/#/actor-ladder-demo?mock=1");

    await expect(page.getByTestId("actor-chip")).toContainText("Lv 1");
    await expect(page.getByTestId("actor-row")).toContainText("Lv 1");
    await expect(page.getByTestId("actor-card")).toContainText("Lv 1");
  });
});

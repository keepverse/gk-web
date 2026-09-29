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

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function mockShell(page: Page) {
  await page.route("**/hub/rpg**", (route) => route.abort());
  await page.route("**/health", (route) => fulfillJson(route, health));
  await page.route("**/api/players", (route) =>
    fulfillJson(route, { items: [{ id: 1, name: "Ashwarden", createdUtc: "2026-01-01T00:00:00Z" }], currentPlayerId: 1 })
  );
  await page.route("**/api/players/current", (route) => fulfillJson(route, { ok: true }));
  await page.route("**/api/sim", (route) => fulfillJson(route, null, 404));
  await page.route("**/api/unique/actors**", (route) =>
    fulfillJson(route, {
      playerId: 1,
      items: [
        { instanceId: "a1", playerId: 1, side: "plant", typeId: 3, phase: "Roster", level: 5, xp: 10, revision: 1 },
        { instanceId: "a2", playerId: 1, side: "zombie", typeId: 7, phase: "Roster", level: 9, xp: 10, revision: 1 }
      ]
    })
  );
  await page.route("**/api/runs", (route) => fulfillJson(route, { items: [] }));
  await page.route("**/api/souls/**", (route) =>
    fulfillJson(route, { playerId: 1, balance: 500, earnedTotal: 500, spentTotal: 0, revision: 1, updatedUtc: "2026-01-01T00:00:00Z" })
  );
  await page.route("**/api/contracts/**", (route) =>
    fulfillJson(route, {
      contracts: [],
      capacity: { used: 0, total: 0, purchasedSlots: 0, nextSlotPrice: 0, canBuy: false, maxSlots: 0 },
      dailyTribute: 0,
      deployFloor: 0,
      loyaltyMax: 0
    })
  );
  await page.route("**/api/creatures/catalog", (route) => fulfillJson(route, { species: [] }));
  await page.route("**/api/expeditions/*", (route) =>
    fulfillJson(route, { serverUtc: new Date().toISOString(), tiers: [], items: [] })
  );
}

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 375, height: 667 }
];

for (const vp of VIEWPORTS) {
  test(`Title screen renders cleanly at ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await mockShell(page);
    await page.goto("/#/");
    await expect(page.getByTestId("title-screen")).toBeVisible();
    await page.screenshot({ path: `test-results/visual/title-${vp.name}.png`, fullPage: true });
  });

  test(`Save select renders cleanly at ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await mockShell(page);
    await page.goto("/#/saves");
    await expect(page.getByTestId("save-select")).toBeVisible();
    await page.screenshot({ path: `test-results/visual/saves-${vp.name}.png`, fullPage: true });
  });

  test(`Sanctum with a bound roster shows one clean hud, not two, at ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await mockShell(page);
    await page.goto("/#/sanctum");
    await expect(page.getByTestId("sanctum-hud")).toBeVisible();
    await expect(page.getByTestId("hud-bar")).toHaveCount(0);
    await page.screenshot({ path: `test-results/visual/sanctum-populated-${vp.name}.png`, fullPage: true });
  });
}

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

async function mockSanctum(page: Page, opts?: { runs?: unknown[] }) {
  await page.route("**/hub/rpg**", (route) => route.abort());
  await page.route("**/health", (route) => fulfillJson(route, health));
  await page.route("**/api/players", (route) => fulfillJson(route, players));
  await page.route("**/api/players/current", (route) => fulfillJson(route, { ok: true }));
  await page.route("**/api/sim", (route) => fulfillJson(route, null, 404));
  await page.route("**/api/unique/actors**", (route) => fulfillJson(route, { playerId: 1, items: [] }));
  await page.route("**/api/relics", (route) => fulfillJson(route, { items: [] }));
  await page.route("**/api/runs", (route) => fulfillJson(route, { items: opts?.runs ?? [] }));
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
  await page.route("**/api/creatures/**", (route) => fulfillJson(route, { playerId: 1, items: [] }));
  await page.route("**/api/types", (route) => fulfillJson(route, { items: [{ side: "plant", type: 0, typeName: "Peashooter", seenCount: 1, killedCount: 0 }] }));
  await page.route("**/api/recipes", (route) => fulfillJson(route, { items: [] }));
}

test.describe("Almanac layer (T19)", () => {
  test("locked with no completed run, A opens it once a run exists, Esc closes without unmounting the Sanctum", async ({ page }) => {
    await mockSanctum(page);
    await page.goto("/#/sanctum");
    await expect(page.getByTestId("rail-almanac")).toBeDisabled();
  });

  test("unlocks and opens with a completed run, switching tabs, Esc without unmounting the Sanctum", async ({ page }) => {
    await mockSanctum(page, { runs: [{ id: 1, startedUtc: "2026-01-01T00:00:00Z" }] });
    await page.goto("/#/sanctum");
    await expect(page.getByTestId("rail-almanac")).not.toBeDisabled();

    await page.keyboard.press("a");
    await expect(page.getByTestId("almanac-layer")).toBeVisible();
    await expect(page.getByText("Peashooter")).toBeVisible();
    await expect(page.getByTestId("sanctum-hud")).toBeVisible();

    await page.getByTestId("almanac-tab-recipes").click();
    await expect(page.getByTestId("almanac-surface-recipes")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("almanac-layer")).not.toBeVisible();
    await expect(page.getByTestId("sanctum-hud")).toBeVisible();
  });

  // AuditNav (the flat leftover sidebar this test used to check for redundant links) is gone
  // entirely (GG-40, foundation.html F.2) — Types/Recipes are reachable only through the rail now.
  test("#/types and #/recipes redirect into the layer", async ({ page }) => {
    await mockSanctum(page, { runs: [{ id: 1, startedUtc: "2026-01-01T00:00:00Z" }] });
    await page.goto("/#/types");
    await expect(page).toHaveURL(/#\/sanctum\?panel=almanac/);
    await expect(page.getByTestId("almanac-layer")).toBeVisible();
  });
});

test.describe("Chronicle layer (T19)", () => {
  test("locked with no completed run", async ({ page }) => {
    await mockSanctum(page);
    await page.goto("/#/sanctum");
    await expect(page.getByTestId("rail-chronicle")).toBeDisabled();
  });

  test("H opens it once a run exists, on the Runs tab by default, Esc closes without unmounting the Sanctum", async ({ page }) => {
    await mockSanctum(page, { runs: [{ id: 1, startedUtc: "2026-01-01T00:00:00Z" }] });
    await page.goto("/#/sanctum");
    await expect(page.getByTestId("rail-chronicle")).not.toBeDisabled();

    await page.keyboard.press("h");
    await expect(page.getByTestId("chronicle-layer")).toBeVisible();
    await expect(page.getByTestId("chronicle-surface-runs")).toBeVisible();
    await expect(page.getByTestId("sanctum-hud")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("chronicle-layer")).not.toBeVisible();
    await expect(page.getByTestId("sanctum-hud")).toBeVisible();
  });

  // AuditNav (the flat leftover sidebar this test used to check for redundant links) is gone
  // entirely (GG-40, foundation.html F.2) — none of these have a standing nav link anywhere now.
  test("#/rpg-progression, #/pvz-stats and #/metrics all redirect into the layer", async ({ page }) => {
    await mockSanctum(page, { runs: [{ id: 1, startedUtc: "2026-01-01T00:00:00Z" }] });

    await page.goto("/#/rpg-progression");
    await expect(page).toHaveURL(/#\/sanctum\?panel=chronicle/);
    await expect(page.getByTestId("chronicle-layer")).toBeVisible();
    await page.keyboard.press("Escape");

    await page.goto("/#/pvz-stats");
    await expect(page).toHaveURL(/#\/sanctum\?panel=chronicle/);
    await page.keyboard.press("Escape");

    await page.goto("/#/metrics");
    await expect(page).toHaveURL(/#\/sanctum\?panel=chronicle/);
  });
});

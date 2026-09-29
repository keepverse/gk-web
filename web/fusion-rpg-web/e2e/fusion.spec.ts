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

async function mockSanctum(page: Page, opts?: { creatures?: unknown[] }) {
  await page.route("**/hub/rpg**", (route) => route.abort());
  await page.route("**/health", (route) => fulfillJson(route, health));
  await page.route("**/api/players", (route) => fulfillJson(route, players));
  await page.route("**/api/players/current", (route) => fulfillJson(route, { ok: true }));
  await page.route("**/api/sim", (route) => fulfillJson(route, null, 404));
  await page.route("**/api/unique/actors**", (route) => fulfillJson(route, { playerId: 1, items: [] }));
  await page.route("**/api/relics", (route) => fulfillJson(route, { items: [] }));
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
  await page.route("**/api/creatures/*/codex", (route) => fulfillJson(route, { entries: [] }));
  await page.route("**/api/creatures/*/summon-state", (route) => fulfillJson(route, { pity: 0 }));
  await page.route("**/api/creatures/*", (route) => fulfillJson(route, { playerId: 1, items: opts?.creatures ?? [] }));
  await page.route("**/api/patron/**", (route) => fulfillJson(route, { patron: null }));
  await page.route("**/api/expeditions/*/materials", (route) => fulfillJson(route, { items: [] }));
  await page.route("**/api/expeditions/*", (route) => fulfillJson(route, { items: [] }));
  await page.route("**/api/fusion/*/recipes", (route) => fulfillJson(route, { items: [] }));
}

test.describe("Fusion layer (T15)", () => {
  test("locked with no creatures", async ({ page }) => {
    await mockSanctum(page);
    await page.goto("/#/sanctum");
    await expect(page.getByTestId("sanctum-hud")).toBeVisible();
    await expect(page.getByTestId("rail-fusion")).toBeDisabled();
  });

  test("F opens it once a creature exists, Esc closes it without unmounting the Sanctum", async ({ page }) => {
    await mockSanctum(page, {
      creatures: [
        {
          profile: { instanceId: "d1", speciesId: "sp-imp", rarity: "common", star: 0, promoted: false, traitIds: [], locked: false },
          actor: { level: 3 }
        }
      ]
    });
    await page.goto("/#/sanctum");
    await expect(page.getByTestId("rail-fusion")).not.toBeDisabled();

    await page.keyboard.press("f");
    await expect(page.getByTestId("fusion-layer")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Fusion Lab" })).toBeVisible();
    await expect(page.getByTestId("sanctum-hud")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("fusion-layer")).not.toBeVisible();
    await expect(page.getByTestId("sanctum-hud")).toBeVisible();
  });

  // AuditNav (the flat leftover sidebar this test used to check for a redundant link) is gone
  // entirely (GG-40, foundation.html F.2) — Fusion is reachable only through the rail now.
  test("#/fusion redirects into the layer", async ({ page }) => {
    await mockSanctum(page);
    await page.goto("/#/fusion");
    await expect(page).toHaveURL(/#\/sanctum\?panel=fusion/);
    await expect(page.getByTestId("fusion-layer")).toBeVisible();
  });
});

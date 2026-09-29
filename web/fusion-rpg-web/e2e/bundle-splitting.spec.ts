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

async function mockSanctum(page: Page) {
  await page.route("**/hub/rpg**", (route) => route.abort());
  await page.route("**/health", (route) => fulfillJson(route, health));
  await page.route("**/api/players", (route) => fulfillJson(route, players));
  await page.route("**/api/players/current", (route) => fulfillJson(route, { ok: true }));
  await page.route("**/api/sim", (route) => fulfillJson(route, null, 404));
  await page.route("**/api/unique/actors**", (route) => fulfillJson(route, { playerId: 1, items: [] }));
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
}

/**
 * T13 (GG-38): "layers load what they need" is a claim about real network behavior, not something
 * a unit test running in jsdom can observe — there's no real chunk boundary in that environment.
 * This proves it against the real production build in a real browser: nothing heavy fetches until
 * the surface that needs it is actually opened.
 */
test.describe("Bundle splitting (T13)", () => {
  test("Creatures' own chunk fetches only once the layer is opened, not on Sanctum load", async ({ page }) => {
    await mockSanctum(page);
    const jsRequests: string[] = [];
    page.on("request", (req) => {
      if (req.url().endsWith(".js")) jsRequests.push(req.url());
    });

    await page.goto("/#/sanctum");
    await expect(page.getByTestId("sanctum-hud")).toBeVisible();
    expect(jsRequests.some((u) => /CreaturesLayer-.*\.js$/.test(u))).toBe(false);

    await page.getByTestId("rail-creatures").click();
    await expect(page.getByTestId("creatures-layer")).toBeVisible();
    await expect.poll(() => jsRequests.some((u) => /CreaturesLayer-.*\.js$/.test(u))).toBe(true);
  });

  test("Relics' chunk never fetches if the layer is never opened", async ({ page }) => {
    await mockSanctum(page);
    const jsRequests: string[] = [];
    page.on("request", (req) => {
      if (req.url().endsWith(".js")) jsRequests.push(req.url());
    });

    await page.goto("/#/sanctum");
    await page.getByTestId("rail-creatures").click();
    await expect(page.getByTestId("creatures-layer")).toBeVisible();

    expect(jsRequests.some((u) => /RelicsLayer-.*\.js$/.test(u))).toBe(false);
  });

  test("Lawn's Phaser chunk and World's map chunk stay off the Sanctum path entirely", async ({ page }) => {
    await mockSanctum(page);
    const jsRequests: string[] = [];
    page.on("request", (req) => {
      if (req.url().endsWith(".js")) jsRequests.push(req.url());
    });

    await page.goto("/#/sanctum");
    await page.getByTestId("rail-creatures").click();
    await expect(page.getByTestId("creatures-layer")).toBeVisible();

    expect(jsRequests.some((u) => /LawnStage-.*\.js$/.test(u))).toBe(false);
    // `WorldStage` is the one chunk now, shared by both `#/world` and `#/world-stage` since the
    // routing work that retired the old `@xyflow/react`-based `WorldPage` (world-stage, 2026-09-05).
    expect(jsRequests.some((u) => /WorldStage-.*\.js$/.test(u))).toBe(false);
  });

  test("the developer tree's nine pages fetch only when the tree is actually opened", async ({ page }) => {
    await mockSanctum(page);
    const jsRequests: string[] = [];
    page.on("request", (req) => {
      if (req.url().endsWith(".js")) jsRequests.push(req.url());
    });

    await page.goto("/#/sanctum?devmode=1");
    await expect(page).toHaveURL(/#\/sanctum(?!.*devmode)/);
    expect(jsRequests.some((u) => /StatusPage-.*\.js$/.test(u))).toBe(false);

    await page.keyboard.press("`");
    await expect(page.getByTestId("dev-tree")).toBeVisible();
    await expect.poll(() => jsRequests.some((u) => /StatusPage-.*\.js$/.test(u))).toBe(true);
  });
});

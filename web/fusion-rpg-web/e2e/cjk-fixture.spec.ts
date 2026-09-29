import { test, expect, type Page, type Route } from "@playwright/test";

// A long CJK name — GG-56: "Surfaces tolerate ±40% length change without breaking." Chosen to be
// visibly longer than a typical Latin name, not just present.
const CJK_NAME = "凋零指挥官阿什凯尔的传奇远征队";

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

async function mockSanctum(page: Page) {
  await page.route("**/hub/rpg**", (route) => route.abort());
  await page.route("**/health", (route) => fulfillJson(route, health));
  await page.route("**/api/players", (route) =>
    fulfillJson(route, {
      items: [{ id: 1, name: CJK_NAME, createdUtc: "2026-01-01T00:00:00Z" }],
      currentPlayerId: 1
    })
  );
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
}

/**
 * GG-56: "Every font stack declares a CJK fallback, and no layout assumes Latin text metrics."
 * `actorLadder.test.tsx` already proves CJK text renders correctly across all five entity-ladder
 * rungs (DOM assertion, jsdom). What that can't prove is the "±40% length change without breaking"
 * visual claim — real layout, real font metrics — which needs a real browser, the same reason
 * GG-36's viewport sweep is an e2e spec.
 */
test.describe("CJK text (GG-56 — visual, at the declared floor width)", () => {
  test("a long CJK player name in the HUD causes no horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await mockSanctum(page);
    await page.goto("/#/sanctum");

    await expect(page.getByTestId("sanctum-hud-identity")).toContainText(CJK_NAME);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
  });

  test("a long CJK player name renders with a real CJK-fallback font, not tofu boxes", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await mockSanctum(page);
    await page.goto("/#/sanctum");

    const identity = page.getByTestId("sanctum-hud-identity");
    await expect(identity).toContainText(CJK_NAME);
    const fontFamily = await identity.evaluate((el) => getComputedStyle(el).fontFamily);
    // theme/tokens.css's --font-ui declares a CJK fallback chain — assert it's actually present in
    // the resolved stack, not just declared somewhere unused.
    expect(fontFamily).toMatch(/Noto Sans SC|Source Han Sans SC|PingFang SC|Microsoft YaHei/);
  });
});

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

async function mockSanctumEmpty(page: Page) {
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

// fe-essentials T1 VISUAL: screenshots for actual inspection, not just Playwright passing —
// passing assertions prove structure, not layout (GOAL's own anti-cheat rule).
const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 375, height: 667 }
];

for (const vp of VIEWPORTS) {
  test(`first-run reveal renders cleanly at ${vp.name} (${vp.width}x${vp.height})`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await mockSanctumEmpty(page);
    await page.goto("/#/sanctum");
    await expect(page.getByTestId("focus-card-first-run")).toBeVisible();
    await page.screenshot({ path: `test-results/visual/first-run-reveal-${vp.name}.png`, fullPage: true });
  });
}

async function mockTypes(page: Page) {
  await page.route("**/api/types", (route) =>
    fulfillJson(route, { items: [{ side: "plant", type: 3, typeName: "sunflower", displayName: "Sunflower" }] })
  );
}

for (const vp of VIEWPORTS) {
  test(`actor-menu scope picker renders cleanly at ${vp.name} (${vp.width}x${vp.height}), each mode`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await mockSanctumEmpty(page);
    await mockTypes(page);
    await page.goto("/#/actor-menu-scope-picker-demo?mock=1");
    await expect(page.getByTestId("actor-menu-scope-picker")).toBeVisible();
    await expect(page.getByTestId("scope-mode-relation")).toHaveAttribute("aria-selected", "true");
    await page.screenshot({ path: `test-results/visual/scope-picker-${vp.name}-relation.png`, fullPage: true });

    await page.getByTestId("scope-mode-target").click();
    // Tailwind's transition-colors animates the tab highlight over ~150ms. The DOM state
    // (aria-selected, the React-driven class) is already correct the instant the click resolves —
    // confirmed via a targeted probe (getComputedStyle mid-transition showed the painted color still
    // catching up while the class/attribute were already right). A screenshot cares about the
    // *painted pixel*, so it has to wait out the animation, not just the attribute.
    await expect(page.getByTestId("scope-mode-target")).toHaveAttribute("aria-selected", "true");
    await page.waitForTimeout(250);
    await page.screenshot({ path: `test-results/visual/scope-picker-${vp.name}-target.png`, fullPage: true });

    await page.getByTestId("scope-mode-type").click();
    await expect(page.getByTestId("scope-mode-type")).toHaveAttribute("aria-selected", "true");
    await page.waitForTimeout(250);
    await page.screenshot({ path: `test-results/visual/scope-picker-${vp.name}-type.png`, fullPage: true });
  });
}

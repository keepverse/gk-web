import AxeBuilder from "@axe-core/playwright";
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

// T28 (plate 04 §A): the clean player HUD, the developer-mode gate on the pre-existing debug
// apparatus, and the Rail's own reachability on Lawn (T25's "same on every stage" claim).
test.describe("Lawn player HUD (T28)", () => {
  test("the clean HUD renders unconditionally; the debug toolbar/inspector don't, until developer mode is on", async ({ page }) => {
    await mockShell(page);
    await page.goto("/#/lawn");

    await expect(page.getByTestId("lawn-match-hud")).toBeVisible();
    await expect(page.getByTestId("lawn-match-hud-field")).toBeVisible();
    await expect(page.getByTestId("lawn-hud-sun")).toBeVisible();
    await expect(page.getByTestId("lawn-hud-wave")).toBeVisible();
    await expect(page.getByTestId("lawn-hud-deployed-empty")).toBeVisible();
    await expect(page.getByTestId("lawn-hud-playback")).toBeVisible();
    await expect(page.getByTestId("lawn-match-hud-connection")).toBeVisible();

    // The pre-existing debug apparatus (GG-41: not deleted, just gated) is absent by default.
    await expect(page.getByTestId("lawn-view-toolbar")).not.toBeVisible();
    await expect(page.getByTestId("panel-lawn-inspector")).not.toBeVisible();
    // The T2 keystone-proof button (redundant now the Rail is real, and found overlapping the top
    // banner at a wider viewport during a second visual pass) is gated the same way.
    await expect(page.getByTestId("lawn-stage-open-panel")).not.toBeVisible();
    // The board itself is still there, full-bleed, for every player.
    await expect(page.getByTestId("lawn-canvas-plain")).toBeVisible();

    const results = await new AxeBuilder({ page }).exclude('[data-testid="lawn-canvas-plain"] canvas').analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });

  test("developer mode restores the full debug toolbar and inspector, byte-for-byte unchanged", async ({ page }) => {
    await mockShell(page);
    await page.goto("/#/lawn?devmode=1");

    await expect(page.getByTestId("lawn-match-hud")).toBeVisible(); // match HUD stays in developer mode too
    await expect(page.getByTestId("lawn-view-toolbar")).toBeVisible();
    await expect(page.getByTestId("panel-lawn-inspector")).toBeVisible();
    await expect(page.getByTestId("lawn-spawn-panel")).toBeVisible();
    await expect(page.getByTestId("lawn-overlay-fx")).toBeVisible();
    await expect(page.getByTestId("lawn-stage-open-panel")).toBeVisible();
  });

  test("toggling developer mode live (via System, mounted globally) updates the Lawn gate without a reload", async ({ page }) => {
    await mockShell(page);
    await page.goto("/#/lawn");
    await expect(page.getByTestId("lawn-view-toolbar")).not.toBeVisible();

    await page.keyboard.press("Escape"); // empty stack -> System (GG-5)
    await expect(page.getByTestId("system-layer")).toBeVisible();
    await page.getByTestId("pref-developer-mode").click();
    await page.getByTestId("system-done").click();

    await expect(page.getByTestId("lawn-view-toolbar")).toBeVisible();
  });

  test("the Rail is reachable on Lawn (T25 — same on every stage) and navigates to where a layer actually lives", async ({ page }) => {
    await mockShell(page);
    await page.goto("/#/lawn");

    await expect(page.getByTestId("rail")).toBeVisible();
    await expect(page.getByTestId("rail-sanctum")).not.toHaveAttribute("data-state", "active");
    await expect(page.getByTestId("rail-creatures")).not.toBeDisabled();

    await page.getByTestId("rail-creatures").click();
    await expect(page).toHaveURL(/#\/sanctum\?panel=creatures/);
    await expect(page.getByTestId("creatures-layer")).toBeVisible();
  });
});

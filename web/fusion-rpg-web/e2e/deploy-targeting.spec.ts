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

const rosterActor = {
  instanceId: "a1",
  playerId: 1,
  side: "plant",
  typeId: 3,
  phase: "Roster",
  level: 5,
  xp: 10,
  revision: 1
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
  await page.route("**/api/unique/actors**", (route) => {
    if (route.request().url().endsWith(`/api/unique/actors/${rosterActor.instanceId}`)) {
      return fulfillJson(route, rosterActor);
    }
    return fulfillJson(route, { playerId: 1, items: [rosterActor] });
  });
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
 * T22 — the real Deploy-targeting flow, from the Creatures layer through to the Lawn stage.
 * NOTE: confirming an actual deploy (clicking a real board cell) isn't covered here — the board is
 * a Phaser canvas, not real DOM, and this repo has no established pattern for simulating a canvas
 * tile click reliably; that step was instead verified live against a real scratch server (see
 * tasks/game-gui-todo.md's T22 evidence). This spec covers everything reachable through real DOM:
 * the trigger, the banner, the disabled-until-a-cell-is-picked gate, and cancel/Esc.
 */
test.describe("Deploy targeting (T22)", () => {
  test("Deploy to the lawn navigates from Creatures into a real targeting banner on the live Lawn stage", async ({ page }) => {
    await mockShell(page);
    await page.goto("/#/sanctum");
    await page.getByTestId("rail-creatures").click();
    await page.getByTestId("creatures-row-a1").click();
    await expect(page.getByTestId("creatures-deploy")).toBeVisible();

    await page.getByTestId("creatures-deploy").click();
    await expect(page).toHaveURL(/#\/lawn\?deploy=a1/);
    await expect(page.getByTestId("lawn-deploy-banner")).toBeVisible();
    await expect(page.getByTestId("lawn-deploy-banner")).toContainText("plant #3");
  });

  test("Deploy here stays disabled until a cell is chosen", async ({ page }) => {
    await mockShell(page);
    await page.goto("/#/lawn?deploy=a1");
    await expect(page.getByTestId("lawn-deploy-banner")).toBeVisible();
    await expect(page.getByTestId("lawn-deploy-confirm")).toBeDisabled();
  });

  test("Cancel clears the deploy target and drops the URL param", async ({ page }) => {
    await mockShell(page);
    await page.goto("/#/lawn?deploy=a1");
    await expect(page.getByTestId("lawn-deploy-banner")).toBeVisible();

    await page.getByTestId("lawn-deploy-cancel").click();
    await expect(page.getByTestId("lawn-deploy-banner")).not.toBeVisible();
    await expect(page).toHaveURL(/#\/lawn(?!\?deploy)/);
  });

  test("Esc cancels deploy-targeting instead of falling through to System (GG-6)", async ({ page }) => {
    await mockShell(page);
    await page.goto("/#/lawn?deploy=a1");
    await expect(page.getByTestId("lawn-deploy-banner")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("lawn-deploy-banner")).not.toBeVisible();
    await expect(page.getByTestId("system-layer")).not.toBeVisible();
  });
});

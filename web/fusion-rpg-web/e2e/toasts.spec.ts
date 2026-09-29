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
  await page.route("**/api/players", (route) => {
    if (route.request().method() === "POST") return fulfillJson(route, null, 500);
    return fulfillJson(route, players);
  });
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

test.describe("Mutation feedback toasts (T11)", () => {
  test("a forced 500 produces a failure toast naming the entity, and it doesn't block input", async ({ page }) => {
    await mockShell(page);
    // fe-essentials: player creation moved from HudBar (removed — plate 01 §F) to /saves.
    // Toasts are mounted at the app root (App.tsx), not inside AppShell, specifically so they
    // still fire on routes like this one that sit outside AppShell entirely.
    await page.goto("/#/saves");

    await page.getByTestId("save-slot-new").click();
    await page.getByTestId("save-slot-create-input").fill("New Save");
    await page.getByTestId("save-slot-create-submit").click();

    const stack = page.getByTestId("toast-stack");
    await expect(stack).toBeVisible();
    await expect(page.getByTestId("toast-title")).toHaveText("Player update failed");
    await expect(page.getByTestId("toast-message")).toContainText("Nothing changed");

    // The rest of the page behind the toast stack is still clickable — a toast never blocks input.
    await page.getByTestId("save-select-back").click();
    await expect(page).toHaveURL(/#\/$/);
  });

  test("the toast auto-expires without needing a close click", async ({ page }) => {
    await mockShell(page);
    await page.goto("/#/saves");

    await page.getByTestId("save-slot-new").click();
    await page.getByTestId("save-slot-create-input").fill("New Save");
    await page.getByTestId("save-slot-create-submit").click();
    await expect(page.getByTestId("toast-title")).toBeVisible();

    await expect(page.getByTestId("toast-title")).not.toBeVisible({ timeout: 7000 });
  });
});

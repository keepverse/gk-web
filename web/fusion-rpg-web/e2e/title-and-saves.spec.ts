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

async function mockShell(page: Page, players: { items: { id: number; name: string; createdUtc: string }[]; currentPlayerId: number }) {
  await page.route("**/hub/rpg**", (route) => route.abort());
  await page.route("**/health", (route) => fulfillJson(route, health));
  await page.route("**/api/players", (route) => {
    if (route.request().method() === "GET") return fulfillJson(route, players);
    return route.continue();
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

const ONE_PLAYER = { items: [{ id: 1, name: "Ashwarden", createdUtc: "2026-01-01T00:00:00Z" }], currentPlayerId: 1 };
const NO_PLAYERS = { items: [], currentPlayerId: 1 };

test.describe("Title screen (plate 01 §A)", () => {
  test("the bare index route shows Title, not an auto-redirect into Sanctum", async ({ page }) => {
    await mockShell(page, ONE_PLAYER);
    await page.goto("/");
    await expect(page.getByTestId("title-screen")).toBeVisible();
    await expect(page.getByText("Rise of Summoner")).toBeVisible();
    await expect(page.getByTestId("sanctum-hud")).toHaveCount(0);
  });

  test("Continue is disabled with no summoner yet, enabled once one exists", async ({ page }) => {
    await mockShell(page, NO_PLAYERS);
    await page.goto("/#/");
    await expect(page.getByTestId("title-continue")).toBeDisabled();

    await mockShell(page, ONE_PLAYER);
    await page.reload();
    await expect(page.getByTestId("title-continue")).not.toBeDisabled();
  });

  test("Continue reaches the real Sanctum stage", async ({ page }) => {
    await mockShell(page, ONE_PLAYER);
    await page.goto("/#/");
    await page.getByTestId("title-continue").click();
    await expect(page).toHaveURL(/#\/sanctum/);
    await expect(page.getByTestId("sanctum-hud")).toBeVisible();
  });

  test("New summoner opens Save select with the create form already showing", async ({ page }) => {
    await mockShell(page, ONE_PLAYER);
    await page.goto("/#/");
    await page.getByTestId("title-new-summoner").click();
    await expect(page).toHaveURL(/#\/saves\?create=1/);
    await expect(page.getByTestId("save-slot-create-form")).toBeVisible();
  });

  test("Saves opens Save select on the existing slots", async ({ page }) => {
    await mockShell(page, ONE_PLAYER);
    await page.goto("/#/");
    await page.getByTestId("title-saves").click();
    await expect(page).toHaveURL(/#\/saves/);
    await expect(page.getByTestId("save-slot-1")).toBeVisible();
  });

  test("Settings opens the real System layer over Sanctum", async ({ page }) => {
    await mockShell(page, ONE_PLAYER);
    await page.goto("/#/");
    await page.getByTestId("title-settings").click();
    await expect(page).toHaveURL(/#\/sanctum\?system=1/);
    await expect(page.getByTestId("system-layer")).toBeVisible();
  });
});

test.describe("Save select (plate 01 §B)", () => {
  test("lists real player slots with name and creation date, no fabricated stats", async ({ page }) => {
    await mockShell(page, ONE_PLAYER);
    await page.goto("/#/saves");
    await expect(page.getByTestId("save-slot-name-1")).toHaveText("Ashwarden");
    // The plate mocks up level/creatures-bound/sectors-held — none of that exists on PlayerDto,
    // so none of it should be fabricated here.
    await expect(page.getByTestId("save-slot-1")).not.toContainText("Level");
    await expect(page.getByTestId("save-slot-1")).not.toContainText("creatures bound");
  });

  test("Continue on a slot selects that player for real, then reaches Sanctum", async ({ page }) => {
    let selectedId: number | null = null;
    await mockShell(page, ONE_PLAYER);
    await page.route("**/api/players/current", async (route) => {
      selectedId = (route.request().postDataJSON() as { id: number }).id;
      await fulfillJson(route, { ok: true });
    });
    await page.goto("/#/saves");
    await page.getByTestId("save-slot-continue-1").click();
    await expect.poll(() => selectedId).toBe(1);
    await expect(page).toHaveURL(/#\/sanctum/);
  });

  test("creating a summoner really posts, then auto-continues into Sanctum", async ({ page }) => {
    let created: string | null = null;
    await mockShell(page, ONE_PLAYER);
    await page.route("**/api/players", async (route) => {
      if (route.request().method() === "POST") {
        created = (route.request().postDataJSON() as { name: string }).name;
        await fulfillJson(route, { id: 2, name: created });
        return;
      }
      await fulfillJson(route, ONE_PLAYER);
    });
    await page.goto("/#/saves?create=1");
    await page.getByTestId("save-slot-create-input").fill("Second run");
    await page.getByTestId("save-slot-create-submit").click();
    await expect.poll(() => created).toBe("Second run");
    await expect(page).toHaveURL(/#\/sanctum/);
  });

  test("Back to title returns to the real Title screen", async ({ page }) => {
    await mockShell(page, ONE_PLAYER);
    await page.goto("/#/saves");
    await page.getByTestId("save-select-back").click();
    await expect(page).toHaveURL(/#\/$/);
    await expect(page.getByTestId("title-screen")).toBeVisible();
  });
});

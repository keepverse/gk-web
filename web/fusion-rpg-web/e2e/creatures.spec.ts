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

const actors = {
  playerId: 1,
  items: [
    { instanceId: "a1", playerId: 1, side: "plant", typeId: 3, phase: "Roster", level: 5, xp: 10, revision: 1 },
    { instanceId: "a2", playerId: 1, side: "zombie", typeId: 7, phase: "ActiveBound", level: 12, xp: 200, revision: 1 }
  ]
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
  await page.route("**/api/unique/actors**", (route) => fulfillJson(route, actors));
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

test.describe("Creatures layer (T10)", () => {
  test("C opens it, Esc closes it, the Sanctum is never unmounted", async ({ page }) => {
    await mockSanctum(page);
    await page.goto("/#/sanctum");
    await expect(page.getByTestId("sanctum-hud")).toBeVisible();

    await page.keyboard.press("c");
    await expect(page.getByTestId("creatures-layer")).toBeVisible();
    await expect(page.getByTestId("sanctum-hud")).toBeVisible(); // stage still mounted

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("creatures-layer")).not.toBeVisible();
    await expect(page.getByTestId("sanctum-hud")).toBeVisible();
  });

  test("cards show side and level, and no typeId leaks onto the page", async ({ page }) => {
    await mockSanctum(page);
    await page.goto("/#/sanctum?panel=creatures");
    await expect(page.getByTestId("creatures-row-a1")).toContainText("Plant");
    await expect(page.getByTestId("creatures-row-a1")).toContainText("Lv 5");
    const bodyText = await page.textContent("body");
    expect(bodyText?.toLowerCase()).not.toContain("typeid");
  });

  test("#/sanctum?panel=creatures&sel=... deep-links cold: stage first, then the layer, with the selection applied", async ({ page }) => {
    await mockSanctum(page);
    await page.goto("/#/sanctum?panel=creatures&sel=a2");

    await expect(page.getByTestId("sanctum-hud")).toBeVisible();
    await expect(page.getByTestId("creatures-layer")).toBeVisible();
    await expect(page.getByTestId("creatures-detail")).toBeVisible();
    await expect(page.getByTestId("creatures-detail")).toContainText("Lv 12");
  });

  test("#/roster redirects to the Creatures layer", async ({ page }) => {
    await mockSanctum(page);
    await page.goto("/#/roster");
    await expect(page).toHaveURL(/#\/sanctum\?panel=creatures/);
    await expect(page.getByTestId("creatures-layer")).toBeVisible();
  });
});

// T27 (plate 02 §A/§D): search/filter/sort, and GG-51's close/reopen persistence, in a real browser.
test.describe("Creatures layer — plate parity (T27)", () => {
  test("the side filter and search box narrow the real list live", async ({ page }) => {
    await mockSanctum(page);
    await page.goto("/#/sanctum?panel=creatures");
    await expect(page.getByTestId("creatures-row-a1")).toBeVisible();
    await expect(page.getByTestId("creatures-row-a2")).toBeVisible();

    await page.getByTestId("creatures-filter-zombie").click();
    await expect(page.getByTestId("creatures-row-a1")).not.toBeVisible();
    await expect(page.getByTestId("creatures-row-a2")).toBeVisible();

    await page.getByTestId("creatures-filter-all").click();
    await page.getByTestId("creatures-search").fill("lvl 5");
    await expect(page.getByTestId("creatures-row-a1")).toBeVisible();
    await expect(page.getByTestId("creatures-row-a2")).not.toBeVisible();
  });

  test("search/filter/sort state survives the layer closing and reopening, within the session (GG-51)", async ({ page }) => {
    await mockSanctum(page);
    await page.goto("/#/sanctum?panel=creatures");
    await page.getByTestId("creatures-filter-zombie").click();
    await page.getByTestId("creatures-sort").selectOption("level-asc");

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("creatures-layer")).not.toBeVisible();

    await page.keyboard.press("c");
    await expect(page.getByTestId("creatures-layer")).toBeVisible();
    await expect(page.getByTestId("creatures-filter-zombie")).toHaveAttribute("aria-current", "true");
    await expect(page.getByTestId("creatures-sort")).toHaveValue("level-asc");
    await expect(page.getByTestId("creatures-row-a1")).not.toBeVisible();
  });
});

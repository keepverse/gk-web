import { test, expect, type Page, type Route } from "@playwright/test";

/**
 * spec-allocation-surface.md, testing strategy item 9 — "a species' build is visible, adjustable,
 * revertible, and the change survives a reload." Mirrors `expeditions-pacts.spec.ts`'s own fully
 * mocked-network convention (no live server needed): every REST call this flow touches is stubbed
 * via `page.route`, and the species-aptitudes/respec-price fixtures are mutated by the POST route
 * handler itself so a reload genuinely reflects what was just saved, not a hardcoded response.
 */

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

const boundCreature = {
  instanceId: "d1",
  bound: true,
  deployable: true,
  loyalty: 800,
  rank: "trusted",
  personality: "stoic",
  upkeepPerDay: 5
};

const BASELINE = { Might: 500, Vigor: 300, Fortitude: 200 };

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function mockSanctumWithSpeciesBuild(page: Page) {
  // Mutable server-side state for this test's own fake backend, so a POST /respec followed by a
  // reload's GET actually reflects the save -- not two independently hardcoded fixtures.
  let shares: Record<string, number> = { ...BASELINE };
  let hasOverride = false;

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
      contracts: [boundCreature],
      capacity: { used: 1, total: 4, purchasedSlots: 0, nextSlotPrice: 500, canBuy: true, maxSlots: 8 },
      dailyTribute: 5,
      deployFloor: 200,
      loyaltyMax: 1000
    })
  );
  await page.route("**/api/creatures/catalog", (route) => fulfillJson(route, { species: [] }));
  await page.route("**/api/creatures/*/codex", (route) => fulfillJson(route, { entries: [] }));
  await page.route("**/api/creatures/*/summon-state", (route) => fulfillJson(route, { pity: 0 }));
  await page.route("**/api/creatures/*", (route) =>
    fulfillJson(route, {
      playerId: 1,
      items: [
        {
          profile: { instanceId: "d1", speciesId: "fumeshroom", rarity: "epic", star: 1, elementPrimary: "fire", nickname: null },
          actor: { level: 21 }
        }
      ]
    })
  );
  await page.route("**/api/patron/**", (route) => fulfillJson(route, { patron: null, switchCostSouls: 100 }));

  await page.route("**/api/aptitudes/species/1/fumeshroom", (route) =>
    fulfillJson(route, {
      speciesId: "fumeshroom",
      level: 21,
      budget: 1000,
      spent: 1000,
      withinBudget: true,
      hasOverride,
      shares,
      baseline: BASELINE
    })
  );
  await page.route("**/api/species-build/respec-price/1/fumeshroom", (route) =>
    fulfillJson(route, { speciesId: "fumeshroom", respecCount: 0, priceResource: "Soul", priceAmount: 50, everRespecced: hasOverride })
  );
  await page.route("**/api/species-build/respec", async (route) => {
    const body = route.request().postDataJSON() as { shares: Record<string, number> };
    hasOverride = Object.values(body.shares).some((v) => v !== 0);
    // Mirrors the real server's own EffectiveSpeciesAllocation: an all-zero post is a REVERT (the
    // override is cleared), so subsequent reads fall back to the shipped baseline, never a stored
    // all-zero row.
    shares = hasOverride ? body.shares : { ...BASELINE };
    await fulfillJson(route, {
      speciesId: "fumeshroom",
      level: 21,
      priced: false,
      priceAmount: 0,
      respecCount: 0,
      soulBalance: 500,
      replay: false,
      shares
    });
  });
  // Commander aptitudes -- AptitudesLayer's other tab needs this even though this flow never visits it.
  await page.route("**/api/aptitudes/1", (route) =>
    fulfillJson(route, { theta: 100, budget: 300, spent: 0, withinBudget: true, shares: { Might: 0 } })
  );
}

test.describe("Species build panel (spec-allocation-surface.md)", () => {
  test("visible, adjustable, revertible, and the change survives a reload", async ({ page }) => {
    await mockSanctumWithSpeciesBuild(page);
    await page.goto("/#/sanctum");
    await page.getByTestId("rail-pacts").click();
    await expect(page.getByTestId("pacts-layer")).toBeVisible();

    // Visible: the shipped baseline for a species the player has never touched.
    await page.getByTestId("pact-view-build-d1").click();
    await expect(page.getByTestId("aptitudes-layer")).toBeVisible();
    await expect(page.getByTestId("species-build-panel")).toBeVisible();
    await expect(page.getByTestId("species-build-input-Might")).toHaveValue("500");
    await expect(page.getByTestId("species-build-status")).toContainText("shipped build");

    // Adjustable + first override is free (no confirm dialog): redistribute within the same budget.
    await page.getByTestId("species-build-input-Might").fill("400");
    await page.getByTestId("species-build-input-Vigor").fill("400");
    await page.getByTestId("species-build-save").click();
    await expect(page.getByTestId("species-build-status")).toContainText("overridden");
    await expect(page.getByTestId("species-build-input-Might")).toHaveValue("400");

    // Survives a reload: the override is server-persisted, not merely local component state.
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await page.reload();
    await expect(page.getByTestId("rail-pacts")).toBeEnabled();
    await page.getByTestId("rail-pacts").click();
    await page.getByTestId("pact-view-build-d1").click();
    await expect(page.getByTestId("species-build-input-Might")).toHaveValue("400");
    await expect(page.getByTestId("species-build-status")).not.toContainText("You're running");

    // Revertible, and free: back to the shipped baseline.
    for (const id of Object.keys(BASELINE)) {
      await page.getByTestId(`species-build-input-${id}`).fill("0");
    }
    const refetched = page.waitForResponse((r) => r.url().includes("/api/aptitudes/species/1/fumeshroom") && r.request().method() === "GET");
    await page.getByTestId("species-build-save").click();
    await refetched;
    await expect(page.getByTestId("species-build-status")).toContainText("You're running");
    await expect(page.getByTestId("species-build-input-Might")).toHaveValue("500");
  });
});

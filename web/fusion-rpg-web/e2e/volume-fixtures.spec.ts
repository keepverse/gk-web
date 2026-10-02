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

function actorFixture(count: number) {
  return {
    playerId: 1,
    items: Array.from({ length: count }, (_, i) => ({
      instanceId: `a${i}`,
      playerId: 1,
      side: i % 2 === 0 ? "plant" : "zombie",
      typeId: i + 1,
      phase: "Roster",
      level: 1 + (i % 60),
      xp: i * 7,
      revision: 1
    }))
  };
}

async function mockSanctum(page: Page, actorCount: number) {
  await page.route("**/hub/rpg**", (route) => route.abort());
  await page.route("**/health", (route) => fulfillJson(route, health));
  await page.route("**/api/players", (route) => fulfillJson(route, players));
  await page.route("**/api/players/current", (route) => fulfillJson(route, { ok: true }));
  await page.route("**/api/sim", (route) => fulfillJson(route, null, 404));
  await page.route("**/api/unique/actors**", (route) => fulfillJson(route, actorFixture(actorCount)));
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
 * GG-50's own "Testable as": "A seeded fixture at each magnitude per collection surface; assert
 * rendered node count." jsdom can't do this meaningfully — `@tanstack/react-virtual` measures real
 * layout (clientHeight/getBoundingClientRect), which jsdom reports as zero by default, so this has
 * to run against a real browser, the same reason T13's chunk-loading proof is an e2e spec and not a
 * unit test.
 */
// TEST-ID DRIFT, corrected 2026-10-02 against the component rather than the other way round.
// ActorCollection derives every id from a `testId` prefix, so these names were never literal in
// src and a plain-text search cannot see them: a row is `${testId}-item-${item.key}` (not
// `-row-`), the first-tier prompt is `${testId}-search-first` (not `-search-first-prompt`), and the
// side control is a single `${testId}-side` <select> of all/plant/zombie (not two
// `-filter-all`/`-filter-zombie` buttons carrying aria-current). Persistence is therefore asserted
// through the select's VALUE, which is the same property the old aria-current check covered.
// Every assertion's intent is unchanged.
test.describe("Volume fixtures (GG-50 — CreaturesLayer)", () => {
  test("at 10: renders all rows directly (below the virtualize threshold)", async ({ page }) => {
    await mockSanctum(page, 10);
    await page.goto("/#/sanctum");
    await page.getByTestId("rail-creatures").click();
    await expect(page.getByTestId("creatures-layer")).toBeVisible();

    const list = page.getByTestId("creatures-list");
    await expect(list).not.toHaveAttribute("data-virtualized", "true");
    await expect(page.locator('[data-testid^="creatures-item-"]')).toHaveCount(10);
  });

  test("at 100: switches to the virtualized strategy — far fewer than 100 rows actually mount", async ({ page }) => {
    await mockSanctum(page, 100);
    await page.goto("/#/sanctum");
    await page.getByTestId("rail-creatures").click();
    await expect(page.getByTestId("creatures-layer")).toBeVisible();

    // 100 is inside the windowed tier (25–240) — the grid renders directly, no search-first prompt.
    await expect(page.getByTestId("creatures-search-first")).not.toBeVisible();
    const list = page.getByTestId("creatures-list");
    await expect(list).toHaveAttribute("data-virtualized", "true");

    const mounted = await page.locator('[data-testid^="creatures-item-"]').count();
    expect(mounted).toBeGreaterThan(0);
    expect(mounted).toBeLessThan(30); // the ~320px window fits well under 10 rows plus overscan
  });

  // T27 (GG-50's third tier, plate 02 §D): above 240 the grid starts empty — a search or filter is
  // the entry point, not an optional refinement.
  test("at 241: the grid starts empty (search-first) until a search or filter narrows it", async ({ page }) => {
    await mockSanctum(page, 241);
    await page.goto("/#/sanctum");
    await page.getByTestId("rail-creatures").click();
    await expect(page.getByTestId("creatures-layer")).toBeVisible();

    await expect(page.getByTestId("creatures-search-first")).toBeVisible();
    // LEFT RED DELIBERATELY: the prompt reads "Too many to list - search or filter to narrow
    // the roster." and carries no count. Making this pass means either weakening the
    // assertion or changing user-visible copy; the first is forbidden and the second is a
    // product decision, so it is reported rather than resolved here.
    await expect(page.getByTestId("creatures-search-first")).toContainText("241 creatures");
    await expect(page.getByTestId("creatures-list")).not.toBeVisible();
    expect(await page.locator('[data-testid^="creatures-item-"]').count()).toBe(0);

    await page.getByTestId("creatures-side").selectOption("zombie");
    await expect(page.getByTestId("creatures-search-first")).not.toBeVisible();
    const list = page.getByTestId("creatures-list");
    await expect(list).toHaveAttribute("data-virtualized", "true");
    // rendered node count still stays flat, same ceiling as the windowed tier — filtering into the
    // search-first tier reuses the same virtualized rendering path, not a separate one.
    const mounted = await page.locator('[data-testid^="creatures-item-"]').count();
    expect(mounted).toBeGreaterThan(0);
    expect(mounted).toBeLessThan(30);
  });

  test("at 1000: filtering into the search-first tier keeps the mounted node count flat, not 1000", async ({ page }) => {
    await mockSanctum(page, 1000);
    await page.goto("/#/sanctum");
    await page.getByTestId("rail-creatures").click();
    await expect(page.getByTestId("creatures-layer")).toBeVisible();
    await expect(page.getByTestId("creatures-search-first")).toBeVisible();

    await page.getByTestId("creatures-search").fill("plant");
    const list = page.getByTestId("creatures-list");
    await expect(list).toHaveAttribute("data-virtualized", "true");

    const mounted = await page.locator('[data-testid^="creatures-item-"]').count();
    expect(mounted).toBeGreaterThan(0);
    expect(mounted).toBeLessThan(30);
  });

  test("scrolling a virtualized list changes which rows are mounted (it's really windowing, not a static slice)", async ({ page }) => {
    await mockSanctum(page, 1000);
    await page.goto("/#/sanctum");
    await page.getByTestId("rail-creatures").click();
    // 1000 is above the search-first threshold — narrow it first so the list actually renders.
    // T27 sorts by level (default: high to low), so "the first mounted row" isn't a fixed instanceId
    // any more — assert on the mounted *set* changing instead of one specific id.
    await page.getByTestId("creatures-search").fill("plant");
    const list = page.getByTestId("creatures-list");
    await expect(list).toBeVisible();
    await expect(list).toHaveAttribute("data-virtualized", "true");

    const rowIds = () => page.locator('[data-testid^="creatures-item-"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")));
    await expect.poll(async () => (await rowIds()).length).toBeGreaterThan(0);
    const before = await rowIds();

    await list.evaluate((el) => {
      el.scrollTop = el.scrollHeight - el.clientHeight;
    });
    await expect.poll(async () => {
      const after = await rowIds();
      return after.length > 0 && after.some((id) => !before.includes(id));
    }).toBe(true);
  });
});

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

const boundCreature = {
  instanceId: "d1",
  bound: true,
  deployable: true,
  loyalty: 800,
  rank: "trusted",
  personality: "stoic",
  upkeepPerDay: 5
};

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function mockSanctum(page: Page, opts?: { contracts?: unknown[]; expeditions?: unknown[] }) {
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
      contracts: opts?.contracts ?? [],
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
          profile: { instanceId: "d1", speciesId: "sp-imp", rarity: "epic", star: 1, elementPrimary: "fire", nickname: null },
          actor: { level: 5 }
        }
      ]
    })
  );
  await page.route("**/api/patron/**", (route) => fulfillJson(route, { patron: null, switchCostSouls: 100 }));
  await page.route("**/api/expeditions/*/materials", (route) => fulfillJson(route, { items: [] }));
  await page.route("**/api/expeditions/*", (route) =>
    fulfillJson(route, { serverUtc: "2026-01-01T12:00:00Z", tiers: [], items: opts?.expeditions ?? [] })
  );
}

test.describe("Expeditions layer (T17)", () => {
  test("locked with no bound creature", async ({ page }) => {
    await mockSanctum(page);
    await page.goto("/#/sanctum");
    await expect(page.getByTestId("rail-expeditions")).toBeDisabled();
  });

  test("unlocks and opens with a bound creature, Esc closes without unmounting the Sanctum", async ({ page }) => {
    await mockSanctum(page, { contracts: [boundCreature] });
    await page.goto("/#/sanctum");
    await expect(page.getByTestId("rail-expeditions")).not.toBeDisabled();

    await page.keyboard.press("e");
    await expect(page.getByTestId("expeditions-layer")).toBeVisible();
    await expect(page.getByTestId("sanctum-hud")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("expeditions-layer")).not.toBeVisible();
    await expect(page.getByTestId("sanctum-hud")).toBeVisible();
  });

  test("a returned-but-uncollected expedition badges the rail on load, never opening a dialog on its own", async ({ page }) => {
    // The toast fires only for a return the watcher observes *after* its first poll (unit-tested
    // in expeditionReturnWatcher.test.tsx, where timing is controllable) — a return already due
    // when the player opens the app is old news, not a toast-worthy one; this is the badge half.
    await mockSanctum(page, {
      contracts: [boundCreature],
      expeditions: [
        {
          id: 1,
          state: "Dispatched",
          tierId: "scout-30m",
          squadInstanceIds: ["d1"],
          dispatchedUtc: "2026-01-01T10:00:00Z",
          dueUtc: "2026-01-01T11:00:00Z" // before serverUtc (12:00) — already due
        }
      ]
    });
    await page.goto("/#/sanctum");

    await expect(page.getByTestId("rail-expeditions")).toHaveAttribute("data-state", "badged");
    await expect(page.getByTestId("rail-expeditions-badge")).toHaveText("1");
    await expect(page.getByTestId("expeditions-layer")).not.toBeVisible();
  });

  // AuditNav (the flat leftover sidebar this test used to check for a redundant link) is gone
  // entirely (GG-40, foundation.html F.2) — Expeditions is reachable only through the rail now.
  test("#/expeditions redirects into the layer", async ({ page }) => {
    await mockSanctum(page, { contracts: [boundCreature] });
    await page.goto("/#/expeditions");
    await expect(page).toHaveURL(/#\/sanctum\?panel=expeditions/);
    await expect(page.getByTestId("expeditions-layer")).toBeVisible();
  });

  // T30 (plate 03 §C): the active-expedition card — status pill, real progress %, real roster chips.
  test("an active card shows a real status pill, progress percentage and roster chip; a returned one offers Collect with no fabricated rewards", async ({ page }) => {
    // `expeditionProgress` (expeditionTime.ts) compares against the browser's real `Date.now()`, not
    // the fixture's `serverUtc` — so "away" vs "returned" has to be built relative to the real clock
    // at test-run time, not a fixed historical date (mockSanctum's own dueUtc-before-serverUtc fixture
    // only works for the rail-badge test, which reads a *different*, server-time-relative watcher).
    const now = Date.now();
    const iso = (ms: number) => new Date(ms).toISOString();
    await mockSanctum(page, { contracts: [boundCreature] });
    // mockSanctum's own `/api/expeditions/*` route hardcodes `tiers: []` — override it so
    // "scout-30m" resolves to a real tier, otherwise every card's `due`/progress math silently
    // falls back to its zero-default (this is what broke on the first run of this test).
    await page.route("**/api/expeditions/*", (route) =>
      fulfillJson(route, {
        serverUtc: iso(now),
        tiers: [
          { tierId: "scout-30m", name: "Scout", durationMinutes: 60, tickCount: 2, battleCount: 2, squadSlots: 2, hasBossWave: false, tickMinutes: 30 }
        ],
        items: [
          {
            id: 1,
            state: "Dispatched",
            tierId: "scout-30m",
            squadInstanceIds: ["d1"],
            dispatchedUtc: iso(now - 30 * 60_000),
            dueUtc: iso(now + 30 * 60_000) // still away, ~50% through
          },
          {
            id: 2,
            state: "Dispatched",
            tierId: "scout-30m",
            squadInstanceIds: ["d1"],
            dispatchedUtc: iso(now - 120 * 60_000),
            dueUtc: iso(now - 60 * 60_000) // due an hour ago — returned
          }
        ]
      })
    );
    await page.goto("/#/sanctum?panel=expeditions");

    // Regression: the subtitle's "away" count is the active total *minus* the returned ones, not
    // the raw active total — caught visually (a live screenshot showed "2 away" with only one
    // actually away) before this assertion existed.
    await expect(page.getByTestId("expeditions-layer")).toContainText("1 returned · 1 away");

    const away = page.getByTestId("expedition-1");
    await expect(away).toContainText("away");
    await expect(away.getByTestId("expedition-progress-1")).toBeVisible();
    await expect(away.getByTestId("expedition-roster-1")).toContainText("d1"); // no species catalog mocked — real fallback to instanceId
    await expect(away.getByRole("button", { name: "Collect" })).toBeDisabled();

    const returned = page.getByTestId("expedition-2");
    await expect(returned).toContainText("returned");
    await expect(returned.getByTestId("expedition-progress-2")).not.toBeVisible();
    await expect(returned.getByRole("button", { name: "Collect" })).toBeEnabled();
    // Honest scope: no reward chips on the pre-collect card — ExpeditionRowDto carries no preview.
    await expect(returned).not.toContainText("souls");
  });
});

test.describe("Pacts layer (T17)", () => {
  test("locked with no contract", async ({ page }) => {
    await mockSanctum(page);
    await page.goto("/#/sanctum");
    await expect(page.getByTestId("rail-pacts")).toBeDisabled();
  });

  test("P opens it once bound, an overdue pact disables Renegotiate with its reason inline, Esc closes without unmounting the Sanctum", async ({ page }) => {
    await mockSanctum(page, {
      contracts: [{ instanceId: "d1", bound: true, deployable: false, loyalty: 300, rank: "insubordinate", personality: "cruel", upkeepPerDay: 8 }]
    });
    await page.goto("/#/sanctum");
    await expect(page.getByTestId("rail-pacts")).not.toBeDisabled();

    await page.keyboard.press("p");
    await expect(page.getByTestId("pacts-layer")).toBeVisible();
    await expect(page.getByTestId("pact-renegotiate-d1")).toBeDisabled();
    await expect(page.getByTestId("pact-renegotiate-reason-d1")).toContainText("Insubordinate");
    await expect(page.getByTestId("sanctum-hud")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("pacts-layer")).not.toBeVisible();
    await expect(page.getByTestId("sanctum-hud")).toBeVisible();
  });
});

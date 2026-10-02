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

async function mockSanctum(page: Page) {
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

test.describe("Sanctum stage (T9)", () => {
  // fe-essentials: the bare index route is now the Title screen (plate 01 §A), not an auto-redirect
  // — see title-and-saves.spec.ts for that flow. Sanctum itself is still directly reachable.
  test("navigating straight to /sanctum reaches it without any redirect", async ({ page }) => {
    await mockSanctum(page);
    await page.goto("/#/sanctum");
    await expect(page).toHaveURL(/#\/sanctum/);
    await expect(page.getByTestId("sanctum-hud")).toBeVisible();
  });

  test("first paint contains a playable affordance, not a blank stage (GG-2)", async ({ page }) => {
    await mockSanctum(page);
    await page.goto("/#/sanctum");
    await expect(page.getByTestId("sanctum-hud")).toBeVisible();
    await expect(page.getByTestId("rail")).toBeVisible();
    await expect(page.getByTestId("focus-card-cta")).toBeVisible();
  });

  // The first-run card the player actually sees. This used to assert the legacy sunflower/bind reveal
  // (`FirstRunReveal.tsx`), and the branch it covered has been replaced exactly as this test's own
  // header predicted: `FirstRunReveal` is no longer imported or rendered anywhere in the app — only by
  // its own unit file `FirstRunReveal.test.tsx` ("legacy compatibility") — and its
  // `focus-card-first-run` testid is now claimed by `FocusCard.tsx:67`, the live empty-roster card. So
  // the old copy and the "first-run reveal: bind clicked" console line (logged only at
  // `FirstRunReveal.tsx:15`) could never appear in a real run. Asserting that legacy copy is now
  // ABSENT is the assertion that matters: it is what proves the replacement happened rather than both
  // cards coexisting.
  test("the first-run card is the live one, and the legacy bind reveal is gone", async ({ page }) => {
    await mockSanctum(page);
    await page.goto("/#/sanctum");

    await expect(page.getByTestId("focus-card-first-run")).toBeVisible();
    await expect(page.getByText("First lawn run")).toBeVisible();
    await expect(page.getByTestId("focus-card-cta")).toHaveText("View creatures");

    await expect(page.getByText("This one answered")).toHaveCount(0);
    await expect(page.getByText(/A sunflower has bound itself to you/)).toHaveCount(0);
    await expect(page.getByText("Bind your first creature")).toHaveCount(0);
    await expect(page.getByText("Open Creatures")).toHaveCount(0);

    await page.getByTestId("focus-card-cta").click();
    await expect(page.getByTestId("creatures-layer")).toBeVisible();
    await expect(page).toHaveURL(/panel=creatures/);
  });

  test("the rail's Sanctum entry is active and locked entries say what unlocks them", async ({ page }) => {
    await mockSanctum(page);
    await page.goto("/#/sanctum");
    await expect(page.getByTestId("rail-sanctum")).toHaveAttribute("data-state", "active");
    const relics = page.getByTestId("rail-relics");
    await expect(relics).toBeDisabled();
    await expect(relics).toHaveAttribute("title", /item/);
  });

  test("opening a layer from the rail keeps the stage mounted underneath, and Esc returns to it", async ({ page }) => {
    await mockSanctum(page);
    // Unlock Almanac to exercise a non-Creatures layer here — Creatures has its own dedicated
    // stage-persistence coverage (creatures.spec.ts); every rail entry has a real layer as of T19
    // (almanac-chronicle.spec.ts covers Almanac's own contract).
    await page.route("**/api/runs", (route) => fulfillJson(route, { items: [{ id: 1, startedUtc: "2026-01-01T00:00:00Z" }] }));
    await page.goto("/#/sanctum");

    await page.getByTestId("rail-almanac").click();
    await expect(page.getByTestId("almanac-layer")).toBeVisible();
    await expect(page.getByTestId("sanctum-hud")).toBeVisible(); // stage still mounted behind it

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("almanac-layer")).not.toBeVisible();
    await expect(page.getByTestId("rail")).toBeVisible();
  });

  test("#/status redirects into the developer tree (T12), not a bare route", async ({ page }) => {
    await mockSanctum(page);
    await page.goto("/#/status");
    await expect(page).toHaveURL(/#\/sanctum\?dev=status/);
    await expect(page.getByRole("heading", { name: "Status" })).toBeVisible();
  });
});

// T26 (plate 01 §C): the composed home body and the focus card's real priority rule, in a real
// browser against a bound roster.
test.describe("Sanctum home (T26)", () => {
  async function mockBoundRoster(page: Page, opts?: { contracts?: unknown[] }) {
    await mockSanctum(page);
    await page.route("**/api/unique/actors**", (route) =>
      fulfillJson(route, {
        playerId: 1,
        items: [
          { instanceId: "a1", playerId: 1, side: "plant", typeId: 3, phase: "Roster", level: 5, xp: 10, revision: 1 },
          { instanceId: "a2", playerId: 1, side: "zombie", typeId: 7, phase: "Roster", level: 9, xp: 10, revision: 1 }
        ]
      })
    );
    await page.route("**/api/contracts/**", (route) =>
      fulfillJson(route, {
        contracts: opts?.contracts ?? [],
        capacity: { used: 1, total: 4, purchasedSlots: 0, nextSlotPrice: 500, canBuy: true, maxSlots: 8 },
        dailyTribute: 1,
        deployFloor: 0,
        loyaltyMax: 1000
      })
    );
    await page.route("**/api/creatures/catalog", (route) => fulfillJson(route, { species: [] }));
    await page.route("**/api/creatures/*/codex", (route) => fulfillJson(route, { entries: [] }));
    await page.route("**/api/creatures/*/summon-state", (route) => fulfillJson(route, { pity: 0 }));
    await page.route("**/api/creatures/*", (route) =>
      fulfillJson(route, {
        playerId: 1,
        items: [{ profile: { instanceId: "d1", speciesId: "sp-imp", rarity: "epic", star: 1, elementPrimary: "fire", nickname: null }, actor: { level: 5 } }]
      })
    );
    await page.route("**/api/patron/**", (route) => fulfillJson(route, { patron: null, switchCostSouls: 100 }));
    await page.route("**/api/expeditions/*", (route) => fulfillJson(route, { serverUtc: new Date().toISOString(), tiers: [], items: [] }));
  }

  test("with nothing pending, the banner is the neutral run-prompt and the composed body renders real data", async ({ page }) => {
    await mockBoundRoster(page);
    await page.goto("/#/sanctum");

    await expect(page.getByTestId("focus-card-run-prompt")).toBeVisible();
    await expect(page.getByTestId("sanctum-home")).toBeVisible();
    await expect(page.getByTestId("sanctum-home-creature-strip").getByTestId("actor-chip")).toHaveCount(2);
    // The shipped copy, not "Pending". `SanctumHome.tsx:79` renders the literal
    // "Sectors held - not shown yet" and `SanctumStage.test.tsx:339` already asserts "not shown yet",
    // so the e2e was the only place still expecting the older word. Asserting the shipped string keeps
    // the two suites from drifting apart, and it is still a real assertion about an honest
    // not-yet-implemented state rather than a fabricated count.
    await expect(page.getByTestId("sanctum-home-sectors-held")).toContainText("not shown yet");
    await expect(page.getByTestId("sanctum-home-tonight-empty")).toBeVisible();
    await expect(page.getByTestId("sanctum-home-defend")).toBeVisible();

    // Checkpoint F.3 only scans the bare (no-actor) Sanctum — this is the first axe pass over the
    // populated home body (creature strip, map table, tonight, run prompt) T26 added.
    const results = await new AxeBuilder({ page }).include('[data-testid="sanctum-home"]').analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });

  // fe-essentials: AuditNav (the flat "AUDIT: Lawn/World/Roster/Creatures/Storage" leftover sidebar,
  // AppShell.tsx) is gone entirely — the plate's own design (00-foundation.html F.2, GG-40) never
  // had it, and its fixed 176px column was the direct cause of the mobile-viewport clipping this
  // program's visual pass found. Real replacements exist for two of its five links: SanctumHome's
  // own "Travel to the map"/"Defend the lawn" buttons — this proves they still really navigate.
  test("AuditNav is gone, and Travel to the map / Defend the lawn navigate for real", async ({ page }) => {
    await mockBoundRoster(page);
    await page.goto("/#/sanctum");
    await expect(page.getByTestId("sanctum-home")).toBeVisible();
    await expect(page.getByTestId("audit-nav")).toHaveCount(0);

    await page.getByTestId("sanctum-home-travel").click();
    await expect(page).toHaveURL(/#\/world/);

    await page.goBack();
    await expect(page.getByTestId("sanctum-home-defend")).toBeVisible();
    await page.getByTestId("sanctum-home-defend").click();
    await expect(page).toHaveURL(/#\/lawn/);
  });

  test("an overdue pact takes the banner, and its CTA opens the real Pacts layer", async ({ page }) => {
    await mockBoundRoster(page, {
      contracts: [{ instanceId: "d1", bound: true, deployable: false, loyalty: 10, rank: "insubordinate", personality: "cruel", upkeepPerDay: 1 }]
    });
    await page.goto("/#/sanctum");

    await expect(page.getByTestId("focus-card-tribute-overdue")).toBeVisible();
    await expect(page.getByTestId("focus-card-run-prompt")).not.toBeVisible();

    await page.getByTestId("focus-card-pay-tribute").click();
    await expect(page.getByTestId("pacts-layer")).toBeVisible();
  });

  test("a returned expedition takes the banner (below an overdue pact) and Tonight offers Collect", async ({ page }) => {
    await mockBoundRoster(page);
    await page.route("**/api/expeditions/*", (route) =>
      fulfillJson(route, {
        serverUtc: new Date().toISOString(),
        tiers: [{ tierId: "scout-30m", name: "Scout", durationMinutes: 60, tickCount: 2, battleCount: 2, squadSlots: 2, hasBossWave: false, tickMinutes: 30 }],
        items: [
          {
            id: 1,
            state: "Dispatched",
            tierId: "scout-30m",
            squadInstanceIds: ["d1"],
            dispatchedUtc: new Date(Date.now() - 120 * 60_000).toISOString(),
            dueUtc: new Date(Date.now() - 60 * 60_000).toISOString()
          }
        ]
      })
    );
    await page.goto("/#/sanctum");

    await expect(page.getByTestId("focus-card-expedition-returned")).toBeVisible();
    await expect(page.getByTestId("sanctum-home-tonight-expedition")).toContainText("1 expedition returned");

    await page.getByTestId("sanctum-home-tonight-collect").click();
    await expect(page.getByTestId("expeditions-layer")).toBeVisible();
  });
});

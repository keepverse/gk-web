import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page, type Route } from "@playwright/test";

/**
 * Checkpoint F — "every surface in this phase's scope exists." Each of its four criteria
 * (tasks/game-gui-todo.md) needed a real, automated check that didn't exist yet:
 *   1. Reachability matrix (GG-7): every Sanctum layer actually opens.
 *   2. Viewport sweep (GG-36): every layer at the three declared widths, no horizontal scroll.
 *   3. axe scan (GG-21/GG-30): every layer, zero violations.
 *   4. Old routes: all redirect, none 404. `/world` is a real destination route like `/lawn` or
 *      `/creatures`, not a redirect — it now reaches the world stage directly (world-stage routing
 *      work, 2026-09-05; the old `@xyflow/react`-based `WorldPage` it used to exempt is deleted).
 * This file is that check, not a per-task spec — it's Checkpoint F's own gate made durable.
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

const actors = {
  playerId: 1,
  items: [{ instanceId: "a1", playerId: 1, side: "plant", typeId: 3, phase: "Roster", level: 5, xp: 10, revision: 1 }]
};

const relics = {
  items: [
    {
      id: "relic.ashen_reliquary",
      name: "Ashen Reliquary",
      rarity: 4,
      slot: "weapon",
      description: "A reliquary warm to the touch. Channels raw offense.",
      effectId: "fx.passive_atk_flat"
    }
  ]
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

/** Every rail entry unlocked at once — the only way a single sweep can reach all seven layers. */
async function mockEverythingUnlocked(page: Page) {
  await page.route("**/hub/rpg**", (route) => route.abort());
  await page.route("**/health", (route) => fulfillJson(route, health));
  await page.route("**/api/players", (route) => fulfillJson(route, players));
  await page.route("**/api/players/current", (route) => fulfillJson(route, { ok: true }));
  await page.route("**/api/sim", (route) => fulfillJson(route, null, 404));
  await page.route("**/api/unique/actors**", (route) => {
    if (route.request().url().includes("/equipment")) {
      return fulfillJson(route, { instanceId: "a1", phase: "Roster", items: [], modsJson: "{}" });
    }
    return fulfillJson(route, actors);
  });
  await page.route("**/api/relics", (route) => fulfillJson(route, relics));
  await page.route("**/api/runs", (route) => fulfillJson(route, { items: [{ id: 1, startedUtc: "2026-01-01T00:00:00Z" }] }));
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
          profile: { instanceId: "d1", speciesId: "sp-imp", rarity: "epic", star: 1, elementPrimary: "fire", nickname: null },
          actor: { level: 5 }
        }
      ]
    })
  );
  await page.route("**/api/patron/**", (route) => fulfillJson(route, { patron: null, switchCostSouls: 100 }));
  await page.route("**/api/expeditions/*/materials", (route) => fulfillJson(route, { items: [] }));
  await page.route("**/api/expeditions/*", (route) => fulfillJson(route, { serverUtc: "2026-01-01T12:00:00Z", tiers: [], items: [] }));
  await page.route("**/api/fusion/*/recipes", (route) => fulfillJson(route, { items: [] }));
  await page.route("**/api/types**", (route) => fulfillJson(route, { items: [] }));
  await page.route("**/api/recipes**", (route) => fulfillJson(route, { items: [] }));
  await page.route("**/api/metrics/**", (route) => fulfillJson(route, { items: [] }));
  await page.route("**/api/rpg-progression/**", (route) => fulfillJson(route, { items: [] }));
  await page.route("**/api/pvz-stats/**", (route) => fulfillJson(route, { items: [] }));
}

const LAYERS = [
  { id: "creatures", rail: "rail-creatures", layer: "creatures-layer", key: "c" },
  { id: "relics", rail: "rail-relics", layer: "relics-layer", key: "r" },
  { id: "fusion", rail: "rail-fusion", layer: "fusion-layer", key: "f" },
  { id: "expeditions", rail: "rail-expeditions", layer: "expeditions-layer", key: "e" },
  { id: "pacts", rail: "rail-pacts", layer: "pacts-layer", key: "p" },
  { id: "almanac", rail: "rail-almanac", layer: "almanac-layer", key: "a" },
  { id: "chronicle", rail: "rail-chronicle", layer: "chronicle-layer", key: "h" }
] as const;

const DECLARED_VIEWPORTS = [
  { name: "1280x720-floor", width: 1280, height: 720 },
  { name: "1440x900-reference", width: 1440, height: 900 },
  { name: "1920x1080-headroom", width: 1920, height: 1080 }
] as const;

test.describe("Checkpoint F.1 — reachability matrix (GG-7)", () => {
  for (const l of LAYERS) {
    test(`${l.id} opens from Sanctum via its rail entry and its key, and Esc closes it`, async ({ page }) => {
      await mockEverythingUnlocked(page);
      await page.goto("/#/sanctum");
      await expect(page.getByTestId("sanctum-hud")).toBeVisible();
      await expect(page.getByTestId(l.rail)).not.toBeDisabled();

      await page.getByTestId(l.rail).click();
      await expect(page.getByTestId(l.layer)).toBeVisible();
      await expect(page.getByTestId("sanctum-hud")).toBeVisible(); // GG-1/GG-11: the stage survives
      await page.keyboard.press("Escape");
      await expect(page.getByTestId(l.layer)).not.toBeVisible();

      await page.keyboard.press(l.key);
      await expect(page.getByTestId(l.layer)).toBeVisible();
    });
  }
});

test.describe("Checkpoint F.2 — viewport sweep (GG-36: 1280x720 floor, 1440x900 reference, 1920x1080 headroom)", () => {
  for (const vp of DECLARED_VIEWPORTS) {
    test(`the Sanctum stage itself has no horizontal scroll at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await mockEverythingUnlocked(page);
      await page.goto("/#/sanctum");
      await expect(page.getByTestId("sanctum-hud")).toBeVisible();

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(overflow).toBe(false);
    });

    for (const l of LAYERS) {
      test(`${l.id} has no horizontal scroll at ${vp.name}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await mockEverythingUnlocked(page);
        await page.goto("/#/sanctum");
        await page.getByTestId(l.rail).click();
        await expect(page.getByTestId(l.layer)).toBeVisible();

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
        expect(overflow).toBe(false);
      });
    }
  }
});

test.describe("Checkpoint F.3 — axe scan per layer (GG-21/GG-30)", () => {
  test("the bare Sanctum stage has zero axe violations", async ({ page }) => {
    await mockEverythingUnlocked(page);
    await page.goto("/#/sanctum");
    await expect(page.getByTestId("sanctum-hud")).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });

  for (const l of LAYERS) {
    test(`${l.id} layer has zero axe violations`, async ({ page }) => {
      await mockEverythingUnlocked(page);
      await page.goto("/#/sanctum");
      await page.getByTestId(l.rail).click();
      await expect(page.getByTestId(l.layer)).toBeVisible();

      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
    });
  }
});

test.describe("Checkpoint F.4 — every old route redirects; none 404", () => {
  const OLD_ROUTES: string[] = [
    "status",
    "stats",
    "pvz-activity",
    "icon-dump",
    "almanac-dump",
    "cheats",
    "sim",
    "log",
    "runs",
    "pvz-stats",
    "rpg-progression",
    "types",
    "recipes",
    "metrics",
    "roster",
    "expeditions",
    "fusion",
    "pacts"
  ];

  for (const route of OLD_ROUTES) {
    test(`/${route} redirects with a 200, not a 404`, async ({ page }) => {
      await mockEverythingUnlocked(page);
      const response = await page.goto(`/#/${route}`);
      expect(response?.ok()).toBe(true);
      await expect(page).not.toHaveURL(new RegExp(`#/${route}$`));
      await expect(page.getByTestId("sanctum-hud")).toBeVisible();
    });
  }

  test("/world reaches the world stage, not the legacy page", async ({ page }) => {
    await mockEverythingUnlocked(page);
    const response = await page.goto("/#/world");
    expect(response?.ok()).toBe(true);
    await expect(page).toHaveURL(/#\/world$/);

    // The real stage, not merely "didn't 404" — Phaser host is visible (not legacy SVG camera).
    await expect(page.getByTestId("world-game-host")).toBeVisible();

    // The legacy `WorldPage`'s own markers never render — it is deleted, not merely unreached.
    await expect(page.getByTestId("chunk-fallback-world")).not.toBeVisible();
    await expect(page.getByTestId("world-canvas")).toHaveCount(0);
  });
});

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

/** A single actor's own content taller than any real roster row would realistically be — GG-61 is
 * about one dense entity, not many entities (that's GG-50) — but a `PanelShell` doesn't know or
 * care which one it's holding, so a large, uniform list through the same real component proves the
 * same shell-height guarantee GG-61 asks for without inventing a bespoke fixture shape. Kept below
 * CreaturesLayer's own `RENDER_ALL_MAX` threshold (GG-50/T27, 24 — was 50 before T27's three-tier
 * volume model) on purpose: above it the list becomes its own fixed-height virtualized scroll region,
 * which would test the virtualizer's box instead of `PanelShell`'s — a different guarantee, already
 * covered by e2e/volume-fixtures.spec.ts. */
function manyActors(count: number) {
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

async function mockSanctum(page: Page) {
  await page.route("**/hub/rpg**", (route) => route.abort());
  await page.route("**/health", (route) => fulfillJson(route, health));
  await page.route("**/api/players", (route) => fulfillJson(route, players));
  await page.route("**/api/players/current", (route) => fulfillJson(route, { ok: true }));
  await page.route("**/api/sim", (route) => fulfillJson(route, null, 404));
  await page.route("**/api/unique/actors**", (route) => fulfillJson(route, manyActors(20)));
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

// tech-stack.md/GG-36: 720 CSS px is the declared height floor; PanelShell's own bound is
// min(720px, 82vh) — at any of the three declared widths that translates to 720px exactly, since
// 82vh only bites below ~878px tall, and none of GG-36's three heights (720/900/1080) are that
// short except the floor itself, where 82vh = 590px < 720px, so the *effective* ceiling at the
// floor viewport is 590px, not 720. Both bounds are checked directly against the real box.
const BAND_HEIGHT_PX = 720;

test.describe("Shell height (GG-61 — a dense entity scrolls inside its own shell)", () => {
  test("a PanelShell full of many rows never grows past its band bound, and its own body scrolls", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockSanctum(page);
    await page.goto("/#/sanctum");
    await page.getByTestId("rail-creatures").click();

    const shell = page.getByTestId("creatures-layer");
    await expect(shell).toBeVisible();
    // 20 rows renders — proves the dense fixture actually landed, not an empty/error state.
    await expect(page.getByTestId("creatures-row-a0")).toBeVisible();
    await expect(page.getByTestId("creatures-row-a19")).toHaveCount(1);

    const shellBox = await shell.boundingBox();
    expect(shellBox).not.toBeNull();
    const viewportHeight = 900;
    const effectiveBound = Math.min(BAND_HEIGHT_PX, viewportHeight * 0.82);
    expect(shellBox!.height).toBeLessThanOrEqual(effectiveBound + 1); // +1: subpixel rounding

    const bodyOverflow = await page.evaluate(() => {
      const body = document.querySelector('[data-testid="creatures-layer-body"]');
      if (!body) return null;
      return { scrollHeight: body.scrollHeight, clientHeight: body.clientHeight };
    });
    expect(bodyOverflow).not.toBeNull();
    expect(bodyOverflow!.scrollHeight).toBeGreaterThan(bodyOverflow!.clientHeight);
  });

  test("the same bound holds at the GG-36 floor viewport (1280x720)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await mockSanctum(page);
    await page.goto("/#/sanctum");
    await page.getByTestId("rail-creatures").click();

    const shell = page.getByTestId("creatures-layer");
    await expect(shell).toBeVisible();

    const shellBox = await shell.boundingBox();
    const effectiveBound = Math.min(BAND_HEIGHT_PX, 720 * 0.82); // = 590.4px at this floor height
    expect(shellBox!.height).toBeLessThanOrEqual(effectiveBound + 1);

    const overflowing = await page.evaluate(() => {
      const body = document.querySelector('[data-testid="creatures-layer-body"]');
      return body ? body.scrollHeight > body.clientHeight : null;
    });
    expect(overflowing).toBe(true);
  });

  test("the stage behind never scrolls to compensate for a dense shell", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await mockSanctum(page);
    await page.goto("/#/sanctum");
    await page.getByTestId("rail-creatures").click();
    await expect(page.getByTestId("creatures-layer")).toBeVisible();

    const documentOverflow = await page.evaluate(
      () => document.documentElement.scrollHeight > document.documentElement.clientHeight
    );
    expect(documentOverflow).toBe(false);
  });
});

/**
 * world-stage e2e — Phaser dual-plane host + React inspector/HUD (gaps G14 / D20).
 * No SVG sector cards (`world-scene-sector-*`, `sector-node-*`, viewBox). Pin picks use
 * `__fusionRpgWorldProbe.pinScreen` + mouse only — never emitSelect / pickAt emit.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test, expect, type Page, type Route } from "@playwright/test";

const fixture = JSON.parse(
  readFileSync(fileURLToPath(new URL("../src/stages/world/fixtures/first-light.json", import.meta.url)), "utf8")
);

const twoHearths = JSON.parse(
  readFileSync(fileURLToPath(new URL("../src/stages/world/fixtures/two-hearths.json", import.meta.url)), "utf8")
);

const health = {
  ok: true,
  injectorConnected: false,
  lastHeartbeatUtc: null,
  source: "none",
  simEnabled: true,
  ingestQueued: 0,
  lastFlushMs: 0,
  currentPlayerId: 1
};
const players = { items: [{ id: 1, name: "Default", createdUtc: "2026-01-01T00:00:00Z" }], currentPlayerId: 1 };
const header = {
  worldId: "first-light",
  templateId: "first-light",
  currentTurn: 0,
  state: "active",
  createdUtc: "2026-01-01T00:00:00Z",
  revision: 0
};

async function fulfillJson(route: Route, body: unknown) {
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
}

/** Preview builds gate the probe on `__PLAYWRIGHT` (DEV is false under `vite preview`). */
async function enableWorldProbe(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __PLAYWRIGHT?: boolean }).__PLAYWRIGHT = true;
  });
}

async function mockWorld(page: Page) {
  await page.route("**/hub/rpg**", (route) => route.abort());
  await page.route("**/health", (route) => fulfillJson(route, health));
  await page.route("**/api/players", (route) => fulfillJson(route, players));
  await page.route("**/api/players/current", (route) => fulfillJson(route, { ok: true }));
  await page.route("**/api/sim", (route) => route.fulfill({ status: 404 }));
  await page.route("**/api/world/1", (route) => fulfillJson(route, header));
  await page.route("**/api/world/first-light/state**", (route) => fulfillJson(route, fixture));
}

/** `two-hearths` with one Scouted + one Rumored sector for inspector intel / stale-fog checks. */
function twoHeartsWorldState() {
  const state = JSON.parse(JSON.stringify(twoHearths)) as typeof twoHearths;
  for (const sector of state.sectors) {
    if (sector.sectorId === "d-flank-2") {
      sector.intel = "Scouted";
      sector.intelAge = 4;
    }
    if (sector.sectorId === "d-outpost") {
      sector.intel = "Rumored";
      sector.intelAge = 8;
    }
  }
  return state;
}

/** Maximal sector density for inspector scroll / dock bound (W57). */
function maximalWorldState() {
  const state = JSON.parse(JSON.stringify(twoHearths)) as typeof twoHearths;
  const sector = state.sectors.find((s: { sectorId: string }) => s.sectorId === "d-flank-2")!;
  sector.wardenBindingId = "e-dave-warden-1";
  sector.slots = [
    { slotIndex: 0, slotTypeId: "seat", element: null, state: "Claimed", ownerFactionId: "dave", guardWaveId: null, guardState: "Cleared", structureId: "well", constructionTurnsRemaining: null },
    { slotIndex: 1, slotTypeId: "wildland", element: null, state: "Claimed", ownerFactionId: "dave", guardWaveId: null, guardState: "Cleared", structureId: "waystation", constructionTurnsRemaining: 2 },
    { slotIndex: 2, slotTypeId: "essence-deposit", element: "Earth", state: "Intact", ownerFactionId: null, guardWaveId: "e-guard-1", guardState: "Intact", structureId: null, constructionTurnsRemaining: null },
    { slotIndex: 3, slotTypeId: "shard-vein", element: null, state: "Claimed", ownerFactionId: "dave", guardWaveId: null, guardState: "Cleared", structureId: null, constructionTurnsRemaining: null },
    { slotIndex: 4, slotTypeId: "material-seam", element: null, state: "Depleted", ownerFactionId: "dave", guardWaveId: null, guardState: "Cleared", structureId: null, constructionTurnsRemaining: null },
    { slotIndex: 5, slotTypeId: "lair", element: null, state: "Ruined", ownerFactionId: null, guardWaveId: null, guardState: "Cleared", structureId: null, constructionTurnsRemaining: null },
    { slotIndex: 6, slotTypeId: "vault", element: null, state: "Claimed", ownerFactionId: "dave", guardWaveId: null, guardState: "Cleared", structureId: null, constructionTurnsRemaining: null },
    { slotIndex: 7, slotTypeId: "spire", element: null, state: "Intact", ownerFactionId: null, guardWaveId: null, guardState: "Cleared", structureId: null, constructionTurnsRemaining: null }
  ];
  sector.forces = [
    { entityId: "e-dave-legion-1", ownerFactionId: "dave", kind: "Legion", exact: true, strength: 240 },
    { entityId: "e-dave-legion-2", ownerFactionId: "dave", kind: "Legion", exact: true, strength: 90 },
    { entityId: "e-wild-pack-1", ownerFactionId: "wild", kind: "Warband", exact: false, bandName: "a warband", bandCeiling: 200 },
    { entityId: "e-guard-1", ownerFactionId: "wild", kind: "Guard", exact: false, bandName: "a guard force", bandCeiling: 50 }
  ];
  return state;
}

async function mockMaximal(page: Page) {
  const twoHeartsHeader = { ...header, worldId: "two-hearths", templateId: "two-hearths" };
  await page.route("**/hub/rpg**", (route) => route.abort());
  await page.route("**/health", (route) => fulfillJson(route, health));
  await page.route("**/api/players", (route) => fulfillJson(route, players));
  await page.route("**/api/players/current", (route) => fulfillJson(route, { ok: true }));
  await page.route("**/api/sim", (route) => route.fulfill({ status: 404 }));
  await page.route("**/api/world/1", (route) => fulfillJson(route, twoHeartsHeader));
  await page.route("**/api/world/two-hearths/state**", (route) => fulfillJson(route, maximalWorldState()));
}

async function mockTwoHearths(page: Page) {
  const twoHeartsHeader = { ...header, worldId: "two-hearths", templateId: "two-hearths" };
  await page.route("**/hub/rpg**", (route) => route.abort());
  await page.route("**/health", (route) => fulfillJson(route, health));
  await page.route("**/api/players", (route) => fulfillJson(route, players));
  await page.route("**/api/players/current", (route) => fulfillJson(route, { ok: true }));
  await page.route("**/api/sim", (route) => route.fulfill({ status: 404 }));
  await page.route("**/api/world/1", (route) => fulfillJson(route, twoHeartsHeader));
  await page.route("**/api/world/two-hearths/state**", (route) => fulfillJson(route, twoHeartsWorldState()));
}

/** `z-outpost` isolated by severing its only lane — for the unreachable-march refusal path. */
function severedTwoHeartsWorldState() {
  const state = twoHeartsWorldState();
  const lane = state.lanes.find((l: { laneId: string }) => l.laneId === "l-zf2-zo");
  lane.state = "Severed";
  return state;
}

async function mockSeveredTwoHearths(page: Page) {
  const twoHeartsHeader = { ...header, worldId: "two-hearths", templateId: "two-hearths" };
  await page.route("**/hub/rpg**", (route) => route.abort());
  await page.route("**/health", (route) => fulfillJson(route, health));
  await page.route("**/api/players", (route) => fulfillJson(route, players));
  await page.route("**/api/players/current", (route) => fulfillJson(route, { ok: true }));
  await page.route("**/api/sim", (route) => route.fulfill({ status: 404 }));
  await page.route("**/api/world/1", (route) => fulfillJson(route, twoHeartsHeader));
  await page.route("**/api/world/two-hearths/state**", (route) => fulfillJson(route, severedTwoHeartsWorldState()));
}

async function gotoWorld(page: Page, mock: (page: Page) => Promise<void> = mockWorld) {
  await enableWorldProbe(page);
  await mock(page);
  await page.goto("/#/world-stage");
  await expect(page.getByTestId("world-game-host")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(
    () => {
      const w = window as unknown as { __fusionRpgWorldProbe?: { pinCount: () => number } };
      return (w.__fusionRpgWorldProbe?.pinCount?.() ?? 0) > 0;
    },
    { timeout: 30_000 }
  );
}

/** Mouse-only pin pick via probe screen coords. Does not assert selection (reselect / march targets). */
async function mouseClickPin(page: Page, sectorId: string) {
  const canvas = page.locator("canvas").first();
  await expect(canvas).toBeVisible();
  await page.evaluate((id) => {
    const w = window as unknown as {
      __fusionRpgWorldProbe?: { centreOn?: (s: string) => boolean };
    };
    w.__fusionRpgWorldProbe?.centreOn?.(id);
  }, sectorId);
  await page.waitForTimeout(150);
  const box = await canvas.boundingBox();
  expect(box).toBeTruthy();
  const pt = await page.evaluate((id) => {
    const w = window as unknown as {
      __fusionRpgWorldProbe?: { pinScreen: (s: string) => { x: number; y: number } | null };
    };
    return w.__fusionRpgWorldProbe?.pinScreen(id) ?? null;
  }, sectorId);
  expect(pt, `pinScreen(${sectorId})`).toBeTruthy();
  expect(pt!.x).toBeGreaterThan(0);
  expect(pt!.y).toBeGreaterThan(0);
  expect(pt!.x).toBeLessThan(box!.width);
  expect(pt!.y).toBeLessThan(box!.height);

  // Honest pick: mouse only — no probe emitSelect / pickAt fallback (gaps D21).
  await page.mouse.click(box!.x + pt!.x, box!.y + pt!.y);
}

async function clickPin(page: Page, sectorId: string) {
  // Fit so authored pins sit in the visible canvas before mouse pick.
  await page.getByTestId("world-map-fit").click();
  await page.waitForTimeout(250);
  await mouseClickPin(page, sectorId);
  await expect(page.getByTestId("world-game-host")).toHaveAttribute("data-selected-sector", sectorId, {
    timeout: 8_000
  });
}

async function clearSelectionByContextMenu(page: Page) {
  const canvas = page.locator("canvas").first();
  const box = await canvas.boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.click(box!.x + box!.width * 0.55, box!.y + box!.height * 0.45, { button: "right" });
  await expect(page.getByTestId("world-game-host")).toHaveAttribute("data-selected-sector", "", {
    timeout: 5_000
  });
}

test.describe("Phaser host loads and pins are pickable", () => {
  test("loads world-stage with Phaser host, HUD, rail — not SVG sector cards", async ({ page }) => {
    await gotoWorld(page);

    await expect(page.getByTestId("world-game-host")).toBeVisible();
    await expect(page.getByTestId("world-game-canvas")).toBeAttached();
    await expect(page.getByTestId("world-hud")).toBeVisible();
    await expect(page.getByTestId("rail")).toBeVisible();
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 15_000 });

    await expect(page.getByTestId("world-stage-svg")).toHaveCount(0);
    await expect(page.getByTestId("sector-node-homeworld")).toHaveCount(0);
    await expect(page.getByTestId("world-scene-sector-homeworld")).toHaveCount(0);

    const pinCount = await page.evaluate(() => {
      const w = window as unknown as { __fusionRpgWorldProbe?: { pinCount: () => number } };
      return w.__fusionRpgWorldProbe?.pinCount() ?? 0;
    });
    expect(pinCount).toBe(fixture.sectors.length);
  });

  test("clicking a pin selects it and opens the inspector", async ({ page }) => {
    await gotoWorld(page);
    await page.setViewportSize({ width: 1280, height: 720 });

    await clickPin(page, "homeworld");
    const inspector = page.getByTestId("sector-inspector");
    await expect(inspector).toBeVisible({ timeout: 10_000 });
    await expect(inspector).toContainText("homeworld");
    await expect(page.getByTestId("world-game-host")).toHaveAttribute("data-selected-sector", "homeworld");
  });

  test("unexplored ground opens as Unknown in the inspector (no named card)", async ({ page }) => {
    await gotoWorld(page);
    await page.setViewportSize({ width: 1280, height: 720 });

    await clickPin(page, "black-gate");
    const headerEl = page.getByTestId("identity-header");
    await expect(headerEl).toBeVisible();
    await expect(headerEl).toHaveAttribute("data-intel", "Unknown");
    await expect(headerEl).toContainText("unexplored");
    await expect(headerEl).not.toContainText("Black Gate");
  });

  test("clicking the same pin again deselects it (world-stage W65)", async ({ page }) => {
    await gotoWorld(page);
    await page.setViewportSize({ width: 1280, height: 720 });

    // Prefer a pin clear of the left dock footprint (same rationale as the old ash-waste pick).
    await clickPin(page, "ash-waste");
    await expect(page.getByTestId("sector-inspector")).toBeVisible();

    // Second click toggles off — use raw mouse (clickPin would require selected-sector still set).
    await mouseClickPin(page, "ash-waste");
    await expect(page.getByTestId("world-game-host")).toHaveAttribute("data-selected-sector", "", {
      timeout: 5_000
    });
    await expect(page.getByTestId("sector-inspector")).toHaveCount(0);
  });

  test("closing the inspector deselects; right-click empty map also clears", async ({ page }) => {
    await gotoWorld(page);
    await page.setViewportSize({ width: 1280, height: 720 });

    await clickPin(page, "homeworld");
    const inspector = page.getByTestId("sector-inspector");
    await expect(inspector).toBeVisible();

    await page.getByTestId("sector-inspector-close").click();
    await expect(inspector).not.toBeVisible();
    await expect(page.getByTestId("world-game-host")).toHaveAttribute("data-selected-sector", "");

    await clickPin(page, "homeworld");
    await expect(page.getByTestId("sector-inspector")).toBeVisible();
    await clearSelectionByContextMenu(page);
    await expect(page.getByTestId("sector-inspector")).toHaveCount(0);
  });

  test("Esc closes the inspector; the Phaser host survives (world-stage W65 / GG-11)", async ({ page }) => {
    await gotoWorld(page);
    await page.setViewportSize({ width: 1280, height: 720 });

    const host = page.getByTestId("world-game-host");
    await expect(host).toBeVisible();

    await clickPin(page, "homeworld");
    await expect(page.getByTestId("sector-inspector")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("sector-inspector")).not.toBeVisible();
    await expect(host).toBeVisible();
  });
});

/**
 * Stale-fog legibility (W50) — map fog stamps lived on SVG SectorNode; on Phaser the readable
 * surface for age wording is the inspector identity row (and ground facts stay visible under wash).
 */
test.describe("stale intel via inspector on two-hearths (world-stage W50)", () => {
  test("Scouted and Rumored sectors keep static facts and age wording in the inspector", async ({ page }) => {
    await gotoWorld(page, mockTwoHearths);
    await page.setViewportSize({ width: 1280, height: 720 });

    await clickPin(page, "d-flank-2");
    const scoutedHeader = page.getByTestId("identity-header");
    await expect(scoutedHeader).toHaveAttribute("data-intel", "Scouted");
    await expect(page.getByTestId("identity-intel-row")).toContainText("scouted — 4 nights old");
    await expect(page.getByTestId("ground-block")).toHaveAttribute("data-intel", "Scouted");
    await expect(page.getByTestId("ground-block")).toBeVisible();

    await clearSelectionByContextMenu(page);

    await clickPin(page, "d-outpost");
    await expect(page.getByTestId("identity-header")).toHaveAttribute("data-intel", "Rumored");
    await expect(page.getByTestId("identity-intel-row")).toContainText("rumoured — 8 nights old");
    await expect(page.getByTestId("ground-block")).toHaveAttribute("data-intel", "Rumored");
  });
});

/**
 * GG-61 / W57 — maximal inspector density; body scrolls, document does not.
 */
for (const [width, height] of [
  [1280, 720],
  [1440, 900]
] as const) {
  test(`a maximal sector's inspector stays inside its own bound at ${width}x${height} (world-stage W57)`, async ({
    page
  }) => {
    await page.setViewportSize({ width, height });
    await gotoWorld(page, mockMaximal);

    await clickPin(page, "d-flank-2");
    const inspector = page.getByTestId("sector-inspector");
    await expect(inspector).toBeVisible();
    await expect(inspector).toContainText("e-dave-warden-1");
    await expect(inspector).toContainText("240");
    await expect(page.getByTestId("force-row-e-guard-1")).toBeVisible();

    const inspectorBox = await inspector.boundingBox();
    expect(inspectorBox).not.toBeNull();
    expect(inspectorBox!.height).toBeLessThanOrEqual(height + 1);

    const bodyOverflow = await page.evaluate(() => {
      const body = document.querySelector('[data-testid="sector-inspector-body"]');
      return body ? { scrollHeight: body.scrollHeight, clientHeight: body.clientHeight } : null;
    });
    expect(bodyOverflow).not.toBeNull();
    expect(bodyOverflow!.scrollHeight).toBeGreaterThan(bodyOverflow!.clientHeight);

    const documentOverflow = await page.evaluate(
      () => document.documentElement.scrollHeight > document.documentElement.clientHeight
    );
    expect(documentOverflow).toBe(false);
  });
}

test("the same maximal sector holds its bound at 200% text scale (world-stage W57)", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await gotoWorld(page, mockMaximal);
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });

  await clickPin(page, "d-flank-2");
  const inspector = page.getByTestId("sector-inspector");
  await expect(inspector).toBeVisible();

  const inspectorBox = await inspector.boundingBox();
  expect(inspectorBox!.height).toBeLessThanOrEqual(721);

  const bodyOverflow = await page.evaluate(() => {
    const body = document.querySelector('[data-testid="sector-inspector-body"]');
    return body ? { scrollHeight: body.scrollHeight, clientHeight: body.clientHeight } : null;
  });
  expect(bodyOverflow!.scrollHeight).toBeGreaterThan(bodyOverflow!.clientHeight);

  const documentOverflow = await page.evaluate(
    () => document.documentElement.scrollHeight > document.documentElement.clientHeight
  );
  expect(documentOverflow).toBe(false);
});

for (const [width, height] of [
  [1280, 720],
  [1440, 900]
] as const) {
  test(`the stage route never grows the document past the viewport at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await gotoWorld(page);

    await expect(page.getByTestId("world-game-host")).toBeVisible();

    const { scrollHeight, viewportHeight, hasHorizontalOverflow } = await page.evaluate(() => {
      const doc = document.scrollingElement ?? document.documentElement;
      return {
        scrollHeight: doc.scrollHeight,
        viewportHeight: window.innerHeight,
        hasHorizontalOverflow: doc.scrollWidth > doc.clientWidth
      };
    });

    expect(scrollHeight).toBe(viewportHeight);
    expect(hasHorizontalOverflow).toBe(false);
  });
}

/**
 * Queued-order path (W71) — force pick via Outliner (React), destination via honest pin mouse.
 * SVG legion-marker / range-ring / destination-flag / lane-queued DOM is retired.
 */
test.describe("the queued order — filed via outliner + pin (world-stage W71)", () => {
  test("select a force, file a march, see it queue, then take it back", async ({ page }) => {
    await gotoWorld(page);
    await page.setViewportSize({ width: 1280, height: 720 });

    await page.getByTestId("outliner-row-e-dave-legion-1").click();
    await expect(page.getByTestId("queued-orders-empty")).toBeVisible();

    // Destination pin — files the march (does not select the sector while a force is selected).
    await mouseClickPin(page, "ember-hollow");

    const commandId = "t0-move-e-dave-legion-1";
    await expect(page.getByTestId("queued-orders")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId(`queued-order-${commandId}`)).toBeVisible();
    await expect(page.getByTestId(`queued-order-label-${commandId}`)).toContainText("Ember Hollow");

    // Host must not have treated the destination as a sector selection while targeting.
    await expect(page.getByTestId("world-game-host")).toHaveAttribute("data-selected-sector", "");

    await page.getByTestId(`queued-order-take-back-${commandId}`).click();
    await expect(page.getByTestId("queued-orders-empty")).toBeVisible();
  });

  test("an unreachable destination queues nothing", async ({ page }) => {
    await gotoWorld(page, mockSeveredTwoHearths);
    await page.setViewportSize({ width: 1280, height: 720 });

    await page.getByTestId("outliner-row-e-dave-legion-1").click();
    await mouseClickPin(page, "z-outpost");

    // BlockedTarget was an SVG overlay; refusal still must not enqueue.
    await expect(page.getByTestId("queued-orders-empty")).toBeVisible();
    await expect(page.getByTestId("queued-order-t0-move-e-dave-legion-1")).toHaveCount(0);
  });
});

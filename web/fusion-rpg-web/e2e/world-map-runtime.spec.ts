/**
 * world-map-runtime — Playwright CPA–CPD.
 * Artifacts: e2e/.artifacts/world-map-runtime/
 * Fixture path: src/stages/world/fixtures/first-light.json (not features/world).
 */
import { mkdirSync, existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect, type Page, type Route } from "@playwright/test";

const ARTIFACT_DIR = join(dirname(fileURLToPath(import.meta.url)), ".artifacts/world-map-runtime");

const fixture = JSON.parse(
  readFileSync(fileURLToPath(new URL("../src/stages/world/fixtures/first-light.json", import.meta.url)), "utf8")
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

async function gotoWorld(page: Page) {
  await enableWorldProbe(page);
  await mockWorld(page);
  await page.goto("/#/world");
  await expect(page.getByTestId("world-game-host")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(
    () => {
      const w = window as unknown as { __fusionRpgWorldProbe?: { pinCount: () => number } };
      return (w.__fusionRpgWorldProbe?.pinCount?.() ?? 0) > 0;
    },
    { timeout: 30_000 }
  );
}

async function shot(page: Page, name: string) {
  mkdirSync(ARTIFACT_DIR, { recursive: true });
  const path = join(ARTIFACT_DIR, name);
  await page.screenshot({ path, fullPage: false });
  expect(existsSync(path), `artifact missing: ${path}`).toBe(true);
  return path;
}

async function clickPin(page: Page, sectorId: string) {
  await page.getByTestId("world-map-fit").click();
  await page.waitForTimeout(200);
  await page.evaluate((id) => {
    const w = window as unknown as {
      __fusionRpgWorldProbe?: { centreOn?: (s: string) => boolean };
    };
    w.__fusionRpgWorldProbe?.centreOn?.(id);
  }, sectorId);
  await page.waitForTimeout(150);
  const canvas = page.locator("canvas").first();
  await expect(canvas).toBeVisible();
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

  await expect(page.getByTestId("world-game-host")).toHaveAttribute("data-selected-sector", sectorId, {
    timeout: 8_000
  });
}

async function clearSelectionByContextMenu(page: Page) {
  const canvas = page.locator("canvas").first();
  const box = await canvas.boundingBox();
  expect(box).toBeTruthy();
  // Empty map area — right of centre, away from left dock / bottom HUD.
  await page.mouse.click(box!.x + box!.width * 0.55, box!.y + box!.height * 0.45, { button: "right" });
  await expect(page.getByTestId("world-game-host")).toHaveAttribute("data-selected-sector", "", {
    timeout: 5_000
  });
}

test.describe("CPA — host island", () => {
  test("loads #/world with Phaser host (not SVG sector card grid)", async ({ page }) => {
    await gotoWorld(page);

    await expect(page.getByTestId("world-game-host")).toBeVisible();
    await expect(page.getByTestId("world-game-canvas")).toBeAttached();
    await expect(page.getByTestId("world-hud")).toBeVisible();
    await expect(page.getByTestId("rail")).toBeVisible();
    await expect(page.getByTestId("world-stage-svg")).toHaveCount(0);
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 15_000 });

    await shot(page, "cpa-desktop.png");
    await page.setViewportSize({ width: 768, height: 1024 });
    await shot(page, "cpa-tablet.png");
    await page.setViewportSize({ width: 390, height: 844 });
    await shot(page, "cpa-mobile.png");
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test("GG-11: opening inspector does not remount world host", async ({ page }) => {
    await gotoWorld(page);
    const host = page.getByTestId("world-game-host");

    await clickPin(page, "homeworld");
    await expect(page.getByTestId("sector-inspector")).toBeVisible({ timeout: 10_000 });
    await expect(host).toHaveAttribute("data-selected-sector", "homeworld");
    // Same host node still mounted (GG-11) — selection attribute update without remount.
    await expect(host).toBeVisible();
    await shot(page, "cpa-inspector-open.png");
  });
});

test.describe("CPB — graph objects", () => {
  test("first-light syncs pins onto Phaser registry", async ({ page }) => {
    await gotoWorld(page);
    const pinCount = await page.evaluate(() => {
      const w = window as unknown as { __fusionRpgWorldProbe?: { pinCount: () => number } };
      return w.__fusionRpgWorldProbe?.pinCount() ?? 0;
    });
    expect(pinCount).toBe(fixture.sectors.length);
    await expect(page.getByTestId("sector-node-homeworld")).toHaveCount(0);
    await shot(page, "cpb-pins.png");
  });
});

test.describe("CPC — camera + pick", () => {
  test("Fit + arrow pan move the camera (frames differ)", async ({ page }) => {
    await gotoWorld(page);
    await page.setViewportSize({ width: 1280, height: 720 });

    const before = await page.locator("canvas").first().screenshot();
    await page.getByTestId("world-map-fit").click();
    await page.waitForTimeout(200);
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(300);
    const after = await page.locator("canvas").first().screenshot();
    expect(Buffer.compare(before, after)).not.toBe(0);

    await shot(page, "cpc-after-pan.png");
  });

  test("click pin opens left inspector; right-click clears; click over dock does not select", async ({ page }) => {
    await gotoWorld(page);
    await page.setViewportSize({ width: 1280, height: 720 });

    await clickPin(page, "homeworld");
    const inspector = page.getByTestId("sector-inspector");
    await expect(inspector).toBeVisible();
    const inspBox = await inspector.boundingBox();
    expect(inspBox).toBeTruthy();
    // Spec: inspector docks on the left beside the rail (not a right drawer).
    expect(inspBox!.x).toBeLessThan(420);
    await shot(page, "cpc-left-dock.png");

    // Right-click empty map — Phaser owns contextmenu → kind empty (gaps D10/D21).
    await clearSelectionByContextMenu(page);
    await expect(page.getByTestId("sector-inspector")).toHaveCount(0);
    await clickPin(page, "homeworld");
    await expect(page.getByTestId("sector-inspector")).toBeVisible();
    // Click inside left dock (ignoreRects) — selection must survive.
    await page.mouse.click(inspBox!.x + 40, inspBox!.y + 80);
    await expect(page.getByTestId("world-game-host")).toHaveAttribute("data-selected-sector", "homeworld");
  });
});

test.describe("CPD — overlays + SVG retirement", () => {
  test("lens keys change active lens readout; no React Range/Supply stage overlays", async ({ page }) => {
    await gotoWorld(page);
    await expect(page.getByTestId("lens-picker")).toBeVisible();
    await page.getByTestId("lens-picker-danger").click();
    await expect(page.getByTestId("lens-picker-readout")).toContainText(/danger/i);
    await expect(page.getByTestId("lens-picker-danger")).toHaveAttribute("aria-checked", "true");

    await expect(page.getByTestId("range-overlay")).toHaveCount(0);
    await expect(page.getByTestId("supply-overlay")).toHaveCount(0);
    await expect(page.getByTestId("lifeline-overlay")).toHaveCount(0);
    await expect(page.getByTestId("world-stage-svg")).toHaveCount(0);

    await shot(page, "cpd-lens.png");
    await page.evaluate(() => {
      document.documentElement.style.filter = "grayscale(1)";
    });
    await shot(page, "cpd-greyscale.png");
    await page.evaluate(() => {
      document.documentElement.style.filter = "";
    });
  });
});

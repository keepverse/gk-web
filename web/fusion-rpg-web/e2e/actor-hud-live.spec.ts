import { test, expect } from "@playwright/test";
import { expectCanvasHud, selectOccupant } from "./helpers/actor-hud-e2e";
import { isLiveActorHudE2e } from "./helpers/live-gate";
import { setupLiveActorHudBoard, waitForApiHealth } from "./helpers/live-debug-api";

const liveEnabled = isLiveActorHudE2e();

test.describe("Actor HUD program E2E (live injector)", () => {
  test.describe.configure({ mode: "serial" });

  test.skip(!liveEnabled, "requires live-chromium project or ACTOR_HUD_LIVE_E2E=1");

  let targetPtr = "";
  let row = 0;
  let col = 0;

  test.beforeAll(async () => {
    if (!liveEnabled) return;
    const board = await setupLiveActorHudBoard();
    targetPtr = board.targetPtr;
    row = board.row;
    col = board.col;
  });

  test("Inspector and Phaser canvas show shield + statuses from real board-stats", async ({ page }) => {
    await page.goto("/#/lawn?devmode=1");
    await waitForApiHealth();
    await expect(page.getByTestId("panel-lawn-inspector")).toBeVisible({ timeout: 30_000 });

    await expect(page.getByTestId("lawn-occupant-list")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("lawn-occupant-list")).toContainText(`${row},${col}`, {
      timeout: 30_000
    });

    await selectOccupant(page, row, col);
    await expect(page.getByTestId("lawn-occupant-sel")).toContainText(targetPtr, { ignoreCase: true });

    await expect(page.getByTestId("actor-hud-shield")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("actor-hud-status-expose")).toBeVisible();
    await expect(page.getByTestId("actor-hud-status-command")).toBeVisible();

    await expect(page.getByTestId("lawn-game-host")).toBeVisible();
    await expectCanvasHud(page, targetPtr, {
      identity: true,
      shield: true,
      status0: true,
      status1: true,
      chipRow: false
    });
  });

  /**
   * AUDIT-2 over REAL Unity events, not a fixture.
   *
   * The measurement window starts at the first event that CARRIES an element, not at board entry.
   * That is the recorded caution from the Unity live lane: a real Peashooter's first two HUD
   * events carried `elements: null`, so a window that starts at the board and expects a glyph is
   * reading an ABSENCE as a PRESENCE and would report a third false red. The gate is therefore
   * `hasElements → expectCanvasHud(element0)`, and the pre-wait's failure message names the real
   * cause instead of "the glyph is broken".
   *
   * `hasElements` itself is a wait with a bounded budget, not a single sample: a still-quiet board
   * emits `elements: null` for a while, and that is the data being absent, not a defect.
   */
  test("element glyph draws from a real injector event that carries elements", async ({ page }) => {
    await page.goto("/#/lawn?devmode=1");
    await waitForApiHealth();
    await expect(page.getByTestId("lawn-game-host")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("lawn-occupant-list")).toBeVisible({ timeout: 30_000 });

    const withElements = await page
      .waitForFunction(
        () => (window.__fusionRpgLawnHudElements?.() ?? []).some((e) => e.element != null),
        undefined,
        { timeout: 60_000 }
      )
      .then(() => true)
      .catch(() => false);

    expect(
      withElements,
      "no on-canvas occupant's snapshot carried an element within 60s — the data is absent, so " +
        "the glyph cannot be asserted (do NOT read this as a broken glyph)"
    ).toBe(true);

    const ptrs = await page.evaluate(() =>
      [
        ...new Set(
          (window.__fusionRpgLawnHudElements?.() ?? [])
            .filter((e) => e.element != null)
            .map((e) => e.ptr)
        )
      ]
    );
    expect(ptrs.length, "expected at least one on-canvas ptr whose snapshot carried an element").toBeGreaterThan(
      0
    );

    for (const ptr of ptrs) {
      await expectCanvasHud(page, ptr, { element0: true });
    }
  });
});

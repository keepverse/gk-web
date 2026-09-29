import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";
import {
  appendActorHudClear,
  appendActorHudPatch,
  appendBoardWithHud,
  appendLogEvents,
  expectCanvasHud,
  mockActorSurfaceCatalog,
  selectOccupant
} from "./helpers/actor-hud-e2e";
import { mockShell } from "./helpers/mock-shell";

const __dirname = dirname(fileURLToPath(import.meta.url));
const loadFixture = (name: string) =>
  JSON.parse(readFileSync(join(__dirname, "fixtures", name), "utf8"));

const goldenActorHud = loadFixture("actor-hud-golden.json");
const overflowActorHud = loadFixture("actor-hud-overflow.json");
const zeroShieldActorHud = loadFixture("actor-hud-zero-shield.json");

async function appendLegacyChipBoard(page: import("@playwright/test").Page) {
  await appendLogEvents(page, [
    {
      t: new Date().toISOString(),
      game: "pvzrh-e2e",
      kind: "board.start",
      matchKey: "e2e-legacy-chips",
      payload: { levelName: "e2e" }
    },
    {
      t: new Date().toISOString(),
      game: "pvzrh-e2e",
      kind: "debug.board-stats",
      matchKey: "e2e-legacy-chips",
      payload: {
        plants: [],
        zombies: [{ ptr: "Z2", typeId: 0, row: 2, col: 5, hp: 180, maxHp: 180 }]
      }
    },
    {
      t: new Date().toISOString(),
      game: "pvzrh-e2e",
      kind: "debug.status.applied",
      matchKey: "e2e-legacy-chips",
      payload: { ptr: "Z2", status: "butter" }
    }
  ]);
}

test.describe("Actor HUD program E2E (mocked)", () => {
  test.beforeEach(async ({ page }) => {
    await mockShell(page);
    await page.goto("/#/lawn?devmode=1");
    await expect(page.getByTestId("panel-lawn-inspector")).toBeVisible();
  });

  test("golden board-stats: Inspector and canvas match fixture", async ({ page }) => {
    await appendBoardWithHud(page, {
      matchKey: "e2e-golden",
      ptr: "Z1",
      row: 1,
      col: 5,
      actorHud: goldenActorHud
    });

    await selectOccupant(page, 1, 5);

    await expect(page.getByTestId("actor-hud-tier")).toBeVisible();
    await expect(page.getByTestId("actor-hud-level")).toHaveText("12");
    await expect(page.getByTestId("actor-hud-element-fire")).toBeVisible();
    await expect(page.getByTestId("actor-hud-element-ice")).toBeVisible();
    await expect(page.getByTestId("actor-hud-shield")).toBeVisible();
    await expect(page.getByTestId("actor-hud-shield")).toContainText("50/80");
    await expect(page.getByTestId("actor-hud-status-command")).toBeVisible();
    await expect(page.getByTestId("actor-hud-status-expose")).toBeVisible();

    await expect(page.getByTestId("lawn-game-host")).toBeVisible();
    await expectCanvasHud(page, "Z1", {
      identity: true,
      shield: true,
      status0: true,
      status1: true,
      chipRow: false
    });
  });

  test("debug.actor-hud patch populates Inspector and canvas after bare board-stats", async ({ page }) => {
    await appendBoardWithHud(page, {
      matchKey: "e2e-patch",
      ptr: "Z3",
      row: 3,
      col: 4,
      hp: 150,
      maxHp: 150
    });
    await selectOccupant(page, 3, 4);
    await expect(page.getByTestId("actor-hud-inspector")).not.toBeVisible();

    await appendActorHudPatch(page, {
      matchKey: "e2e-patch",
      ptr: "Z3",
      actorHud: goldenActorHud
    });

    await expect(page.getByTestId("actor-hud-shield")).toBeVisible();
    await expect(page.getByTestId("actor-hud-status-command")).toBeVisible();
    await expectCanvasHud(page, "Z3", {
      identity: true,
      shield: true,
      status0: true,
      status1: true,
      chipRow: false
    });
  });

  test("overflow fixture shows +N in Inspector and hudOverflow on canvas", async ({ page }) => {
    await appendBoardWithHud(page, {
      matchKey: "e2e-overflow",
      ptr: "Z4",
      row: 4,
      col: 3,
      actorHud: overflowActorHud
    });

    await selectOccupant(page, 4, 3);
    await expect(page.getByTestId("actor-hud-tier").locator("[data-tier]")).toHaveAttribute(
      "data-tier",
      "elite"
    );
    await expect(page.getByTestId("actor-hud-overflow")).toBeVisible();
    await expect(page.getByTestId("actor-hud-overflow")).toContainText("+2");
    await expectCanvasHud(page, "Z4", {
      identity: true,
      shield: true,
      status0: true,
      status1: true,
      status2: true,
      overflow: true,
      chipRow: false
    });
  });

  test("shield hp=0 hides shield row in Inspector and canvas", async ({ page }) => {
    await appendBoardWithHud(page, {
      matchKey: "e2e-zero-shield",
      ptr: "Z5",
      row: 5,
      col: 2,
      actorHud: zeroShieldActorHud
    });

    await selectOccupant(page, 5, 2);
    await expect(page.getByTestId("actor-hud-status-command")).toBeVisible();
    await expect(page.getByTestId("actor-hud-shield")).not.toBeVisible();
    await expectCanvasHud(page, "Z5", {
      identity: true,
      shield: false,
      status0: true,
      chipRow: false
    });
  });

  test("debug.actor-hud null patch clears Inspector and canvas hud", async ({ page }) => {
    await appendBoardWithHud(page, {
      matchKey: "e2e-clear",
      ptr: "Z6",
      row: 0,
      col: 6,
      actorHud: goldenActorHud
    });
    await selectOccupant(page, 0, 6);
    await expect(page.getByTestId("actor-hud-inspector")).toBeVisible();
    await expectCanvasHud(page, "Z6", {
      identity: true,
      shield: true,
      status0: true,
      status1: true,
      chipRow: false
    });

    await appendActorHudClear(page, { matchKey: "e2e-clear", ptr: "Z6" });
    await expect(page.getByTestId("actor-hud-inspector")).not.toBeVisible();
    await expectCanvasHud(page, "Z6", {
      identity: false,
      shield: false,
      status0: false,
      status1: false,
      chipRow: false
    });
  });

  test("legacy statusChips render chipRow when actorHud absent", async ({ page }) => {
    await appendLegacyChipBoard(page);
    await expect(page.getByTestId("lawn-occupant-list")).toContainText("2,5");

    await page.waitForFunction(() => window.__fusionRpgHasHudChild?.("Z2", "chipRow") === true);
    expect(await page.evaluate(() => window.__fusionRpgHasHudChild?.("Z2", "hudStack") ?? false)).toBe(
      false
    );
  });
});

/**
 * AUDIT-2 — the element glyph arrives with the loader, not with the next board-stats.
 *
 * The falsifiable property is the ONE-EVENT constraint, and it is the whole test. `expectCanvasHud`
 * waits (a texture arriving is asynchronous, so sampling once was a false red on a good build), but
 * waiting proves nothing on its own: with the pre-fix draw site, a spec that kept sending
 * board-stats would go green while the spectator canvas still showed no glyph — the measured
 * `false, false, true, true`. So nothing is sent after the first `debug.board-stats`, and any green
 * here can only come from the loader's own completion repainting the row.
 */
test.describe("Actor HUD element glyph — loader arrival (AUDIT-2)", () => {
  test.beforeEach(async ({ page }) => {
    await mockShell(page);
    // Without `hudPresentation` every element slot measures zero, so the glyph is skipped for a
    // reason that has nothing to do with loading and this test would pass vacuously.
    await mockActorSurfaceCatalog(page);
    await page.goto("/#/lawn?devmode=1");
    await expect(page.getByTestId("panel-lawn-inspector")).toBeVisible();
  });

  test("both glyphs draw from ONE board-stats, with no second HUD event", async ({ page }) => {
    await appendBoardWithHud(page, {
      matchKey: "e2e-audit2",
      ptr: "Z9",
      row: 2,
      col: 4,
      actorHud: goldenActorHud
    });

    // Exactly one board-stats and one board.start were sent. Nothing else, ever.
    await expectCanvasHud(page, "Z9", {
      identity: true,
      element0: true,
      element1: true,
      shield: true,
      status0: true,
      chipRow: false
    });

    // The glyphs are images bound to the catalog's own art, not coloured rectangles standing in.
    const bound = await page.evaluate(() => {
      const has = window.__fusionRpgHasHudChild;
      return { e0: has?.("Z9", "hudElement0") ?? false, e1: has?.("Z9", "hudElement1") ?? false };
    });
    expect(bound).toEqual({ e0: true, e1: true });
  });

  test("the glyph is still there after unrelated model revisions, and is not re-requested", async ({
    page
  }) => {
    const glyphRequests: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/actor-hud-elements/")) glyphRequests.push(req.url());
    });

    await appendBoardWithHud(page, {
      matchKey: "e2e-audit2-rev",
      ptr: "Z8",
      row: 4,
      col: 2,
      actorHud: goldenActorHud
    });
    await expectCanvasHud(page, "Z8", { element0: true, element1: true });

    // A later snapshot on the same ptr re-runs the draw; the textures are already resident, so it
    // must reuse them rather than re-fetch. This is the loop a naive deferral would have created.
    await appendActorHudPatch(page, {
      matchKey: "e2e-audit2-rev",
      ptr: "Z8",
      actorHud: { ...goldenActorHud, identity: { ...goldenActorHud.identity, levelBand: 13 } }
    });
    await expectCanvasHud(page, "Z8", { element0: true, element1: true });

    expect(glyphRequests).toHaveLength(2);
  });
});

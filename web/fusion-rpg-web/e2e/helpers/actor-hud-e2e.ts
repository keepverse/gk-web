import { expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { normalizePtr } from "./live-debug-api-core";

export type CanvasHudExpect = {
  identity?: boolean;
  element0?: boolean;
  element1?: boolean;
  shield?: boolean;
  status0?: boolean;
  status1?: boolean;
  status2?: boolean;
  overflow?: boolean;
  chipRow?: boolean;
};

/**
 * The canvas child name for each `CanvasHudExpect` key.
 *
 * `element0` / `element1` are the Band B identity-row glyphs (`hudElement0` / `hudElement1` in
 * `ActorHudDisplay.ts`). They are the one slot whose presence depends on an ASYNC texture load, so
 * asserting them is the AUDIT-2 gate — see `expectCanvasHud`'s own note on waiting.
 */
const CANVAS_CHILD_BY_KEY: Record<string, string> = {
  chipRow: "chipRow",
  identity: "hudIdentity",
  element0: "hudElement0",
  element1: "hudElement1",
  shield: "hudShield",
  overflow: "hudOverflow",
  status0: "hudStatus0",
  status1: "hudStatus1",
  status2: "hudStatus2"
};

/**
 * Serve the shipped `GET /api/catalogs/actor-surface` shape from the committed tuning.
 *
 * Two fields matter to a canvas glyph and neither is in the offline fixture:
 * `hudPresentation` (the element slot's pixel geometry — absent from the fixture, so every slot
 * measures zero and the glyph is skipped for a reason unrelated to loading) and the element rows'
 * `hudGlyph` (which is what turns an element id into a texture URL).
 *
 * Both are read from the committed tuning rather than written as literals here, mirroring
 * `ActorSurfaceCatalogHub.BuildDto` (`gk-core/src/FusionRpg.Core/ActorSurface/ActorSurfaceCatalogHub.cs:196-199`),
 * so the spec pins no pixel number and no glyph name. If the tuning moves, the spec follows it.
 *
 * Narrow by design: only a spec that asserts a canvas element glyph calls this, so the specs that
 * assert the fixture-fallback path keep asserting it.
 */
export async function mockActorSurfaceCatalog(page: Page): Promise<void> {
  const repoRoot = join(import.meta.dirname, "..", "..", "..", "..");
  const hud = JSON.parse(readFileSync(join(repoRoot, "data/tuning/actor-hud.v7.json"), "utf8")) as {
    screenIdentityElementPrimaryPixels: number;
    screenIdentityElementSecondaryPixels: number;
    screenIdentityElementGapPixels: number;
  };
  const elements = (
    JSON.parse(readFileSync(join(repoRoot, "data/tuning/element-catalog.v2.json"), "utf8")) as {
      entries: { id: string; displayName: string; ordinal: number; color: string; presentationOnly: boolean; hudGlyph?: string | null }[];
      version: string;
    }
  ).entries;

  const body = {
    tabs: [],
    defaultOpen: "condition",
    aptitudes: [],
    families: [],
    resources: [],
    elements,
    statuses: [],
    kitRoles: [],
    hudPresentation: {
      identityElementPrimaryPixels: hud.screenIdentityElementPrimaryPixels,
      identityElementSecondaryPixels: hud.screenIdentityElementSecondaryPixels,
      identityElementGapPixels: hud.screenIdentityElementGapPixels
    },
    versionStamp: "e2e-mock.actor-surface"
  };

  await page.route("**/api/catalogs/actor-surface", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) })
  );
}

export async function appendLogEvents(page: Page, events: unknown[]) {
  await page.evaluate((batch) => {
    const append = window.__fusionRpgAppendLogEvent;
    if (!append) return;
    for (const ev of batch) append(ev);
  }, events);
}

export async function appendBoardWithHud(
  page: Page,
  opts: {
    matchKey: string;
    ptr: string;
    row: number;
    col: number;
    actorHud?: unknown;
    hp?: number;
    maxHp?: number;
  }
) {
  const { matchKey, ptr, row, col, actorHud, hp = 200, maxHp = 200 } = opts;
  const zombie: Record<string, unknown> = { ptr, typeId: 0, row, col, hp, maxHp };
  if (actorHud !== undefined) zombie.actorHud = actorHud;

  await appendLogEvents(page, [
    {
      t: new Date().toISOString(),
      game: "pvzrh-e2e",
      kind: "board.start",
      matchKey,
      payload: { levelName: "e2e" }
    },
    {
      t: new Date().toISOString(),
      game: "pvzrh-e2e",
      kind: "debug.board-stats",
      matchKey,
      payload: { plants: [], zombies: [zombie] }
    }
  ]);
}

export async function appendActorHudPatch(
  page: Page,
  opts: { matchKey: string; ptr: string; actorHud: unknown }
) {
  await appendLogEvents(page, [
    {
      t: new Date().toISOString(),
      game: "pvzrh-e2e",
      kind: "debug.actor-hud",
      matchKey: opts.matchKey,
      payload: { ptr: opts.ptr, actorHud: opts.actorHud }
    }
  ]);
}

export async function appendActorHudClear(
  page: Page,
  opts: { matchKey: string; ptr: string }
) {
  await appendActorHudPatch(page, { ...opts, actorHud: null });
}

export async function selectOccupant(page: Page, row: number, col: number) {
  const label = `${row},${col}`;
  await expect(page.getByTestId("lawn-occupant-list")).toContainText(label);
  await page.getByTestId("lawn-occupant-list").getByText(label, { exact: true }).click();
  await expect(page.getByTestId("lawn-occupant-sel")).toBeVisible();
}

/**
 * Wait for the canvas HUD children to reach `expected`, then assert them.
 *
 * The `waitForFunction` is a BOUNDED PATIENCE, not the assertion's substance. It exists because a
 * texture arriving is asynchronous by nature, and sampling once would be a false red on a correct
 * build (AUDIT-2). What makes these assertions falsifiable is the opposite property, asserted in
 * `actor-hud.spec.ts`: the caller must send exactly ONE HUD event, so a green result cannot be
 * explained by a later snapshot re-running the draw. A patient wait alone proves nothing — a spec
 * that keeps sending board-stats would stay green with the race still present.
 */
export async function expectCanvasHud(page: Page, ptr: string, expected: CanvasHudExpect) {
  const ptrKey = normalizePtr(ptr);
  await page.waitForFunction(
    ([p, exp, childByKey]) => {
      const has = window.__fusionRpgHasHudChild;
      if (!has) return false;
      for (const [name, want] of Object.entries(exp as Record<string, boolean | undefined>)) {
        if (want === undefined) continue;
        const child = (childByKey as Record<string, string>)[name];
        if (!child) continue;
        if (has(p as string, child) !== want) return false;
      }
      return true;
    },
    [ptrKey, expected, CANVAS_CHILD_BY_KEY] as const
  );

  const snapshot = await page.evaluate((p) => {
    const has = window.__fusionRpgHasHudChild;
    const read = (child: string) => has?.(p, child) ?? false;
    return {
      identity: read("hudIdentity"),
      element0: read("hudElement0"),
      element1: read("hudElement1"),
      shield: read("hudShield"),
      status0: read("hudStatus0"),
      status1: read("hudStatus1"),
      status2: read("hudStatus2"),
      overflow: read("hudOverflow"),
      chipRow: read("chipRow")
    };
  }, ptrKey);

  for (const [key, want] of Object.entries(expected)) {
    if (want === undefined) continue;
    expect(snapshot[key as keyof typeof snapshot], key).toBe(want);
  }
}

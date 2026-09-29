import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActorHudSnapshot, LawnViewModel, Occupant } from "@/features/lawn/lawnViewModel";

// The engine plane imports Phaser for `Loader.Events.COMPLETE` only; the real engine cannot boot in
// jsdom. Same shim shape as `syncOccupantBandB.test.ts` in this directory.
vi.mock("phaser", () => ({
  default: {
    Geom: { Rectangle: { Contains: () => false } },
    Loader: { Events: { COMPLETE: "complete", FILE_LOAD_ERROR: "fileloaderror" } }
  }
}));

import { setHudDisplay } from "./ActorHudDisplay";
import { bustLawnIconTextures, refreshOccupantArt, type SyncContext } from "./SyncFromModelSystem";
import { PtrEntityRegistry } from "../entities/PtrEntityRegistry";
import { noteIconLoadFailure } from "@/features/lawn/lawnSyncGate";
import { actorSurfaceFixture, type ActorSurfaceCatalog } from "@/lib/actorSurfaceCatalog";

const __dirname = dirname(fileURLToPath(import.meta.url));
const goldenActorHud = JSON.parse(
  readFileSync(join(__dirname, "../../../e2e/fixtures/actor-hud-golden.json"), "utf8")
) as ActorHudSnapshot;

/**
 * AUDIT-2: the element glyph was requested on the first board-stats and then read as absent on the
 * same call, so the draw site skipped it — and nothing re-ran the draw, because `syncFromModel`
 * only runs when the model revision moves. A glyph therefore appeared only from the third
 * board-stats onward, which made any single-event assertion a false red on a correct build.
 *
 * The property under test is NOT "the glyph is eventually visible". It is that the glyph arrives
 * with NO further HUD event, from the loader's own completion. A patient assertion cannot prove
 * that, and neither can a second board-stats — so this file drives the real repaint path
 * (`refreshOccupantArt`) and counts loader requests, and both halves are asserted.
 */

// ---------------------------------------------------------------- mock scene

type MockGo = {
  name: string;
  x: number;
  y: number;
  width?: number;
  texture?: string;
  destroyed: boolean;
  destroy: () => void;
  setName: (n: string) => MockGo;
  setStrokeStyle: () => MockGo;
  setOrigin: () => MockGo;
  setScrollFactor?: () => MockGo;
  setDisplaySize?: () => MockGo;
  getByName?: (n: string) => MockGo | null;
  add?: (child: MockGo) => MockGo;
  list?: MockGo[];
};

function makeContainer(x = 0, y = 0): MockGo {
  const kids: MockGo[] = [];
  const container: MockGo = {
    name: "",
    x,
    y,
    destroyed: false,
    destroy() {
      container.destroyed = true;
      container.name = "__destroyed__";
      for (const kid of kids) kid.destroyed = true;
    },
    setName(n: string) {
      container.name = n;
      return container;
    },
    setStrokeStyle: () => container,
    setOrigin: () => container,
    setScrollFactor: () => container,
    setDisplaySize: () => container,
    getByName(n: string) {
      if (container.destroyed) return null;
      if (container.name === n) return container;
      for (const child of kids) {
        if (child.destroyed) continue;
        if (child.name === n) return child;
        const nested = child.getByName?.(n);
        if (nested && !nested.destroyed) return nested;
      }
      return null;
    },
    add(child: MockGo) {
      kids.push(child);
      return container;
    },
    list: kids
  };
  return container;
}

function leaf(x: number, y: number): MockGo {
  const go: MockGo = {
    name: "",
    x,
    y,
    destroyed: false,
    destroy() {
      go.destroyed = true;
    },
    setName(n: string) {
      go.name = n;
      return go;
    },
    setStrokeStyle: () => go,
    setOrigin: () => go,
    setScrollFactor: () => go,
    setDisplaySize: () => go
  };
  return go;
}

type LoaderRequest = { key: string; url: string };

function makeScene() {
  const present = new Set<string>();
  const requests: LoaderRequest[] = [];
  let loading = false;
  const completeHandlers: (() => void)[] = [];
  const errorHandlers: ((file: { key?: string }) => void)[] = [];

  const image = (x: number, y: number, texture: string) => {
    const go = leaf(x, y);
    go.texture = texture;
    return go;
  };

  const scene = {
    add: {
      container: (x?: number, y?: number) => makeContainer(x ?? 0, y ?? 0),
      rectangle: (x: number, y: number, w: number) => {
        const go = leaf(x, y);
        go.width = w;
        return go;
      },
      text: (x: number, y: number) => leaf(x, y),
      circle: (x: number, y: number) => leaf(x, y),
      image
    },
    textures: {
      exists: (key: string) => present.has(key),
      getTextureKeys: () => [...present],
      remove: (key: string) => {
        present.delete(key);
      }
    },
    load: {
      image: (key: string, url: string) => {
        requests.push({ key, url });
      },
      once: (event: string, cb: () => void) => {
        if (event === "complete") completeHandlers.push(cb);
      },
      on: (event: string, cb: (file: { key?: string }) => void) => {
        if (event === "fileloaderror") errorHandlers.push(cb);
      },
      off: () => {},
      isLoading: () => loading,
      start: () => {
        loading = true;
      }
    }
  };

  return {
    scene,
    requests,
    /** The loader delivered every queued file and reported COMPLETE, as Phaser does. */
    complete() {
      for (const { key } of requests) present.add(key);
      loading = false;
      const handlers = completeHandlers.splice(0, completeHandlers.length);
      for (const cb of handlers) cb();
    },
    /** A FILE_LOAD_ERROR for `key`, as `wireLawnIconLoadErrors` observes it. */
    fail(key: string) {
      const st = scene as unknown as {
        _iconLoads?: Set<string>;
        _iconFails?: Set<string>;
      };
      if (!st._iconLoads) st._iconLoads = new Set();
      if (!st._iconFails) st._iconFails = new Set();
      noteIconLoadFailure(st._iconLoads, st._iconFails, key);
      loading = false;
      for (const cb of errorHandlers.slice()) cb({ key });
    },
    glyphRequests: () => requests.filter((r) => r.key.startsWith("actor-hud-element-"))
  };
}

// ---------------------------------------------------------------- fixtures

function occupant(hud: ActorHudSnapshot | undefined): Occupant {
  return {
    ptr: "Z1",
    side: "zombie",
    typeId: 0,
    row: 1,
    col: 5,
    hp: 200,
    maxHp: 200,
    statusChips: [],
    flags: {},
    hud
  };
}

function modelWith(occ: Occupant): LawnViewModel {
  return {
    phase: "playing",
    revision: 1,
    rows: 9,
    cols: 12,
    cells: new Map([["1,5", [occ]]]),
    orphans: [],
    tiles: new Map(),
    mowers: new Map(),
    pets: new Map(),
    hand: [],
    travelBuffs: []
  } as unknown as LawnViewModel;
}

/** A SyncContext whose art-ready closure is the scene's own repaint path. */
function ctxFor(scene: unknown, registry: PtrEntityRegistry, model: LawnViewModel): SyncContext {
  return {
    scene: scene as never,
    registry,
    lastApplied: 0,
    onIconsReady: () => refreshOccupantArt(ctxFor(scene, registry, model), model)
  };
}

let savedCatalog: ActorSurfaceCatalog | undefined;

beforeEach(() => {
  savedCatalog = window.__fusionRpgActorSurface;
  // The offline fixture carries no `hudPresentation`, so it sizes every element slot at zero and
  // the glyph is skipped for a reason that has nothing to do with loading. Supplying the field is
  // what the shipped `GET /api/catalogs/actor-surface` route now provides, so this isolates the
  // race instead of re-testing the catalog's absence.
  window.__fusionRpgActorSurface = {
    ...actorSurfaceFixture(),
    hudPresentation: {
      identityElementPrimaryPixels: 36,
      identityElementSecondaryPixels: 30,
      identityElementGapPixels: 4.5
    }
  };
});

afterEach(() => {
  if (savedCatalog) window.__fusionRpgActorSurface = savedCatalog;
});

// ---------------------------------------------------------------- the tests

describe("Band B element glyph — async texture arrival (AUDIT-2)", () => {
  it("draws the glyph on the FIRST snapshot, with no further HUD event", () => {
    const { scene, complete, glyphRequests } = makeScene();
    const registry = new PtrEntityRegistry();
    const occ = occupant(goldenActorHud);
    const model = modelWith(occ);
    const go = makeContainer();
    registry.set({
      ptr: occ.ptr,
      side: occ.side,
      typeId: occ.typeId,
      chips: [],
      selected: false,
      go: go as never
    });
    const ctx = ctxFor(scene, registry, model);

    // Exactly one board-stats. Nothing else is ever sent.
    setHudDisplay(scene as never, go as never, occ.hud, ctx.onIconsReady);

    // Both catalog glyphs are requested, from the fixture's fire/ice elements.
    expect(glyphRequests().map((r) => r.key)).toEqual([
      "actor-hud-element-fire",
      "actor-hud-element-ice"
    ]);
    // The slot is reserved and the row is built even though nothing can be drawn yet.
    expect(go.getByName?.("hudIdentity")).not.toBeNull();

    // The loader finishes. The repaint is driven by the loader's own COMPLETE, not by a new event.
    complete();

    expect(go.getByName?.("hudElement0")?.texture).toBe("actor-hud-element-fire");
    expect(go.getByName?.("hudElement1")?.texture).toBe("actor-hud-element-ice");
    // Repainted from the same closure into a rebuilt stack, so it is idempotent rather than
    // accumulating children: exactly one of each, inside the one live identity row.
    const row = go.getByName?.("hudIdentity");
    expect(row?.list?.filter((kid) => kid.name === "hudElement0")).toHaveLength(1);
    expect(row?.list?.filter((kid) => kid.name === "hudElement1")).toHaveLength(1);
  });

  it("repaints through refreshOccupantArt, so a HUD that never changes still gains its glyph", () => {
    const { scene, complete, requests } = makeScene();
    const registry = new PtrEntityRegistry();
    const occ = occupant(goldenActorHud);
    const model = modelWith(occ);
    const go = makeContainer();
    registry.set({
      ptr: occ.ptr,
      side: occ.side,
      typeId: occ.typeId,
      chips: [],
      selected: false,
      go: go as never
    });

    // The scene wires onIconsReady to refreshOccupantArt; the draw site armed that closure.
    setHudDisplay(scene as never, go as never, occ.hud, ctxFor(scene, registry, model).onIconsReady);
    expect(go.getByName?.("hudElement0")).toBeNull();

    complete();

    expect(go.getByName?.("hudElement0")?.texture).toBe("actor-hud-element-fire");
    // The repaint is the scene's own refresh entry point, not a private re-draw.
    expect(requests.filter((r) => r.key.startsWith("actor-hud-element-"))).toHaveLength(2);
  });

  it("does not re-request a glyph whose load failed, so a 404 cannot loop", () => {
    const { scene, complete, fail, glyphRequests } = makeScene();
    const occ = occupant(goldenActorHud);

    setHudDisplay(scene as never, makeContainer() as never, occ.hud, () => {});
    expect(glyphRequests()).toHaveLength(2);

    // The glyphs 404. Then the repaint runs anyway, because Phaser still reports COMPLETE.
    fail("actor-hud-element-fire");
    fail("actor-hud-element-ice");
    for (let i = 0; i < 5; i += 1) {
      setHudDisplay(scene as never, makeContainer() as never, occ.hud, () => {});
    }
    complete();

    expect(glyphRequests()).toHaveLength(2);
  });

  it("requests nothing for an element the catalog gives no glyph, and draws no empty slot", () => {
    const { scene, complete, glyphRequests } = makeScene();
    // `omni` is presentationOnly with no hudGlyph — a data decision, not a loading state.
    const omniHud: ActorHudSnapshot = {
      ...goldenActorHud,
      elements: { primary: "omni" }
    };
    const go = makeContainer();

    setHudDisplay(scene as never, go as never, omniHud, () => {});
    complete();

    expect(glyphRequests()).toEqual([]);
    expect(go.getByName?.("hudElement0")).toBeNull();
    // The rest of the identity row still draws, so "no glyph" is a skip and not a failure.
    expect(go.getByName?.("hudIdentity")).not.toBeNull();
  });

  it("reserves the element slot from catalog geometry, so filling it later cannot move the row", () => {
    const { scene, complete } = makeScene();
    const pending = makeContainer();
    const drawn = makeContainer();

    setHudDisplay(scene as never, pending as never, goldenActorHud, () => {});
    complete();
    setHudDisplay(scene as never, drawn as never, goldenActorHud, () => {});

    const before = pending.getByName?.("hudIdentity")?.list ?? [];
    const after = drawn.getByName?.("hudIdentity")?.list ?? [];
    const isGlyph = (kid: MockGo) => kid.name.startsWith("hudElement");

    // The row's centring comes from the catalog geometry, not from what could be drawn, so every
    // pre-existing item keeps the exact x it had while the glyph slot was still empty.
    expect(after.filter((kid) => !isGlyph(kid)).map((kid) => [kid.name, kid.x])).toEqual(
      before.filter((kid) => !isGlyph(kid)).map((kid) => [kid.name, kid.x])
    );
    // And the two glyphs land in the space that was already reserved for them, after the role
    // character — primary first, then secondary, at their catalog widths.
    const glyphs = after.filter(isGlyph);
    expect(glyphs.map((kid) => kid.x)).toEqual([10.75, 29.5]);
  });

  it("an icon-epoch bust forgets in-flight ICONS only, never a glyph still loading", () => {
    const { scene, requests } = makeScene();
    const st = scene as unknown as { _iconLoads?: Set<string>; _iconFails?: Set<string> };

    // One type icon and one glyph, both requested and neither delivered.
    st._iconLoads = new Set(["icon-zombie-0-0", "actor-hud-element-fire"]);
    st._iconFails = new Set(["icon-zombie-0-1"]);

    bustLawnIconTextures(scene as never);

    // The icon epoch embeds in the type-icon key, so those are genuinely stale. The glyph key does
    // not, and forgetting it mid-flight would make the next repaint re-request a key the loader is
    // already fetching.
    expect([...(st._iconLoads ?? [])]).toEqual(["actor-hud-element-fire"]);
    expect([...(st._iconFails ?? [])]).toEqual([]);
    expect(requests).toEqual([]);
  });
});

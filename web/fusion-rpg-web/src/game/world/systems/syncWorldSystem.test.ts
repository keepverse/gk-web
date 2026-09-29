import { describe, expect, it, vi } from "vitest";
import { WorldRegistry } from "../entities/WorldRegistry";
import { syncWorldSystem } from "./syncWorldSystem";
import { WORLD_THEME_FALLBACK } from "../snapshotTheme";

vi.mock("phaser", () => ({
  default: {
    Display: { Color: { HexStringToColor: () => ({ color: 0xffffff }) } },
    Geom: {
      Circle: Object.assign(
        function Circle(this: { x: number; y: number; radius: number }, x: number, y: number, radius: number) {
          this.x = x;
          this.y = y;
          this.radius = radius;
        },
        { Contains: () => true }
      )
    }
  }
}));

function fakeScene() {
  const objects: Array<{ destroy: () => void; setDepth?: (d: number) => void; setName?: (n: string) => void; setData?: () => void; setSize?: () => void; setInteractive?: () => void }> = [];
  const mk = () => {
    const data = new Map<string, unknown>();
    const o: Record<string, unknown> = {
      destroy: vi.fn(),
      setDepth: vi.fn(),
      setName: vi.fn(),
      setData: vi.fn((k: string, v: unknown) => {
        data.set(k, v);
        return o;
      }),
      getData: vi.fn((k: string) => data.get(k)),
      setSize: vi.fn(),
      setInteractive: vi.fn(),
      setOrigin: vi.fn(),
      setPosition: vi.fn(function (this: { x: number; y: number }, x: number, y: number) {
        this.x = x;
        this.y = y;
        return this;
      }),
      add: vi.fn(),
      active: true,
      // Graphics draw surface used by sectorPin / laneStroke / forceMarker
      clear: vi.fn(),
      fillStyle: vi.fn(),
      fillCircle: vi.fn(),
      fillRect: vi.fn(),
      fillPath: vi.fn(),
      lineStyle: vi.fn(),
      strokeCircle: vi.fn(),
      strokePath: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      arc: vi.fn()
    };
    // Chainable graphics API
    for (const key of ["fillStyle", "lineStyle", "beginPath", "moveTo", "lineTo", "closePath", "arc"] as const) {
      (o[key] as ReturnType<typeof vi.fn>).mockReturnValue(o);
    }
    objects.push(o as never);
    return o;
  };
  return {
    add: {
      container: vi.fn((x: number, y: number) => {
        const o = { ...mk(), add: vi.fn(), x, y };
        return o;
      }),
      graphics: vi.fn(mk),
      zone: vi.fn(mk),
      text: vi.fn(mk)
    },
    objects
  } as unknown as Phaser.Scene;
}

const emptyModel = {
  sectors: [],
  lanes: [],
  slotsBySectorId: {},
  forcesBySectorId: {}
};

describe("syncWorldSystem — modelSeq monotonic skip (RT-10)", () => {
  it("ignores modelSeq <= lastApplied unless forceLodRefresh", () => {
    const scene = fakeScene();
    const registry = new WorldRegistry();
    const base = {
      scene,
      theme: WORLD_THEME_FALLBACK,
      registry,
      model: emptyModel,
      tier: "map" as const
    };

    expect(syncWorldSystem({ ...base, lastApplied: 5, modelSeq: 5 })).toBeNull();
    expect(syncWorldSystem({ ...base, lastApplied: 5, modelSeq: 3 })).toBeNull();

    expect(syncWorldSystem({ ...base, lastApplied: 5, modelSeq: 6 })).toBe(6);
    expect(syncWorldSystem({ ...base, lastApplied: 6, modelSeq: 6 })).toBeNull();
  });

  it("forceLodRefresh applies at the same modelSeq for LOD tier changes", () => {
    const scene = fakeScene();
    const registry = new WorldRegistry();
    const applied = syncWorldSystem({
      scene,
      theme: WORLD_THEME_FALLBACK,
      registry,
      lastApplied: 4,
      modelSeq: 5,
      model: emptyModel,
      tier: "detail",
      forceLodRefresh: true
    });
    expect(applied).toBe(5);
  });
});

describe("syncWorldSystem — mid-lane legions (gaps D15)", () => {
  it("places a lane legion between sector centres, not on a sector pin", () => {
    const scene = fakeScene();
    const registry = new WorldRegistry();
    const model = {
      sectors: [
        {
          sectorId: "a",
          typeId: "wildland",
          climate: null,
          ownerFactionId: "dave",
          intel: "Watched",
          intelAge: 0,
          phase: "Held",
          dangerBand: { unit: "count", value: 0 },
          developmentLevel: { unit: "count", value: 0 },
          stability: { unit: "perMilleRatio", op: "flat", value: 1000 },
          pressure: { unit: "perMilleRatio", op: "flat", value: 0 },
          fractureIntensity: { unit: "perMilleRatio", op: "absolute", value: 1000 },
          habitable: true,
          layoutX: 0,
          layoutY: 0,
          loam: {
            production: { unit: "loamUnits", value: 0 },
            upkeep: { unit: "loamUnits", value: 0 },
            net: { unit: "loamUnits", value: 0 },
            stock: { unit: "loamUnits", value: 0 },
            capacity: { state: "pending", reason: "x" },
            upkeepBreakdown: {
              base: { unit: "loamUnits", value: 0 },
              garrison: { unit: "loamUnits", value: 0 },
              development: { unit: "loamUnits", value: 0 },
              danger: { unit: "loamUnits", value: 0 },
              intensityMilli: { unit: "perMilleRatio", op: "absolute", value: 1000 }
            }
          },
          component: {
            componentId: null,
            production: { unit: "loamUnits", value: 0 },
            upkeep: { unit: "loamUnits", value: 0 },
            net: { unit: "loamUnits", value: 0 },
            stock: { unit: "loamUnits", value: 0 }
          },
          willReleaseNextTurn: false,
          lifelineCost: { state: "pending", reason: "x" },
          lifeline: { state: "pending", reason: "x" },
          wardenBindingId: { state: "pending", reason: "x" },
          neglectedTurns: { state: "pending", reason: "x" }
        },
        {
          sectorId: "b",
          typeId: "wildland",
          climate: null,
          ownerFactionId: null,
          intel: "Watched",
          intelAge: 0,
          phase: "Held",
          dangerBand: { unit: "count", value: 0 },
          developmentLevel: { unit: "count", value: 0 },
          stability: { unit: "perMilleRatio", op: "flat", value: 1000 },
          pressure: { unit: "perMilleRatio", op: "flat", value: 0 },
          fractureIntensity: { unit: "perMilleRatio", op: "absolute", value: 1000 },
          habitable: true,
          layoutX: 2,
          layoutY: 0,
          loam: {
            production: { unit: "loamUnits", value: 0 },
            upkeep: { unit: "loamUnits", value: 0 },
            net: { unit: "loamUnits", value: 0 },
            stock: { unit: "loamUnits", value: 0 },
            capacity: { state: "pending", reason: "x" },
            upkeepBreakdown: {
              base: { unit: "loamUnits", value: 0 },
              garrison: { unit: "loamUnits", value: 0 },
              development: { unit: "loamUnits", value: 0 },
              danger: { unit: "loamUnits", value: 0 },
              intensityMilli: { unit: "perMilleRatio", op: "absolute", value: 1000 }
            }
          },
          component: {
            componentId: null,
            production: { unit: "loamUnits", value: 0 },
            upkeep: { unit: "loamUnits", value: 0 },
            net: { unit: "loamUnits", value: 0 },
            stock: { unit: "loamUnits", value: 0 }
          },
          willReleaseNextTurn: false,
          lifelineCost: { state: "pending", reason: "x" },
          lifeline: { state: "pending", reason: "x" },
          wardenBindingId: { state: "pending", reason: "x" },
          neglectedTurns: { state: "pending", reason: "x" }
        }
      ],
      lanes: [
        {
          laneId: "l-ab",
          fromSectorId: "a",
          toSectorId: "b",
          typeId: "corridor",
          length: { unit: "count", value: 1 },
          width: { unit: "count", value: 1000 },
          hazard: { unit: "perMilleRatio", op: "flat", value: 0 },
          wardLevel: { unit: "count", value: 0 },
          state: "Open",
          gateKeyId: { state: "pending", reason: "x" }
        }
      ],
      slotsBySectorId: {},
      forcesBySectorId: {
        a: [
          {
            entityId: "e-march",
            ownerFactionId: "dave",
            kind: "Legion",
            exact: true,
            strength: { unit: "gameUnits", value: 1 }
          }
        ]
      },
      playerFactionId: "dave",
      legions: [
        {
          entityId: "e-march",
          kind: "Legion",
          ownerFactionId: "dave",
          position: {
            kind: "lane",
            laneId: "l-ab",
            towardSectorId: "b",
            progress: { unit: "perMilleRatio", op: "flat", value: 500 }
          },
          stance: "march",
          movementRemaining: { unit: "perMilleRatio", op: "flat", value: 500 },
          routed: false,
          members: [],
          carriedLoam: { state: "pending", reason: "x" },
          capacity: { state: "pending", reason: "x" },
          burn: { state: "pending", reason: "x" },
          runway: { state: "pending", reason: "x" }
        }
      ]
    };

    syncWorldSystem({
      scene,
      theme: WORLD_THEME_FALLBACK,
      registry,
      lastApplied: 0,
      modelSeq: 1,
      model,
      tier: "map"
    });

    const force = registry.getForce("e-march") as {
      x: number;
      y: number;
      destroy: ReturnType<typeof vi.fn>;
      setPosition: ReturnType<typeof vi.fn>;
    };
    expect(force).toBeTruthy();
    // GRID centres: layoutX 0 → 110, layoutX 2 → 550; progress 500 → midpoint 330.
    expect(force.x).toBe(330);
    const destroyCalls = force.destroy.mock.calls.length;

    // Progress-only: move in place, do not recreate (followup F7).
    const advanced = {
      ...model,
      legions: [
        {
          ...model.legions![0]!,
          position: {
            kind: "lane" as const,
            laneId: "l-ab",
            towardSectorId: "b",
            progress: { unit: "perMilleRatio" as const, op: "flat" as const, value: 750 }
          }
        }
      ]
    };
    syncWorldSystem({
      scene,
      theme: WORLD_THEME_FALLBACK,
      registry,
      lastApplied: 1,
      modelSeq: 2,
      model: advanced,
      tier: "map"
    });
    expect(registry.getForce("e-march")).toBe(force);
    expect(force.destroy.mock.calls.length).toBe(destroyCalls);
    expect(force.x).toBe(440);
  });

  it("reuses pin GameObjects on identical re-apply (followup F7)", () => {
    const scene = fakeScene() as ReturnType<typeof fakeScene> & { objects: Array<{ destroy: ReturnType<typeof vi.fn> }> };
    const registry = new WorldRegistry();
    const sector = {
      sectorId: "homeworld",
      typeId: "homeworld",
      climate: null,
      ownerFactionId: "dave",
      intel: "Watched" as const,
      intelAge: 0,
      phase: "Held",
      dangerBand: { unit: "count" as const, value: 0 },
      developmentLevel: { unit: "count" as const, value: 0 },
      stability: { unit: "perMilleRatio" as const, op: "flat" as const, value: 1000 },
      pressure: { unit: "perMilleRatio" as const, op: "flat" as const, value: 0 },
      fractureIntensity: { unit: "perMilleRatio" as const, op: "absolute" as const, value: 1000 },
      habitable: true,
      layoutX: 0,
      layoutY: 0,
      loam: {
        production: { unit: "loamUnits" as const, value: 0 },
        upkeep: { unit: "loamUnits" as const, value: 0 },
        net: { unit: "loamUnits" as const, value: 0 },
        stock: { unit: "loamUnits" as const, value: 0 },
        capacity: { state: "pending" as const, reason: "x" },
        upkeepBreakdown: {
          base: { unit: "loamUnits" as const, value: 0 },
          garrison: { unit: "loamUnits" as const, value: 0 },
          development: { unit: "loamUnits" as const, value: 0 },
          danger: { unit: "loamUnits" as const, value: 0 },
          intensityMilli: { unit: "perMilleRatio" as const, op: "absolute" as const, value: 1000 }
        }
      },
      component: {
        componentId: null,
        production: { unit: "loamUnits" as const, value: 0 },
        upkeep: { unit: "loamUnits" as const, value: 0 },
        net: { unit: "loamUnits" as const, value: 0 },
        stock: { unit: "loamUnits" as const, value: 0 }
      },
      willReleaseNextTurn: false,
      lifelineCost: { state: "pending" as const, reason: "x" },
      lifeline: { state: "pending" as const, reason: "x" },
      wardenBindingId: { state: "pending" as const, reason: "x" },
      neglectedTurns: { state: "pending" as const, reason: "x" }
    };
    const model = {
      sectors: [sector],
      lanes: [],
      slotsBySectorId: {},
      forcesBySectorId: {},
      playerFactionId: "dave"
    };

    syncWorldSystem({
      scene: scene as unknown as Phaser.Scene,
      theme: WORLD_THEME_FALLBACK,
      registry,
      lastApplied: 0,
      modelSeq: 1,
      model,
      tier: "map"
    });
    const pin = registry.getSector("homeworld") as { destroy: ReturnType<typeof vi.fn> };
    expect(pin).toBeTruthy();
    const destroyCalls = pin.destroy.mock.calls.length;

    syncWorldSystem({
      scene: scene as unknown as Phaser.Scene,
      theme: WORLD_THEME_FALLBACK,
      registry,
      lastApplied: 1,
      modelSeq: 2,
      model,
      tier: "map"
    });
    expect(registry.getSector("homeworld")).toBe(pin);
    expect(pin.destroy.mock.calls.length).toBe(destroyCalls);
  });
});

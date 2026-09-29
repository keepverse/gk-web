import { afterEach, describe, expect, it, vi } from "vitest";

import { waitFor } from "@testing-library/react";

import { screen } from "@testing-library/react";

import userEvent from "@testing-library/user-event";

import { renderWithProviders } from "@/test/render";

import { StatusPage } from "@/features/status/StatusPage";

import { CatalogPage } from "@/features/catalog/CatalogPage";

import { RecipesPage } from "@/features/recipes/RecipesPage";

import { StatsPage } from "@/features/stats/StatsPage";

import { MetricsPage } from "@/features/metrics/MetricsPage";

import { CheatsPage } from "@/features/cheats/CheatsPage";

import { RpgProgressionPage } from "@/features/rpg-progression/RpgProgressionPage";
import { StoragePage } from "@/features/storage/StoragePage";
import { emptyMod } from "@/lib/bus/types";



function jsonResponse(data: unknown, status = 200) {

  return {

    ok: status >= 200 && status < 300,

    status,

    json: async () => data

  };

}



function stubApi(handlers: Record<string, (init?: RequestInit) => unknown>) {

  vi.stubGlobal(

    "fetch",

    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {

      const url = String(input);

      const entries = Object.entries(handlers).sort((a, b) => b[0].length - a[0].length);

      for (const [path, handler] of entries) {

        if (url.includes(path)) {

          const body = handler(init);

          return jsonResponse(body);

        }

      }

      return jsonResponse({ error: `unmocked ${url}` }, 404);

    })

  );

}



afterEach(() => {

  vi.unstubAllGlobals();

  vi.restoreAllMocks();

});



describe("feature pages", () => {

  it("StatusPage shows health fields", async () => {

    stubApi({

      "/health": () => ({

        ok: true,

        injectorConnected: true,

        lastHeartbeatUtc: "2026-01-01T00:00:00Z",

        source: "sim",

        simEnabled: true,

        ingestQueued: 2,

        lastFlushMs: 5,

        currentPlayerId: 1

      }),

      "/api/players": () => ({

        items: [{ id: 1, name: "Hero", createdUtc: "2026-01-01T00:00:00Z" }],

        currentPlayerId: 1

      })

    });



    renderWithProviders(<StatusPage />);

    expect(await screen.findByText("Connection")).toBeInTheDocument();

    await waitFor(() => {

      expect(screen.getByText(/sim \(sim routes on\)/)).toBeInTheDocument();

    });

    expect(screen.getByText(/1 \(Hero\)/)).toBeInTheDocument();

  });



  it("CatalogPage renders type rows", async () => {

    stubApi({

      "/api/types": () => ({

        items: [

          {

            side: "plant",

            type: 0,

            typeName: "Peashooter",

            displayName: "Pea",

            seenCount: 2,

            killedCount: 0,

            hpBase: 300

          }

        ]

      })

    });



    renderWithProviders(<CatalogPage />, { route: "/types" });

    expect(await screen.findByText("Peashooter")).toBeInTheDocument();

    expect(screen.getByText("Pea")).toBeInTheDocument();

  });



  it("RecipesPage renders fusion row", async () => {

    stubApi({

      "/api/recipes": () => ({

        items: [

          {

            parentA: 1,

            parentAName: "A",

            parentB: 2,

            parentBName: "B",

            result: 3,

            resultName: "C"

          }

        ]

      })

    });



    renderWithProviders(<RecipesPage />, { route: "/recipes" });

    expect(await screen.findByText(/A \(1\)/)).toBeInTheDocument();

    expect(screen.getByText(/C \(3\)/)).toBeInTheDocument();

  });



  it("StatsPage saves modifiers", async () => {

    const user = userEvent.setup();

    const calls: string[] = [];

    stubApi({

      "/api/stats": (init) => {

        calls.push(`${init?.method ?? "GET"} /api/stats`);

        return {

          plants: emptyMod(),

          zombies: emptyMod(),

          logDamage: true,

          applyStats: true

        };

      },

      "/api/commands/reload-stats": (init) => {

        calls.push(`${init?.method ?? "GET"} reload`);

        return {};

      }

    });



    renderWithProviders(<StatsPage />, { route: "/stats" });

    expect(await screen.findByText("Plants")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Save and push/i }));

    await waitFor(() => {

      expect(calls.some((c) => c.includes("PUT"))).toBe(true);

      expect(calls.some((c) => c.includes("reload"))).toBe(true);

    });

  });



  it("MetricsPage shows KPI when a run is selected", async () => {

    const user = userEvent.setup();

    stubApi({

      "/api/metrics": () => ({ items: [{ name: "plants_spawned", value: 1, ts: "t" }] }),

      "/api/runs": () => ({

        items: [

          {

            id: 9,

            startedUtc: "2026-01-01T00:00:00Z",

            levelName: "Day1",

            result: "victory",

            plantsPlanted: 4,

            plantsDied: 1,

            zombiesKilled: 10,

            mowersUsed: 2

          }

        ]

      }),

      "/api/runs/9/spawns": () => ({

        items: [{ id: 1, runId: 9, ptr: "0x1", side: "plant", type: 0, source: "spawn", capturedUtc: "t" }]

      })

    });



    renderWithProviders(<MetricsPage />, { route: "/runs" });

    expect(await screen.findByText("Day1")).toBeInTheDocument();

    await user.click(screen.getByText("#9"));

    expect(await screen.findByText("Run #9")).toBeInTheDocument();

    expect(screen.getAllByText("victory").length).toBeGreaterThanOrEqual(1);

    expect(await screen.findByText(/0x1/)).toBeInTheDocument();

  });

  it("CheatsPage renders tabs and fires action", async () => {

    const user = userEvent.setup();

    const calls: string[] = [];

    stubApi({

      "/api/cheats": () => ({

        menuEnabled: true,

        entries: [

          { id: "A-APPLY", kind: "toggle", enabled: true, floatValue: 0 },

          { id: "P-GOD", kind: "toggle", enabled: false, floatValue: 0 }

        ],

        catalog: { plants: [], zombies: [] }

      }),

      "/api/cheats/packs": () => ({

        items: [

          {

            id: "pack.smoke-core",

            label: "Smoke core",

            hint: "test",

            expectedKinds: ["cheat.inject"]

          }

        ]

      }),

      "/api/cheats/action": (init) => {

        calls.push(String(init?.body ?? ""));

        return { ok: true };

      },

      "/api/cheats/toggle": () => ({ ok: true })

    });



    renderWithProviders(<CheatsPage />, { route: "/cheats" });

    expect(await screen.findByTestId("page-cheats")).toBeInTheDocument();

    expect(screen.getByTestId("cheat-tab-A")).toBeInTheDocument();

    expect(await screen.findByTestId("panel-probe-packs")).toBeInTheDocument();

    await user.click(screen.getByTestId("cheat-tab-J"));

    await user.click(screen.getByRole("button", { name: "Reset all" }));

    await waitFor(() => {

      expect(calls.some((c) => c.includes("reset-all"))).toBe(true);

    });

  });



  it("RpgProgressionPage shows overview KPIs and chart panels", async () => {

    stubApi({

      "/api/players": () => ({

        items: [{ id: 1, name: "Hero", createdUtc: "2026-01-01T00:00:00Z" }],

        currentPlayerId: 1

      }),

      "/api/rpg/progression/1/summary": () => ({

        playerId: 1,

        player: {

          playerId: 1,

          kind: "player",

          typeId: 0,

          typeName: "Player",

          level: 3,

          xp: 40,

          xpToNext: 190,

          highestLevel: 3,

          demotionCount: 0,

          revision: 2,

          updatedAt: "t",

          curveFirst: 100,

          curveStep: 45

        },

        plantActorCount: 1,

        zombieActorCount: 1,

        highestPlantLevel: 2,

        highestZombieLevel: 2,

        topPlants: [],

        topZombies: []

      }),

      "/api/rpg/progression/1/stats": () => ({

        playerId: 1,

        xpByReason: [{ reason: "kill", sumDelta: 24, count: 2 }],

        plantLevels: [{ level: 2, count: 1 }],

        zombieLevels: [{ level: 1, count: 1 }],

        recentDeltas: [

          { t: "t1", delta: 12, reason: "kill" },

          { t: "t0", delta: -30, reason: "mower" }

        ]

      })

    });



    renderWithProviders(<RpgProgressionPage />, { route: "/rpg-progression" });

    expect(await screen.findByTestId("page-rpg-progression")).toBeInTheDocument();

    expect(screen.getByTestId("progression-kpis")).toBeInTheDocument();

    expect(screen.getByTestId("progression-chart-reason")).toBeInTheDocument();

    expect(screen.getByTestId("progression-chart-spark")).toBeInTheDocument();

    expect(screen.getByTestId("progression-chart-plants")).toBeInTheDocument();

    expect(screen.getByTestId("progression-chart-zombies")).toBeInTheDocument();

    await waitFor(() => {

      expect(screen.getByTestId("progression-chart-reason").querySelector('[data-testid="bar-chart"]')).toBeTruthy();

    });

  });

  it("RpgProgressionPage dossier shows promoted almanac text", async () => {

    const user = userEvent.setup();

    const plant = {

      playerId: 1,

      kind: "plant",

      typeId: 0,

      typeName: "Peashooter",

      displayName: "Pea CN",

      almanacInfo: "Shoots peas.<color=red>20</color>",

      almanacCost: "Cost:<color=red>100</color>",

      level: 2,

      xp: 10,

      xpToNext: 100,

      highestLevel: 2,

      demotionCount: 0,

      revision: 1,

      updatedAt: "t",

      curveFirst: 40,

      curveStep: 20

    };

    stubApi({

      "/api/players": () => ({

        items: [{ id: 1, name: "Hero", createdUtc: "2026-01-01T00:00:00Z" }],

        currentPlayerId: 1

      }),

      "/api/rpg/progression/1/summary": () => ({

        playerId: 1,

        player: {

          playerId: 1,

          kind: "player",

          typeId: 0,

          typeName: "Player",

          level: 1,

          xp: 0,

          xpToNext: 100,

          highestLevel: 1,

          demotionCount: 0,

          revision: 1,

          updatedAt: "t",

          curveFirst: 100,

          curveStep: 45

        },

        plantActorCount: 1,

        zombieActorCount: 0,

        highestPlantLevel: 2,

        highestZombieLevel: 0,

        topPlants: [plant],

        topZombies: []

      }),

      "/api/rpg/progression/1/stats": () => ({

        playerId: 1,

        xpByReason: [],

        plantLevels: [{ level: 2, count: 1 }],

        zombieLevels: [],

        recentDeltas: []

      }),

      "/api/rpg/progression/1/plant/0": () => plant,

      "/api/rpg/progression/1/ledger": () => ({ playerId: 1, items: [], limit: 25, nextAfterId: null })

    });



    renderWithProviders(<RpgProgressionPage />, { route: "/rpg-progression" });

    expect(await screen.findByTestId("page-rpg-progression")).toBeInTheDocument();

    await user.click(await screen.findByText("Pea CN"));

    expect(await screen.findByTestId("progression-actor-almanac")).toBeInTheDocument();

    expect(screen.getByTestId("progression-actor-almanac-info")).toHaveTextContent("Shoots peas.20");

    expect(screen.getByTestId("progression-actor-almanac-cost")).toHaveTextContent("Cost:100");

  });
  it("RpgProgressionPage dossier shows zombie introduce", async () => {
    const user = userEvent.setup();
    const zombie = {
      playerId: 1,
      kind: "zombie",
      typeId: 1,
      typeName: "FlagZombie",
      displayName: "Flag CN",
      almanacInfo: "Waves.",
      almanacIntroduce: "<color=#3D1400>Loves flags.</color>",
      level: 2,
      xp: 10,
      xpToNext: 100,
      highestLevel: 2,
      demotionCount: 0,
      revision: 1,
      updatedAt: "t",
      curveFirst: 40,
      curveStep: 20
    };
    stubApi({
      "/api/players": () => ({
        items: [{ id: 1, name: "Hero", createdUtc: "2026-01-01T00:00:00Z" }],
        currentPlayerId: 1
      }),
      "/api/rpg/progression/1/summary": () => ({
        playerId: 1,
        player: {
          playerId: 1,
          kind: "player",
          typeId: 0,
          typeName: "Player",
          level: 1,
          xp: 0,
          xpToNext: 100,
          highestLevel: 1,
          demotionCount: 0,
          revision: 1,
          updatedAt: "t",
          curveFirst: 100,
          curveStep: 45
        },
        plantActorCount: 0,
        zombieActorCount: 1,
        highestPlantLevel: 0,
        highestZombieLevel: 2,
        topPlants: [],
        topZombies: [zombie]
      }),
      "/api/rpg/progression/1/stats": () => ({
        playerId: 1,
        xpByReason: [],
        plantLevels: [],
        zombieLevels: [{ level: 2, count: 1 }],
        recentDeltas: []
      }),
      "/api/rpg/progression/1/zombie/1": () => zombie,
      "/api/rpg/progression/1/ledger": () => ({ playerId: 1, items: [], limit: 25, nextAfterId: null })
    });

    renderWithProviders(<RpgProgressionPage />, { route: "/rpg-progression" });
    expect(await screen.findByTestId("page-rpg-progression")).toBeInTheDocument();
    await user.click(await screen.findByText("Flag CN"));
    expect(await screen.findByTestId("progression-actor-almanac-introduce")).toHaveTextContent("Loves flags.");
  });

  it("RpgProgressionPage hides almanac section when fields empty", async () => {
    const user = userEvent.setup();
    const plant = {
      playerId: 1,
      kind: "plant",
      typeId: 0,
      typeName: "Pea",
      displayName: "Bare Pea",
      almanacInfo: "<color=red></color>",
      level: 1,
      xp: 0,
      xpToNext: 40,
      highestLevel: 1,
      demotionCount: 0,
      revision: 1,
      updatedAt: "t",
      curveFirst: 40,
      curveStep: 20
    };
    stubApi({
      "/api/players": () => ({
        items: [{ id: 1, name: "Hero", createdUtc: "2026-01-01T00:00:00Z" }],
        currentPlayerId: 1
      }),
      "/api/rpg/progression/1/summary": () => ({
        playerId: 1,
        player: {
          playerId: 1,
          kind: "player",
          typeId: 0,
          typeName: "Player",
          level: 1,
          xp: 0,
          xpToNext: 100,
          highestLevel: 1,
          demotionCount: 0,
          revision: 1,
          updatedAt: "t",
          curveFirst: 100,
          curveStep: 45
        },
        plantActorCount: 1,
        zombieActorCount: 0,
        highestPlantLevel: 1,
        highestZombieLevel: 0,
        topPlants: [plant],
        topZombies: []
      }),
      "/api/rpg/progression/1/stats": () => ({
        playerId: 1,
        xpByReason: [],
        plantLevels: [{ level: 1, count: 1 }],
        zombieLevels: [],
        recentDeltas: []
      }),
      "/api/rpg/progression/1/plant/0": () => plant,
      "/api/rpg/progression/1/ledger": () => ({ playerId: 1, items: [], limit: 25, nextAfterId: null })
    });

    renderWithProviders(<RpgProgressionPage />, { route: "/rpg-progression" });
    await user.click(await screen.findByText("Bare Pea"));
    expect(await screen.findByTestId("progression-actor-panel")).toBeInTheDocument();
    expect(screen.queryByTestId("progression-actor-almanac")).not.toBeInTheDocument();
  });

  it("StoragePage shows summary archives and closed runs panels", async () => {
    stubApi({
      "/api/storage/summary": () => ({
        archiveCount: 1,
        closedRunsStillHot: 1,
        openRuns: 0,
        activityOverTail: false,
        xpOverTail: false
      }),
      "/api/storage/archives": () => ({
        items: [{ uri: "archive/r1.sqlite", kind: "capture", runId: 3, createdUtc: "2026-01-01T00:00:00Z" }]
      }),
      "/api/runs": () => ({
        items: [
          {
            id: 3,
            startedUtc: "2026-01-01T00:00:00Z",
            endedUtc: "2026-01-01T01:00:00Z",
            levelName: "Day1",
            result: "victory",
            archiveUri: null
          }
        ]
      })
    });

    renderWithProviders(<StoragePage />, { route: "/storage" });
    expect(await screen.findByTestId("page-storage")).toBeInTheDocument();
    expect(screen.getByTestId("panel-storage-summary")).toBeInTheDocument();
    expect(screen.getByTestId("panel-storage-archives")).toBeInTheDocument();
    expect(screen.getByTestId("panel-storage-runs")).toBeInTheDocument();
    expect(screen.getByTestId("panel-storage-trim")).toBeInTheDocument();
    expect(await screen.findByText("archive/r1.sqlite")).toBeInTheDocument();
    expect(screen.getByText("hot")).toBeInTheDocument();
  });

  it("StoragePage confirm dialog cancel does not POST delete", async () => {
    const user = userEvent.setup();
    const posts: string[] = [];
    stubApi({
      "/api/storage/summary": () => ({
        archiveCount: 1,
        closedRunsStillHot: 0,
        openRuns: 0,
        activityOverTail: false,
        xpOverTail: false
      }),
      "/api/storage/archives": () => ({
        items: [{ uri: "archive/r1.sqlite", kind: "capture", runId: 3, createdUtc: "t" }]
      }),
      "/api/storage/archives/delete": (init) => {
        posts.push(String(init?.method ?? "POST") + " delete");
        return { deleted: 1, refused: 0 };
      },
      "/api/runs": () => ({ items: [] })
    });

    renderWithProviders(<StoragePage />, { route: "/storage" });
    await screen.findByText("archive/r1.sqlite");
    await user.click(screen.getByLabelText("Select archive archive/r1.sqlite"));
    await user.click(screen.getByTestId("storage-delete-archives"));
    expect(await screen.findByTestId("storage-confirm")).toBeInTheDocument();
    expect(screen.getByText(/Delete 1 cold archive/)).toBeInTheDocument();

    await user.click(screen.getByTestId("storage-confirm-cancel"));
    expect(screen.queryByTestId("storage-confirm")).not.toBeInTheDocument();
    expect(posts).toHaveLength(0);
  });

  it("StoragePage confirm dialog confirm POSTs delete", async () => {
    const user = userEvent.setup();
    const posts: string[] = [];
    stubApi({
      "/api/storage/summary": () => ({
        archiveCount: 1,
        closedRunsStillHot: 0,
        openRuns: 0,
        activityOverTail: false,
        xpOverTail: false
      }),
      "/api/storage/archives": () => ({
        items: [{ uri: "archive/r1.sqlite", kind: "capture", runId: 3, createdUtc: "t" }]
      }),
      "/api/storage/archives/delete": () => {
        posts.push("delete");
        return { deleted: 1, refused: 0 };
      },
      "/api/runs": () => ({ items: [] })
    });

    renderWithProviders(<StoragePage />, { route: "/storage" });
    await screen.findByText("archive/r1.sqlite");
    await user.click(screen.getByLabelText("Select archive archive/r1.sqlite"));
    await user.click(screen.getByTestId("storage-delete-archives"));
    await user.click(await screen.findByTestId("storage-confirm-confirm"));
    await waitFor(() => expect(posts).toEqual(["delete"]));
    expect(await screen.findByTestId("storage-message")).toHaveTextContent("Deleted 1");
  });
});

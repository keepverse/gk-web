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

const stats = {
  plants: {
    hpPercent: 1,
    hpFlat: 0,
    attackPercent: 1,
    attackFlat: 0,
    defensePercent: 1,
    defenseFlat: 0
  },
  zombies: {
    hpPercent: 1,
    hpFlat: 0,
    attackPercent: 1,
    attackFlat: 0,
    defensePercent: 1,
    defenseFlat: 0
  },
  logDamage: true,
  applyStats: true
};

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body)
  });
}

async function mockApi(page: Page) {
  await page.route("**/hub/rpg**", async (route) => {
    await route.abort();
  });

  await page.route("**/health", (route) => fulfillJson(route, health));
  await page.route("**/api/players", (route) => fulfillJson(route, players));
  await page.route("**/api/players/current", (route) => fulfillJson(route, { ok: true }));
  await page.route("**/api/stats", (route) => fulfillJson(route, stats));
  await page.route("**/api/commands/reload-stats", (route) => fulfillJson(route, { ok: true }));
  await page.route("**/api/types", (route) =>
    fulfillJson(route, {
      items: [
        {
          side: "plant",
          type: 0,
          typeName: "Peashooter",
          displayName: "Pea",
          seenCount: 1,
          killedCount: 0,
          hpBase: 300
        }
      ]
    })
  );
  await page.route("**/api/recipes", (route) =>
    fulfillJson(route, {
      items: [
        {
          parentA: 1,
          parentAName: "Sunflower",
          parentB: 2,
          parentBName: "Peashooter",
          result: 3,
          resultName: "SunPea"
        }
      ]
    })
  );
  await page.route("**/api/metrics", (route) =>
    fulfillJson(route, { items: [{ name: "plants_spawned", value: 3, ts: "t" }] })
  );
  await page.route("**/api/runs", (route) =>
    fulfillJson(route, {
      items: [
        {
          id: 7,
          startedUtc: "2026-01-01T00:00:00Z",
          levelName: "Lawn",
          result: "victory",
          plantsPlanted: 5,
          plantsDied: 1,
          zombiesKilled: 12,
          mowersUsed: 1
        }
      ]
    })
  );
  await page.route("**/api/runs/*/spawns", (route) =>
    fulfillJson(route, {
      items: [
        {
          id: 1,
          runId: 7,
          ptr: "0xabc",
          side: "zombie",
          type: 1,
          source: "spawn",
          capturedUtc: "t",
          stats: { hp: 200 }
        }
      ]
    })
  );
  await page.route("**/api/sim/state", (route) => fulfillJson(route, null, 404));
  await page.route("**/api/cheats", (route) =>
    fulfillJson(route, {
      menuEnabled: true,
      persist: false,
      entries: [
        { id: "A-APPLY", kind: "toggle", enabled: true, floatValue: 0 },
        { id: "P-GOD", kind: "toggle", enabled: false, floatValue: 0 }
      ],
      catalog: { plants: [{ type: 0, typeName: "Pea" }], zombies: [] }
    })
  );
  await page.route("**/api/cheats/toggle", (route) => fulfillJson(route, { ok: true }));
  await page.route("**/api/cheats/set-float", (route) => fulfillJson(route, { ok: true }));
  await page.route("**/api/cheats/action", (route) => fulfillJson(route, { ok: true }));
  await page.route("**/api/cheats/packs", (route) =>
    fulfillJson(route, {
      items: [
        {
          id: "pack.smoke-core",
          label: "Smoke core",
          hint: "play",
          expectedKinds: ["cheat.inject"]
        }
      ]
    })
  );
  await page.route("**/api/pvz-stats/**", async (route) => {
    const url = route.request().url();
    if (url.includes("/channels/")) {
      await fulfillJson(route, {
        playerId: 1,
        revision: 1,
        channel: "hp",
        final: 5,
        contributions: [
          {
            channel: "hp",
            pluginId: "rpg.item",
            sourceKind: "item",
            sourceId: "demo-ring",
            op: "Flat",
            value: 10,
            priority: 0,
            detailJson: '{"label":"Ring of Life"}'
          }
        ]
      });
      return;
    }
    await fulfillJson(route, {
      playerId: 1,
      revision: 1,
      updatedAt: "t",
      channels: [{ channel: "hp", final: 5, sourceCount: 2 }]
    });
  });
  await page.route("**/api/test/seed-pvz-stats-demo", (route) =>
    fulfillJson(route, {
      playerId: 1,
      revision: 1,
      updatedAt: "t",
      channels: [
        { channel: "hp", final: 5, sourceCount: 2 },
        { channel: "maxHp", final: 5, sourceCount: 2 }
      ]
    })
  );
  await page.route("**/api/pvz-activity/**", (route) =>
    fulfillJson(route, {
      playerId: 1,
      revision: 0,
      updatedAt: "t",
      matchesStarted: 0,
      matchesEnded: 0,
      victories: 0,
      defeats: 0,
      zombiesKilled: 0,
      plantsLost: 0,
      plantsPlaced: 0,
      extraSpawnsFired: 0,
      items: []
    })
  );
  await page.route("**/api/test/seed-pvz-activity-demo", (route) =>
    fulfillJson(route, {
      playerId: 1,
      revision: 1,
      updatedAt: "t",
      matchesStarted: 1,
      matchesEnded: 1,
      victories: 1,
      defeats: 0,
      zombiesKilled: 2,
      plantsLost: 0,
      plantsPlaced: 0,
      extraSpawnsFired: 0
    })
  );
}

test.describe("audit shell e2e", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
  });

  test("loads status and navigates audit pages", async ({ page }) => {
    // Status/Stats/Cheats/Log/Runs are dev-tree surfaces as of T12 (see dev-tree.spec.ts for
    // the tree's own contract) — this test still exercises them as regression coverage that
    // the pages themselves render inside their new home. Types/Recipes are Almanac tabs as of
    // T19 (see almanac-chronicle.spec.ts for that layer's own contract).
    // The dev tree is a modal panel: Radix correctly aria-hides the rest of the page (including
    // HudBar's "Rise of Summoner" heading) while it's open, so that heading isn't asserted here.
    await page.goto("./#/status");
    await expect(page.getByTestId("dev-tree-surface-status")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Status" })).toBeVisible();
    await expect(page.getByText("Connection")).toBeVisible();

    await page.getByTestId("dev-tree-tab-stats").click();
    await expect(page.getByTestId("dev-tree-surface-stats")).toBeVisible();
    await expect(page.getByText("Plants")).toBeVisible();
    await expect(page.getByRole("button", { name: /Save and push/i })).toBeVisible();

    await page.getByTestId("dev-tree-tab-cheats").click();
    await expect(page.getByTestId("page-cheats")).toBeVisible();
    await expect(page.getByTestId("cheat-tab-A")).toBeVisible();
    await expect(page.getByTestId("panel-probe-packs")).toBeVisible();
    await page.getByTestId("cheat-tab-B").click();
    await expect(page.getByText("P-GOD — Plant godmode")).toBeVisible();

    // The dev tree is a modal panel — close it before touching the rail underneath.
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("dev-tree")).not.toBeVisible();

    await page.getByTestId("rail-almanac").click();
    await expect(page.getByTestId("almanac-layer")).toBeVisible();
    await expect(page.getByText("Peashooter")).toBeVisible();

    await page.getByTestId("almanac-tab-recipes").click();
    await expect(page.getByText(/SunPea \(3\)/)).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("almanac-layer")).not.toBeVisible();

    await page.goto("./#/log");
    await expect(page.getByRole("heading", { name: "Live log" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();

    await page.getByTestId("dev-tree-tab-runs").click();
    const runsSurface = page.getByTestId("dev-tree-surface-runs");
    await expect(runsSurface.getByText("Lawn")).toBeVisible();
    await runsSurface.getByText("#7").click();
    await expect(runsSurface.getByText("Run #7")).toBeVisible();
    await expect(runsSurface.getByText("Result").locator("..").getByText("victory")).toBeVisible();
    await expect(runsSurface.getByText(/0xabc/)).toBeVisible();
  });

  test("creates a player save from Save select", async ({ page }) => {
    let created = false;
    await page.route("**/api/players", async (route) => {
      if (route.request().method() === "POST") {
        created = true;
        await fulfillJson(route, { id: 2, name: "NewSave" });
        return;
      }
      await fulfillJson(route, players);
    });

    // fe-essentials: player creation moved from HudBar (removed — plate 01 §F, "it is not a
    // dropdown wedged into the top bar of every screen") to the dedicated Save select screen.
    await page.goto("./#/saves");
    await page.getByTestId("save-slot-new").click();
    await page.getByPlaceholder("Summoner name").fill("NewSave");
    await page.getByRole("button", { name: "Create" }).click();
    await expect.poll(() => created).toBe(true);
  });

  test("saves stats and pushes reload", async ({ page }) => {
    const methods: string[] = [];
    await page.route("**/api/stats", async (route) => {
      methods.push(`${route.request().method()} stats`);
      await fulfillJson(route, stats);
    });
    await page.route("**/api/commands/reload-stats", async (route) => {
      methods.push("POST reload");
      await fulfillJson(route, { ok: true });
    });

    await page.goto("./#/stats");
    await page.getByRole("button", { name: /Save and push/i }).click();
    await expect.poll(() => methods.join(",")).toContain("PUT stats");
    await expect.poll(() => methods.join(",")).toContain("POST reload");
  });

  test("pvz-stats page seeds demo sheet", async ({ page }) => {
    let seeded = false;
    await page.route("**/api/test/seed-pvz-stats-demo", async (route) => {
      seeded = true;
      await fulfillJson(route, {
        playerId: 1,
        revision: 2,
        updatedAt: "t",
        channels: [
          { channel: "hp", final: 5, sourceCount: 2 },
          { channel: "maxHp", final: 5, sourceCount: 2 }
        ]
      });
    });
    await page.goto("./#/pvz-stats");
    await expect(page).toHaveURL(/#\/sanctum\?panel=chronicle/);
    await page.getByTestId("chronicle-tab-pvz-stats").click();
    await expect(page.getByTestId("page-pvz-stats")).toBeVisible();
    await page.getByTestId("pvz-stats-seed").click();
    await expect.poll(() => seeded).toBe(true);
    await expect(page.getByText("hp", { exact: true })).toBeVisible();
  });

  test("pvz-activity page seeds demo rollup", async ({ page }) => {
    let seeded = false;
    await page.route("**/api/pvz-activity/**", async (route) => {
      const url = route.request().url();
      if (url.includes("/facts")) {
        await fulfillJson(route, {
          playerId: 1,
          revision: seeded ? 1 : 0,
          items: seeded
            ? [
                {
                  id: 1,
                  playerId: 1,
                  kind: "ZombieKilled",
                  sourceKind: "seed",
                  sourceId: "demo",
                  runId: null,
                  dedupeKey: "d1",
                  t: "t",
                  payloadJson: "{}"
                }
              ]
            : []
        });
        return;
      }
      await fulfillJson(route, {
        playerId: 1,
        revision: seeded ? 1 : 0,
        updatedAt: "t",
        matchesStarted: seeded ? 1 : 0,
        matchesEnded: seeded ? 1 : 0,
        victories: seeded ? 1 : 0,
        defeats: 0,
        zombiesKilled: seeded ? 2 : 0,
        plantsLost: 0,
        plantsPlaced: 0,
        extraSpawnsFired: 0
      });
    });
    await page.route("**/api/test/seed-pvz-activity-demo", async (route) => {
      seeded = true;
      await fulfillJson(route, {
        playerId: 1,
        revision: 1,
        updatedAt: "t",
        matchesStarted: 1,
        matchesEnded: 1,
        victories: 1,
        defeats: 0,
        zombiesKilled: 2,
        plantsLost: 0,
        plantsPlaced: 0,
        extraSpawnsFired: 0
      });
    });
    await page.goto("./#/pvz-activity");
    await expect(page.getByTestId("page-pvz-activity")).toBeVisible();
    await page.getByTestId("pvz-activity-seed").click();
    await expect.poll(() => seeded).toBe(true);
    await expect(page.getByTestId("panel-pvz-activity-rollup")).toContainText("Zombies killed");
    await expect(page.getByTestId("panel-pvz-activity-rollup")).toContainText("2");
  });

  test("rpg-progression overview charts plants dossier", async ({ page }) => {
    let seeded = false;
    let clearPosted = false;
    let ledgerAfterId: number | null = null;
    let ledgerReason = "";
    const plantRow = {
      playerId: 1,
      kind: "plant",
      typeId: 0,
      typeName: "Pea",
      displayName: "Pea CN",
      almanacInfo: "Shoots peas.<color=red>20</color>",
      almanacCost: "Cost:<color=red>100</color>",
      level: 2,
      xp: 10,
      xpToNext: 112,
      highestLevel: 2,
      demotionCount: 1,
      revision: 1,
      updatedAt: "t",
      curveFirst: 80,
      curveStep: 32
    };
    const zombieRow = {
      playerId: 1,
      kind: "zombie",
      typeId: 1,
      typeName: "Z",
      displayName: "Flag CN",
      almanacInfo: "Waves.",
      almanacIntroduce: "<color=#3D1400>Loves flags.</color>",
      level: 2,
      xp: 18,
      xpToNext: 98,
      highestLevel: 2,
      demotionCount: 0,
      revision: 1,
      updatedAt: "t",
      curveFirst: 70,
      curveStep: 28
    };
    const playerSheet = () => ({
      playerId: 1,
      kind: "player",
      typeId: 0,
      typeName: "Player",
      level: seeded ? 3 : 1,
      xp: seeded ? 40 : 0,
      xpToNext: 190,
      highestLevel: seeded ? 3 : 1,
      demotionCount: seeded ? 2 : 0,
      revision: seeded ? 2 : 0,
      updatedAt: "t",
      curveFirst: 100,
      curveStep: 45
    });
    const ledgerItems = [
      {
        id: 1,
        playerId: 1,
        kind: "player",
        typeId: 0,
        typeName: "Player",
        runId: 0,
        t: "t1",
        delta: 12,
        reason: "kill",
        levelBefore: 1,
        xpBefore: 0,
        levelAfter: 1,
        xpAfter: 12,
        demotionBefore: 0,
        demotionAfter: 0,
        payloadJson: '{"powerScale":1}'
      },
      {
        id: 2,
        playerId: 1,
        kind: "zombie",
        typeId: 1,
        typeName: "Z",
        runId: 0,
        t: "t0",
        delta: 9,
        reason: "zombie_spawn",
        levelBefore: 1,
        xpBefore: 0,
        levelAfter: 1,
        xpAfter: 9,
        demotionBefore: 0,
        demotionAfter: 0,
        payloadJson: "{}"
      }
    ];
    await page.route("**/api/rpg/progression/**", async (route) => {
      const url = route.request().url();
      const method = route.request().method();
      if (method === "POST" && url.includes("/clear-demotion")) {
        clearPosted = true;
        await fulfillJson(route, { ...playerSheet(), demotionCount: 0 });
        return;
      }
      if (url.includes("/summary")) {
        await fulfillJson(route, {
          playerId: 1,
          player: playerSheet(),
          plantActorCount: seeded ? 1 : 0,
          zombieActorCount: seeded ? 1 : 0,
          highestPlantLevel: seeded ? 2 : 0,
          highestZombieLevel: seeded ? 2 : 0,
          topPlants: seeded ? [plantRow] : [],
          topZombies: seeded ? [zombieRow] : []
        });
        return;
      }
      if (url.includes("/stats")) {
        await fulfillJson(route, {
          playerId: 1,
          xpByReason: seeded ? [{ reason: "kill", sumDelta: 24, count: 2 }] : [],
          plantLevels: seeded ? [{ level: 2, count: 1 }] : [],
          zombieLevels: seeded ? [{ level: 2, count: 1 }] : [],
          recentDeltas: seeded
            ? [
                { t: "t1", delta: 12, reason: "kill" },
                { t: "t0", delta: 12, reason: "kill" }
              ]
            : []
        });
        return;
      }
      if (url.includes("/ledger")) {
        const u = new URL(url);
        ledgerReason = u.searchParams.get("reason") ?? "";
        const afterRaw = u.searchParams.get("afterId");
        ledgerAfterId = afterRaw != null ? Number(afterRaw) : null;
        const filtered = (ledgerReason
          ? ledgerItems.filter((i) => i.reason === ledgerReason)
          : ledgerItems
        ).slice().sort((a, b) => b.id - a.id);
        const pageItems =
          ledgerAfterId != null
            ? filtered.filter((i) => i.id < ledgerAfterId!).slice(0, 1)
            : filtered.slice(0, 1);
        const last = pageItems[pageItems.length - 1];
        const hasMore =
          last != null && filtered.some((i) => i.id < last.id);
        await fulfillJson(route, {
          playerId: 1,
          limit: 40,
          nextAfterId: seeded && hasMore ? last!.id : null,
          items: seeded ? pageItems : []
        });
        return;
      }
      if (url.match(/\/plant\/0$/)) {
        await fulfillJson(route, plantRow);
        return;
      }
      if (url.match(/\/zombie\/1$/)) {
        await fulfillJson(route, zombieRow);
        return;
      }
      if (url.includes("kind=zombie")) {
        await fulfillJson(route, {
          playerId: 1,
          items: seeded ? [zombieRow] : [],
          total: seeded ? 1 : 0,
          limit: 25,
          offset: 0
        });
        return;
      }
      if (url.includes("kind=plant")) {
        await fulfillJson(route, {
          playerId: 1,
          items: seeded ? [plantRow] : [],
          total: seeded ? 1 : 0,
          limit: 25,
          offset: 0
        });
        return;
      }
      await fulfillJson(route, {
        playerId: 1,
        items: seeded ? [plantRow] : [],
        total: seeded ? 1 : 0,
        limit: 25,
        offset: 0
      });
    });
    await page.route("**/api/test/seed-rpg-progression-demo", async (route) => {
      seeded = true;
      await fulfillJson(route, {
        playerId: 1,
        player: playerSheet(),
        plantActorCount: 1,
        zombieActorCount: 1,
        highestPlantLevel: 2,
        highestZombieLevel: 2,
        topPlants: [],
        topZombies: []
      });
    });
    await page.goto("./#/rpg-progression");
    await expect(page).toHaveURL(/#\/sanctum\?panel=chronicle/);
    await page.getByTestId("chronicle-tab-growth").click();
    await expect(page.getByTestId("page-rpg-progression")).toBeVisible();
    await page.getByTestId("rpg-progression-seed").click();
    await expect.poll(() => seeded).toBe(true);
    await expect(page.getByTestId("progression-player-hero")).toContainText("L3");
    await expect(page.getByTestId("progression-kpis")).toBeVisible();
    await expect(page.getByTestId("progression-chart-reason")).toContainText("kill");
    await expect(page.getByTestId("progression-chart-spark")).toBeVisible();
    await expect(page.getByTestId("progression-chart-plants")).toContainText("L2");
    await expect(page.getByTestId("progression-chart-zombies")).toContainText("L2");

    await page.getByTestId("progression-top-plants").locator("tbody tr").first().click();
    await expect(page.getByTestId("progression-plants")).toBeVisible();
    await expect(page.getByTestId("progression-actor-panel")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("progression-actor-panel")).toContainText("Peak");
    await expect(page.getByTestId("progression-actor-panel")).toContainText("Pea CN");
    await expect(page.getByTestId("progression-actor-almanac-info")).toContainText("Shoots peas.20");
    await expect(page.getByTestId("progression-actor-almanac-cost")).toContainText("Cost:100");

    await page.getByTestId("progression-tab-zombies").click();
    await expect(page.getByTestId("progression-zombies")).toBeVisible();
    await page.getByTestId("progression-zombies").locator("tbody tr").first().click();
    await expect(page.getByTestId("progression-actor-panel")).toBeVisible();
    await expect(page.getByTestId("progression-actor-panel")).toContainText("Flag CN");
    await expect(page.getByTestId("progression-actor-almanac-introduce")).toContainText("Loves flags.");

    await page.getByTestId("progression-tab-ledger").click();
    await expect(page.getByTestId("progression-advanced-ledger")).toBeVisible();
    await page.getByTestId("ledger-filter-reason").selectOption("kill");
    await expect.poll(() => ledgerReason).toBe("kill");
    await page.getByTestId("ledger-filter-reason").selectOption("");
    await expect(page.getByTestId("progression-ledger-pager")).toBeVisible();
    await page.getByTestId("progression-ledger-pager-next").click();
    await expect.poll(() => ledgerAfterId).toBe(2);

    await page.getByTestId("progression-tab-overview").click();
    await page.getByTestId("progression-clear-demotion").click();
    await expect.poll(() => clearPosted).toBe(true);
  });
});

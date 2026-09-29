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

const auraCatalog = {
  items: [
    { auraId: "Might", aptitudeId: "Might", upkeep: [{ resourceId: "stamina", amountMin: 5, amountMax: 5, when: "PerTick" }] },
    { auraId: "Fortitude", aptitudeId: "Fortitude", upkeep: [] },
    { auraId: "Vigor", aptitudeId: "Vigor", upkeep: [] }
  ]
};

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function mockShell(page: Page) {
  await page.route("**/hub/rpg**", (route) => route.abort());
  await page.route("**/health", (route) => fulfillJson(route, health));
  await page.route("**/api/players", (route) => fulfillJson(route, players));
  await page.route("**/api/players/current", (route) => fulfillJson(route, { ok: true }));
  await page.route("**/api/sim", (route) => fulfillJson(route, null, 404));
}

/** aura-skill T18c own state, mutated by the mocked enable/disable routes below so the panel's
 * re-fetch after each mutation reflects the outcome — a stateful mock, not a fixed fixture. */
function freshRuntimeState() {
  return { playerId: 1, activeAuraIds: [] as string[], equippedAuraIds: ["Might", "Fortitude"], maxActiveAuras: 1 };
}

async function mockAuraSurface(page: Page, runtime = freshRuntimeState()) {
  await page.route("**/api/auras", (route) => fulfillJson(route, auraCatalog));

  await page.route("**/api/aura-runtime/1", (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    return fulfillJson(route, runtime);
  });

  await page.route("**/api/aura-runtime/1/enable", async (route) => {
    const body = route.request().postDataJSON() as { auraId: string };
    if (!runtime.equippedAuraIds.includes(body.auraId)) {
      return fulfillJson(route, { reason: "NotEquipped", auraId: body.auraId }, 409);
    }
    if (runtime.activeAuraIds.includes(body.auraId)) {
      return fulfillJson(route, { reason: "AlreadyActive", auraId: body.auraId }, 409);
    }
    let evicted: string | null = null;
    runtime.activeAuraIds.push(body.auraId);
    if (runtime.activeAuraIds.length > runtime.maxActiveAuras) {
      evicted = runtime.activeAuraIds.shift() ?? null;
    }
    return fulfillJson(route, { playerId: 1, enabledAuraId: body.auraId, evictedAuraId: evicted, activeAuraIds: [...runtime.activeAuraIds] });
  });

  await page.route("**/api/aura-runtime/1/disable", async (route) => {
    const body = route.request().postDataJSON() as { auraId: string };
    const wasActive = runtime.activeAuraIds.includes(body.auraId);
    runtime.activeAuraIds = runtime.activeAuraIds.filter((id) => id !== body.auraId);
    return fulfillJson(route, { playerId: 1, disabledAuraId: body.auraId, wasActive, activeAuraIds: [...runtime.activeAuraIds] });
  });

  await page.route("**/api/actors/fixture-actor-1/derived", (route) =>
    fulfillJson(route, {
      instanceId: "fixture-actor-1",
      channels: [
        { channelId: "progression.power", value: 0, contributions: [{ sourceId: "rpg.progression", op: "Replace", value: 0 }] },
        { channelId: "progression.realm", value: 1, contributions: [{ sourceId: "rpg.progression", op: "Replace", value: 1 }] }
      ]
    })
  );
}

async function openKitAuraSurface(page: Page) {
  await page.goto("/#/actor-ladder-demo?mock=1");
  await page.getByTestId("actor-ladder-open-panel").click();
  await expect(page.getByTestId("actor-panel")).toBeVisible();
  await page.getByTestId("actor-sheet-tab-kit").click();
  await expect(page.getByTestId("actions-tab-auras")).toBeVisible();
}

test.describe("Aura surface (aura-skill T18c)", () => {
  test("a real authored upkeep cost is visible before committing", async ({ page }) => {
    await mockShell(page);
    await mockAuraSurface(page);
    await openKitAuraSurface(page);

    await expect(page.getByTestId("aura-slot-Might-upkeep")).toContainText("5 stamina per tick");
    // Fortitude has no authored cost -- honestly nothing rendered, not a fabricated "Free".
    await expect(page.getByTestId("aura-slot-Fortitude")).not.toContainText("per tick");
  });

  test("enabling an equipped aura makes it active", async ({ page }) => {
    await mockShell(page);
    await mockAuraSurface(page);
    await openKitAuraSurface(page);

    await expect(page.getByTestId("aura-slot-Might-badge")).toHaveText("Equipped");
    await page.getByTestId("aura-slot-Might-toggle").click();

    await expect(page.getByTestId("aura-slot-Might-badge")).toHaveText("Active");
    await expect(page.getByTestId("aura-slot-Might-toggle")).toHaveText("Disable");
  });

  test("enabling a second aura at the cap names the one it switched off (GG-55)", async ({ page }) => {
    await mockShell(page);
    await mockAuraSurface(page);
    await openKitAuraSurface(page);

    await page.getByTestId("aura-slot-Might-toggle").click();
    await expect(page.getByTestId("aura-slot-Might-badge")).toHaveText("Active");

    await page.getByTestId("aura-slot-Fortitude-toggle").click();
    await expect(page.getByTestId("aura-slot-Fortitude-badge")).toHaveText("Active");

    // Might is named as switched off, not silently dropped -- the note survives past the toast.
    await expect(page.getByTestId("aura-slot-Might-refusal")).toContainText("Fortitude took its slot");
    await expect(page.getByTestId("aura-slot-Might-badge")).toHaveText("Equipped");
  });

  test("a real aura not in the loadout renders locked with its real reason", async ({ page }) => {
    await mockShell(page);
    await mockAuraSurface(page);
    await openKitAuraSurface(page);

    const slot = page.getByTestId("aura-slot-Vigor");
    await expect(slot).toBeVisible();
    await expect(slot).toHaveAttribute("title", /Not equipped/);
    await expect(page.getByTestId("aura-slot-Vigor-toggle")).toHaveCount(0);
  });

  test("a derived channel shows its real contributions (GG-49, non-vacuously)", async ({ page }) => {
    await mockShell(page);
    await mockAuraSurface(page);
    await page.goto("/#/actor-ladder-demo?mock=1");
    await page.getByTestId("actor-ladder-open-panel").click();
    await page.getByTestId("actor-sheet-tab-derived").click();

    await page.getByRole("tab", { name: "progression" }).click();
    await page.getByTestId("derived-family-progression.power").click();
    const powerChannel = page.getByTestId("derived-channel-progression.power");
    await expect(powerChannel).toBeVisible();
    await expect(powerChannel.getByTestId("channel-contribution-rpg.progression")).toBeVisible();
  });

  const VIEWPORTS = [
    { name: "desktop", width: 1440, height: 900 },
    { name: "mobile", width: 390, height: 844 }
  ];

  for (const vp of VIEWPORTS) {
    test(`visual: aura slots render without overflow at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await mockShell(page);
      await mockAuraSurface(page);
      await openKitAuraSurface(page);

      await page.getByTestId("aura-slot-Might-toggle").click();
      await expect(page.getByTestId("aura-slot-Might-badge")).toHaveAttribute("aria-selected", "true");
      // Tailwind's transition-colors paints ~150ms after the DOM/state assertion already passed
      // (actor-sheet program's own established trap) -- settle before the screenshot, not the assert.
      await page.waitForTimeout(250);

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(overflow).toBe(false);

      await page.screenshot({ path: `test-results/visual/aura-actions-tab-${vp.name}.png`, fullPage: true });
    });
  }
});

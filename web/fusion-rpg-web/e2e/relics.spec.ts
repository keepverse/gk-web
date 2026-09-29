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

const actors = {
  playerId: 1,
  items: [{ instanceId: "a1", playerId: 1, side: "plant", typeId: 3, phase: "Roster", level: 5, xp: 10, revision: 1 }]
};

const relics = {
  items: [
    {
      id: "relic.ashen_reliquary",
      name: "Ashen Reliquary",
      rarity: 4,
      slot: "weapon",
      description: "A reliquary warm to the touch. Channels raw offense.",
      effectId: "fx.passive_atk_flat"
    },
    {
      id: "relic.sunworn_charm",
      name: "Sunworn Charm",
      rarity: 2,
      slot: "weapon",
      description: "A sun-bleached charm, favoring survival over aggression.",
      effectId: "fx.shield_grant"
    },
    {
      id: "relic.tidewrack_band",
      name: "Tidewrack Band",
      rarity: 3,
      slot: "armor",
      description: "Salt-crusted band pulled from a flooded lawn.",
      effectId: "fx.cold_on_hit"
    }
  ]
};

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function mockSanctum(page: Page, opts?: { equipped?: { slot: string; itemId: string }[] }) {
  let equipment = { instanceId: "a1", phase: "Roster", items: opts?.equipped ?? [], modsJson: "{}" };
  await page.route("**/hub/rpg**", (route) => route.abort());
  await page.route("**/health", (route) => fulfillJson(route, health));
  await page.route("**/api/players", (route) => fulfillJson(route, players));
  await page.route("**/api/players/current", (route) => fulfillJson(route, { ok: true }));
  await page.route("**/api/sim", (route) => fulfillJson(route, null, 404));
  await page.route("**/api/unique/actors**", (route) => {
    if (route.request().url().includes("/equipment")) return route.fallback();
    return fulfillJson(route, actors);
  });
  await page.route("**/api/relics", (route) => fulfillJson(route, relics));
  await page.route("**/api/runs", (route) => fulfillJson(route, { items: [] }));
  await page.route("**/api/souls/**", (route) =>
    fulfillJson(route, { playerId: 1, balance: 500, earnedTotal: 500, spentTotal: 0, revision: 1, updatedUtc: "2026-01-01T00:00:00Z" })
  );
  await page.route("**/api/contracts/**", (route) =>
    fulfillJson(route, {
      contracts: [],
      capacity: { used: 0, total: 0, purchasedSlots: 0, nextSlotPrice: 0, canBuy: false, maxSlots: 0 },
      dailyTribute: 0,
      deployFloor: 0,
      loyaltyMax: 0
    })
  );
  await page.route("**/api/unique/actors/a1/equipment", (route) => {
    if (route.request().method() === "GET") return fulfillJson(route, equipment);
    return route.fallback();
  });
  await page.route("**/api/unique/actors/a1/equipment/*", async (route) => {
    if (route.request().method() !== "PUT") return route.fallback();
    const body = route.request().postDataJSON() as { itemId: string };
    const slot = route.request().url().split("/").pop()!;
    equipment = { ...equipment, items: [...equipment.items.filter((s) => s.slot !== slot), { slot, itemId: body.itemId }] };
    await fulfillJson(route, equipment);
  });
}

test.describe("Relics layer (T14)", () => {
  test("R opens it, Esc closes it, the Sanctum is never unmounted", async ({ page }) => {
    await mockSanctum(page);
    await page.goto("/#/sanctum");
    await expect(page.getByTestId("sanctum-hud")).toBeVisible();
    await expect(page.getByTestId("rail-relics")).not.toBeDisabled();

    await page.keyboard.press("r");
    await expect(page.getByTestId("relics-layer")).toBeVisible();
    await expect(page.getByTestId("sanctum-hud")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("relics-layer")).not.toBeVisible();
    await expect(page.getByTestId("sanctum-hud")).toBeVisible();
  });

  test("Held lists the real catalog, comparison shows beside the candidate, and Equip persists", async ({ page }) => {
    await mockSanctum(page, { equipped: [{ slot: "weapon", itemId: "relic.sunworn_charm" }] });
    await page.goto("/#/sanctum?panel=relics");

    await expect(page.getByTestId("relics-row-relic.ashen_reliquary")).toBeVisible();
    await expect(page.getByTestId("relics-row-relic.sunworn_charm")).toContainText("equipped");

    await page.getByTestId("relics-row-relic.ashen_reliquary").click();
    await expect(page.getByTestId("relics-compare")).toContainText("Swapping Sunworn Charm → Ashen Reliquary");

    await page.getByTestId("relics-equip-btn").click();
    await expect(page.getByTestId("relics-row-relic.ashen_reliquary")).toContainText("equipped");
    await expect(page.getByTestId("relics-row-relic.sunworn_charm")).not.toContainText("equipped");
  });

  test("the Equipped tab reflects what's actually equipped, and Storage is honest about not being tracked", async ({ page }) => {
    await mockSanctum(page, { equipped: [{ slot: "armor", itemId: "relic.tidewrack_band" }] });
    await page.goto("/#/sanctum?panel=relics");

    await page.getByTestId("relics-tab-equipped").click();
    await expect(page.getByTestId("relics-equipped-list")).toContainText("Tidewrack Band");

    await page.getByTestId("relics-tab-storage").click();
    await expect(page.getByText("Storage isn't tracked yet")).toBeVisible();
  });
});

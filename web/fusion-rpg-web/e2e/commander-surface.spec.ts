import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect, type Page, type Route } from "@playwright/test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const commanderListFixture = JSON.parse(
  readFileSync(join(__dirname, "fixtures", "commander-list.json"), "utf8")
) as {
  defaultLawnCommanderId: string;
  commanders: Array<Record<string, unknown>>;
};

const twoCommandersFixture = {
  defaultLawnCommanderId: "commander:dave",
  commanders: [
    {
      id: "commander:dave",
      displayName: "Crazy Dave",
      isDefault: true,
      activeAuraId: "Might",
      activeAuraName: "Might",
      locationStub: null,
      legionStub: null
    },
    {
      id: "commander:penny",
      displayName: "Penny",
      isDefault: false,
      activeAuraId: null,
      activeAuraName: null,
      locationStub: null,
      legionStub: null
    }
  ]
};

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
  items: [
    { instanceId: "a1", playerId: 1, side: "plant", typeId: 3, phase: "Roster", level: 5, xp: 10, revision: 1 }
  ]
};

let commanderList = structuredClone(commanderListFixture);

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function mockSanctum(page: Page, initialList = commanderListFixture) {
  commanderList = structuredClone(initialList);
  await page.route("**/hub/rpg**", (route) => route.abort());
  await page.route("**/health", (route) => fulfillJson(route, health));
  await page.route("**/api/players", (route) => fulfillJson(route, players));
  await page.route("**/api/players/current", (route) => fulfillJson(route, { ok: true }));
  await page.route("**/api/sim", (route) => fulfillJson(route, null, 404));
  await page.route("**/api/unique/actors**", (route) => fulfillJson(route, actors));
  await page.route("**/api/runs", (route) => fulfillJson(route, { items: [{ id: 1 }] }));
  await page.route("**/api/relics", (route) => fulfillJson(route, { items: [{ id: "r1" }] }));
  await page.route("**/api/creatures/roster/**", (route) => fulfillJson(route, { items: [] }));
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
  await page.route("**/api/commanders/**", (route) => {
    if (route.request().method() === "POST" && route.request().url().endsWith("/api/commanders/default")) {
      const body = route.request().postDataJSON() as { commanderId?: string };
      const nextId = body.commanderId ?? commanderList.defaultLawnCommanderId;
      commanderList = {
        defaultLawnCommanderId: nextId,
        commanders: commanderList.commanders.map((row) => ({
          ...row,
          isDefault: row.id === nextId
        }))
      };
      return fulfillJson(route, { defaultLawnCommanderId: nextId });
    }
    return fulfillJson(route, commanderList);
  });
}

async function appendDebugSnapshot(
  page: Page,
  commander: {
    leadingCommanderId?: string;
    leadingCommanderDisplayName: string;
    activeAuraDisplayName: string | null;
  }
) {
  await page.evaluate((payload) => {
    window.__fusionRpgAppendLogEvent?.({
      t: new Date().toISOString(),
      game: "pvzrh-e2e",
      kind: "debug.snapshot",
      matchKey: "e2e-mk",
      payload: {
        match: {
          phase: "InMatch",
          matchKey: "e2e-mk",
          commander: {
            leadingCommanderId: payload.leadingCommanderId ?? "commander:dave",
            leadingCommanderDisplayName: payload.leadingCommanderDisplayName,
            activeAuraId: payload.activeAuraDisplayName,
            activeAuraDisplayName: payload.activeAuraDisplayName
          }
        }
      }
    });
  }, commander);
}

test.describe("Commander surface program acceptance", () => {
  test("K and rail click open Commanders; Aptitudes is off the rail", async ({ page }) => {
    await mockSanctum(page);
    await page.goto("/#/sanctum");
    await expect(page.getByTestId("rail-commanders")).toBeVisible();
    await expect(page.getByTestId("rail-aptitudes")).toHaveCount(0);

    await page.getByTestId("rail-commanders").click();
    await expect(page.getByTestId("commanders-layer")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("commanders-layer")).not.toBeVisible();

    await page.keyboard.press("k");
    await expect(page.getByTestId("commanders-layer")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("commanders-layer")).not.toBeVisible();
  });

  test("Sanctum Leading line and Change commander opens the layer without gating Defend", async ({ page }) => {
    await mockSanctum(page);
    await page.goto("/#/sanctum");
    await expect(page.getByTestId("sanctum-home-leading-line")).toContainText("Garden Keeper");
    await page.getByTestId("sanctum-home-change-commander").click();
    await expect(page).toHaveURL(/panel=commanders/);
    await page.goto("/#/sanctum");
    await page.getByTestId("sanctum-home-defend").click();
    await expect(page).toHaveURL(/#\/lawn/);
  });

  test("Set default POSTs from the Commanders layer and Sanctum Leading updates on revisit", async ({ page }) => {
    await mockSanctum(page, twoCommandersFixture);
    await page.goto("/#/sanctum?panel=commanders");
    await page.getByTestId("commanders-row-commander-penny").click();
    await expect(page.getByTestId("actor-panel")).toBeVisible();
    await page.getByTestId("commander-sheet-set-default").click();
    await page.getByTestId("commander-sheet-close").click();
    await expect(page.getByTestId("commanders-default-badge-commander-penny")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("commanders-layer")).not.toBeVisible();
    await expect(page.getByTestId("sanctum-home-leading-line")).toContainText("Penny");
    await expect(page.getByTestId("sanctum-home-leading-line")).not.toContainText("Crazy Dave");

    await page.getByTestId("sanctum-home-defend").click();
    await expect(page).toHaveURL(/#\/lawn/);
  });

  test("lawn HUD shows snapshot chips and mid-match Set default POST does not alter them", async ({ page }) => {
    await mockSanctum(page, twoCommandersFixture);
    await page.goto("/#/lawn");
    await appendDebugSnapshot(page, { leadingCommanderDisplayName: "Crazy Dave", activeAuraDisplayName: "Might" });
    await expect(page.getByTestId("lawn-hud-commander")).toContainText("Crazy Dave");
    await expect(page.getByTestId("lawn-hud-aura")).toContainText("Might");

    await page.goto("/#/sanctum?panel=commanders");
    await page.getByTestId("commanders-row-commander-penny").click();
    await page.getByTestId("commander-sheet-set-default").click();
    await page.getByTestId("commander-sheet-close").click();
    await expect(page.getByTestId("commanders-default-badge-commander-penny")).toBeVisible();

    await page.goto("/#/lawn");
    await appendDebugSnapshot(page, { leadingCommanderDisplayName: "Crazy Dave", activeAuraDisplayName: "Might" });
    await expect(page.getByTestId("lawn-hud-commander")).toContainText("Crazy Dave");
    await expect(page.getByTestId("lawn-hud-aura")).toContainText("Might");
    await expect(page.getByTestId("lawn-hud-commander")).not.toContainText("Penny");
  });

  test("Set default from commander sheet updates list default badge", async ({ page }) => {
    await mockSanctum(page, twoCommandersFixture);
    await page.goto("/#/sanctum?panel=commanders");
    await page.getByTestId("commanders-row-commander-penny").click();
    await expect(page.getByTestId("actor-panel")).toBeVisible();
    await expect(page.getByTestId("actor-panel-deploy")).toHaveCount(0);
    await expect(page.getByTestId("actor-panel-release")).toHaveCount(0);
    await page.getByTestId("commander-sheet-set-default").click();
    await page.getByTestId("commander-sheet-close").click();
    await expect(page.getByTestId("commanders-default-badge-commander-penny")).toBeVisible();
  });

  test("Defend from commander sheet navigates to the lawn", async ({ page }) => {
    await mockSanctum(page, twoCommandersFixture);
    await page.goto("/#/sanctum?panel=commanders");
    await page.getByTestId("commanders-row-commander-dave").click();
    await expect(page.getByTestId("actor-panel")).toBeVisible();
    await page.getByTestId("commander-sheet-defend").click();
    await expect(page).toHaveURL(/#\/lawn/);
  });

  test("deep link with sel opens the commander sheet immediately", async ({ page }) => {
    await mockSanctum(page, twoCommandersFixture);
    await page.goto("/#/sanctum?panel=commanders&sel=commander%3Apenny");
    await expect(page.getByTestId("actor-panel")).toBeVisible();
    await expect(page.getByTestId("commanders-row-commander-penny")).toHaveAttribute("aria-current", "true");
    await expect(page.getByTestId("actor-panel-deploy")).toHaveCount(0);
    await expect(page.getByTestId("actor-panel-release")).toHaveCount(0);
  });

  test("lawn sheet change in list navigates to Commanders with sel", async ({ page }) => {
    await mockSanctum(page, twoCommandersFixture);
    await page.goto("/#/lawn");
    await appendDebugSnapshot(page, { leadingCommanderDisplayName: "Crazy Dave", activeAuraDisplayName: "Might" });
    await page.getByTestId("lawn-hud-commander-open").click();
    await expect(page.getByTestId("actor-panel")).toBeVisible();
    await page.getByTestId("commander-sheet-change-in-list").click();
    await expect(page).toHaveURL(/panel=commanders/);
    await expect(page).toHaveURL(/sel=commander%3Adave/);
    await expect(page.getByTestId("commanders-layer")).toBeVisible();
  });

  test("lawn HUD tap opens commander sheet with this-match banner", async ({ page }) => {
    await mockSanctum(page, twoCommandersFixture);
    await page.goto("/#/lawn");
    await appendDebugSnapshot(page, { leadingCommanderDisplayName: "Crazy Dave", activeAuraDisplayName: "Might" });
    await page.getByTestId("lawn-hud-commander-open").click();
    await expect(page.getByTestId("commander-sheet-match-banner")).toContainText("This match: Crazy Dave · Might");
    await expect(page.getByTestId("commander-sheet-set-default")).toContainText("next run");
  });

  test("Set default from lawn sheet updates Sanctum Leading but not mid-match HUD chips", async ({ page }) => {
    await mockSanctum(page, twoCommandersFixture);
    await page.goto("/#/sanctum?panel=commanders");
    await page.getByTestId("commanders-row-commander-penny").click();
    await page.getByTestId("commander-sheet-set-default").click();
    await page.getByTestId("commander-sheet-close").click();
    await page.goto("/#/lawn");
    await appendDebugSnapshot(page, { leadingCommanderDisplayName: "Crazy Dave", activeAuraDisplayName: "Might" });
    await page.getByTestId("lawn-hud-commander-open").click();
    await page.getByTestId("commander-sheet-set-default").click();
    await page.getByTestId("commander-sheet-close").click();
    await page.goto("/#/sanctum");
    await expect(page.getByTestId("sanctum-home-leading-line")).toContainText("Crazy Dave");
    await expect(page.getByTestId("sanctum-home-leading-line")).not.toContainText("Penny");

    await page.goto("/#/lawn");
    await appendDebugSnapshot(page, { leadingCommanderDisplayName: "Crazy Dave", activeAuraDisplayName: "Might" });
    await expect(page.getByTestId("lawn-hud-commander")).toContainText("Crazy Dave");
    await expect(page.getByTestId("lawn-hud-commander")).not.toContainText("Penny");
  });
});

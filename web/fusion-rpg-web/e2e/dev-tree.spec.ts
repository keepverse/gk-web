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

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function mockShell(page: Page) {
  await page.route("**/hub/rpg**", (route) => route.abort());
  await page.route("**/health", (route) => fulfillJson(route, health));
  await page.route("**/api/players", (route) => fulfillJson(route, players));
  await page.route("**/api/players/current", (route) => fulfillJson(route, { ok: true }));
  await page.route("**/api/sim", (route) => fulfillJson(route, null, 404));
  await page.route("**/api/unique/actors**", (route) => fulfillJson(route, { playerId: 1, items: [] }));
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
}

const OLD_ROUTES = [
  "status",
  "stats",
  "pvz-activity",
  "icon-dump",
  "almanac-dump",
  "cheats",
  "sim",
  "log",
  "runs"
] as const;

test.describe("Developer tree (T12)", () => {
  test("off by default: backtick does nothing until ?devmode=1 has enabled the gate", async ({ page }) => {
    await mockShell(page);
    await page.goto("/#/sanctum");
    await expect(page.getByTestId("sanctum-hud")).toBeVisible();

    await page.keyboard.press("`");
    await expect(page.getByTestId("dev-tree")).not.toBeVisible();
  });

  test("?devmode=1 enables the gate (persisted), strips itself from the URL, and backtick then opens the tree", async ({ page }) => {
    await mockShell(page);
    await page.goto("/#/sanctum?devmode=1");
    await expect(page).toHaveURL(/#\/sanctum(?!.*devmode)/);

    await page.keyboard.press("`");
    await expect(page.getByTestId("dev-tree")).toBeVisible();
    await expect(page.getByTestId("dev-tree-surface-status")).toBeVisible();

    // Second press closes it — the T12 stale-setSearchParams-closure bug fixed this turn.
    await page.keyboard.press("`");
    await expect(page.getByTestId("dev-tree")).not.toBeVisible();

    // A third press proves it isn't a one-shot toggle: it reopens cleanly.
    await page.keyboard.press("`");
    await expect(page.getByTestId("dev-tree")).toBeVisible();
  });

  test("the gate survives reload: backtick still opens the tree on a fresh navigation", async ({ page }) => {
    await mockShell(page);
    await page.goto("/#/sanctum?devmode=1");
    await expect(page).toHaveURL(/#\/sanctum(?!.*devmode)/);

    await page.goto("/#/sanctum");
    await page.keyboard.press("`");
    await expect(page.getByTestId("dev-tree")).toBeVisible();
  });

  test("?dev=<id> deep-links directly onto that tab, and every old route redirects there", async ({ page }) => {
    await mockShell(page);
    await page.goto("/#/sanctum?dev=cheats");
    await expect(page.getByTestId("dev-tree")).toBeVisible();
    await expect(page.getByTestId("dev-tree-surface-cheats")).toBeVisible();

    for (const id of OLD_ROUTES) {
      await page.goto(`/#/${id}`);
      await expect(page).toHaveURL(new RegExp(`#/sanctum\\?dev=${id}`));
      await expect(page.getByTestId("dev-tree")).toBeVisible();
      await expect(page.getByTestId(`dev-tree-surface-${id}`)).toBeVisible();
    }
    // `/metrics` used to alias here too; as of T19 it redirects to the real Chronicle "Runs" tab
    // instead (almanac-chronicle.spec.ts) — `runs` above already covers the dev tree's own surface.
  });

  test("switching tabs inside the tree updates the surface without leaving the tree", async ({ page }) => {
    await mockShell(page);
    await page.goto("/#/sanctum?dev=status");
    await expect(page.getByTestId("dev-tree-surface-status")).toBeVisible();

    await page.getByTestId("dev-tree-tab-log").click();
    await expect(page.getByTestId("dev-tree-surface-log")).toBeVisible();
    await expect(page.getByTestId("dev-tree-surface-status")).not.toBeVisible();
  });

  test("Esc closes the tree like any other band-2 layer, and the stage underneath stays mounted", async ({ page }) => {
    await mockShell(page);
    await page.goto("/#/sanctum?dev=status");
    await expect(page.getByTestId("dev-tree")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("dev-tree")).not.toBeVisible();
    await expect(page.getByTestId("sanctum-hud")).toBeVisible();
  });

  test("none of the nine developer surfaces appear in player navigation", async ({ page }) => {
    await mockShell(page);
    await page.goto("/#/sanctum");
    // AuditNav (the flat leftover sidebar) is gone entirely (GG-40, foundation.html F.2) — the
    // developer tree lives behind its own gate, not any standing player-facing nav.
    const shell = page.getByTestId("shell-body");
    for (const label of ["Status", "Stats", "PvzActivity", "IconDump", "AlmanacText", "Cheats", "Sim", "Log", "Runs"]) {
      await expect(shell.getByText(label, { exact: true })).toHaveCount(0);
    }
  });
});

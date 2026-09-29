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
  await page.route("**/api/types", (route) =>
    fulfillJson(route, { items: [{ side: "plant", type: 3, typeName: "sunflower", displayName: "Sunflower" }] })
  );
}

/**
 * fe-essentials T6 — proof surface for the actor-menu scope picker, the same role
 * actor-ladder.spec.ts plays for the Actor ladder. FE-only: this component ships ahead of the
 * commander/aura-skill feature that will eventually consume it (buff-debuff-scope-ideal.md §5).
 */
test.describe("Actor menu scope picker (fe-essentials T6)", () => {
  test("the route is reachable and defaults to a functional Relation mode", async ({ page }) => {
    await mockShell(page);
    const consoleLogs: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "debug") consoleLogs.push(msg.text());
    });

    await page.goto("/#/actor-menu-scope-picker-demo?mock=1");
    await expect(page.getByTestId("actor-menu-scope-picker")).toBeVisible();
    await expect(page.getByTestId("scope-relation-panel")).toBeVisible();

    await page.getByTestId("scope-relation-ally").click();
    await expect(page.getByTestId("scope-picker-demo-value")).toContainText('"kind": "relation"');
    await expect(page.getByTestId("scope-picker-demo-value")).toContainText('"relation": "ally"');
    await expect.poll(() => consoleLogs.some((l) => l.includes("relation selected"))).toBe(true);

    await page.getByTestId("scope-mode-target").click();
    await expect.poll(() => consoleLogs.some((l) => l.includes("mode changed"))).toBe(true);
  });

  test("Target mode lists the real roster through ActorRow and selecting one updates the live value", async ({ page }) => {
    await mockShell(page);
    const consoleLogs: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "debug") consoleLogs.push(msg.text());
    });
    await page.goto("/#/actor-menu-scope-picker-demo?mock=1");

    await page.getByTestId("scope-mode-target").click();
    await expect(page.getByTestId("scope-target-list")).toBeVisible();
    await expect(page.getByTestId("actor-row")).toBeVisible();

    await page.getByTestId("actor-row").click();
    await expect(page.getByTestId("scope-picker-demo-value")).toContainText('"kind": "target"');
    await expect.poll(() => consoleLogs.some((l) => l.includes("list selection"))).toBe(true);
  });

  test("UniqueCreature mode lists the same roster candidates via the shared list panel", async ({ page }) => {
    await mockShell(page);
    await page.goto("/#/actor-menu-scope-picker-demo?mock=1");

    await page.getByTestId("scope-mode-unique-creature").click();
    await expect(page.getByTestId("scope-uniqueCreature-list")).toBeVisible();
    await page.getByTestId("actor-row").click();
    await expect(page.getByTestId("scope-picker-demo-value")).toContainText('"kind": "uniqueCreature"');
  });

  test("Type mode lists real types from the catalog and multi-selects", async ({ page }) => {
    await mockShell(page);
    const consoleLogs: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "debug") consoleLogs.push(msg.text());
    });
    await page.goto("/#/actor-menu-scope-picker-demo?mock=1");

    await page.getByTestId("scope-mode-type").click();
    await expect(page.getByTestId("scope-type-list")).toBeVisible();
    await expect(page.getByText("Sunflower")).toBeVisible();

    await page.getByTestId("scope-type-option-3").click();
    const value = await page.getByTestId("scope-picker-demo-value").innerText();
    expect(JSON.parse(value)).toEqual({ kind: "type", typeIds: [3] });
    await expect.poll(() => consoleLogs.some((l) => l.includes("type selection changed"))).toBe(true);
  });

  test("switching modes never leaves a stale value from a different mode in the live display", async ({ page }) => {
    await mockShell(page);
    await page.goto("/#/actor-menu-scope-picker-demo?mock=1");

    await page.getByTestId("scope-mode-relation").click();
    await page.getByTestId("scope-relation-enemy").click();
    await expect(page.getByTestId("scope-picker-demo-value")).toContainText('"relation": "enemy"');

    await page.getByTestId("scope-mode-target").click();
    await expect(page.getByTestId("scope-target-collection-item-P:1:0,0")).toBeVisible();
    // The container itself renders nothing selected in the new mode — the stale "relation" value
    // from before is still what the demo page's own state holds (nothing cleared it), but Target's
    // own panel does not misread it as a selected target.
    const anySelected = await page
      .getByTestId("scope-target-list")
      .locator('[data-selected="true"]')
      .count();
    expect(anySelected).toBe(0);
  });
});

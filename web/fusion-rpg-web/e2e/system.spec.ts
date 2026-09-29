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

async function mockSanctum(page: Page) {
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

test.describe("System layer (T20)", () => {
  test("Esc on an empty stack opens System (GG-5 Shell/System row)", async ({ page }) => {
    await mockSanctum(page);
    await page.goto("/#/sanctum");
    await expect(page.getByTestId("sanctum-hud")).toBeVisible();
    await expect(page.getByTestId("system-layer")).not.toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("system-layer")).toBeVisible();
    await expect(page.getByTestId("sanctum-hud")).toBeVisible(); // stage stays mounted underneath
  });

  test("Esc with a layer open pops that layer instead of reaching System", async ({ page }) => {
    await mockSanctum(page);
    await page.goto("/#/sanctum");
    await page.getByTestId("rail-creatures").click();
    await expect(page.getByTestId("creatures-layer")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("creatures-layer")).not.toBeVisible();
    await expect(page.getByTestId("system-layer")).not.toBeVisible();
  });

  test("a preference toggle survives a reload", async ({ page }) => {
    await mockSanctum(page);
    await page.goto("/#/sanctum?system=1");
    await expect(page.getByTestId("system-layer")).toBeVisible();

    const toggle = page.getByTestId("pref-damage-numbers");
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "false");

    await page.reload();
    await expect(page.getByTestId("pref-damage-numbers")).toHaveAttribute("aria-checked", "false");
  });

  test("Developer mode toggle in System is the same flag the T12 backtick gate reads", async ({ page }) => {
    await mockSanctum(page);
    await page.goto("/#/sanctum?system=1");
    await page.getByTestId("pref-developer-mode").click();
    await expect(page.getByTestId("pref-developer-mode")).toHaveAttribute("aria-checked", "true");

    await page.getByTestId("system-done").click();
    await expect(page.getByTestId("system-layer")).not.toBeVisible();

    await page.keyboard.press("`");
    await expect(page.getByTestId("dev-tree")).toBeVisible();
  });

  test("rebinding Creatures to a free key changes what the app actually registers, live (GG-20)", async ({ page }) => {
    await mockSanctum(page);
    await page.goto("/#/sanctum?system=1");
    await page.getByTestId("system-tab-controls").click();
    await page.getByTestId("keybind-change-creatures").click();
    await page.keyboard.press("z");
    await expect(page.getByTestId("keybind-key-creatures")).toHaveText("z");

    await page.getByTestId("system-done").click();
    await expect(page.getByTestId("system-layer")).not.toBeVisible();

    // The old key no longer does anything...
    await page.keyboard.press("c");
    await expect(page.getByTestId("creatures-layer")).not.toBeVisible();

    // ...and the new one opens Creatures, with no reload in between.
    await page.keyboard.press("z");
    await expect(page.getByTestId("creatures-layer")).toBeVisible();
  });

  test("rebinding onto a key another action holds shows the conflict and swaps on Take it", async ({ page }) => {
    await mockSanctum(page);
    await page.goto("/#/sanctum?system=1");
    await page.getByTestId("system-tab-controls").click();
    await page.getByTestId("keybind-change-creatures").click();
    await page.keyboard.press("r"); // Relics' default key

    await expect(page.getByTestId("keybind-conflict")).toBeVisible();
    await expect(page.getByTestId("keybind-conflict-reason")).toContainText("Relics");
    await expect(page.getByTestId("keybind-key-creatures")).toHaveText("c"); // not yet committed

    await page.getByTestId("keybind-conflict-take").click();
    await expect(page.getByTestId("keybind-key-creatures")).toHaveText("r");
    await expect(page.getByTestId("keybind-key-relics")).toHaveText("c"); // swapped, not left colliding
  });

  test("the reserved launcher key is listed and refuses to be bound", async ({ page }) => {
    await mockSanctum(page);
    await page.goto("/#/sanctum?system=1");
    await page.getByTestId("system-tab-controls").click();
    await expect(page.getByTestId("keybind-key-reserved-f10")).toContainText("F10");

    await page.getByTestId("keybind-change-creatures").click();
    await page.keyboard.press("F10");
    await expect(page.getByTestId("keybind-reserved-refusal")).toBeVisible();
    await expect(page.getByTestId("keybind-key-creatures")).toHaveText("c");
  });

  test("Reset to defaults restores every binding, including one already rebound", async ({ page }) => {
    await mockSanctum(page);
    await page.goto("/#/sanctum?system=1");
    await page.getByTestId("system-tab-controls").click();
    await page.getByTestId("keybind-change-creatures").click();
    await page.keyboard.press("z");
    await expect(page.getByTestId("keybind-key-creatures")).toHaveText("z");

    await page.getByTestId("keybind-reset").click();
    await expect(page.getByTestId("keybind-key-creatures")).toHaveText("c");
  });
});

// T29 (plate 06 §C): Display/Sound/Advanced tabs, the connection row, and Quit to title — added
// after the visual-completeness audit (2026-08-24) found only Game and Controls existed.
test.describe("System layer — plate parity (T29)", () => {
  test("every tab is reachable except Sound, which states its reason", async ({ page }) => {
    await mockSanctum(page);
    await page.goto("/#/sanctum?system=1");

    await expect(page.getByTestId("system-tab-sound")).toBeDisabled();
    await expect(page.getByTestId("system-tab-sound")).toHaveAttribute("title", /audio pipeline/);

    for (const tab of ["display", "advanced", "controls", "preferences"]) {
      await page.getByTestId(`system-tab-${tab}`).click();
      await expect(page.getByTestId(`system-surface-${tab}`)).toBeVisible();
    }
  });

  test("Reduce motion and Language on the Display tab are real controls that persist", async ({ page }) => {
    await mockSanctum(page);
    await page.goto("/#/sanctum?system=1");
    await page.getByTestId("system-tab-display").click();

    await page.getByTestId("pref-reduce-motion-on").click();
    await expect(page.getByTestId("pref-reduce-motion-on")).toHaveAttribute("aria-current", "true");

    await page.reload();
    await page.getByTestId("system-tab-display").click();
    await expect(page.getByTestId("pref-reduce-motion-on")).toHaveAttribute("aria-current", "true");
  });

  test("the connection row reflects the mocked health state, and Details reveals the raw fields", async ({ page }) => {
    await mockSanctum(page);
    await page.goto("/#/sanctum?system=1");
    // mockSanctum aborts **/hub/rpg** (every fixture in this suite does, to avoid a real SignalR
    // connection), so the honest state here is REST-healthy but the live channel down — "degraded",
    // not "healthy". A real production connection would show "healthy" once the hub connects.
    await expect(page.getByTestId("system-connection-tag")).toHaveText("degraded");
    await expect(page.getByTestId("system-connection-summary")).toContainText("Sanctum reachable");
    await expect(page.getByTestId("system-connection-summary")).toContainText("poll fallback");

    await page.getByTestId("system-connection-details-toggle").click();
    await expect(page.getByTestId("system-connection-details")).toBeVisible();
    await expect(page.getByTestId("system-connection-details")).toContainText("none"); // health.source fixture value
  });

  test("Advanced shows the real API base and resets preferences for real", async ({ page }) => {
    await mockSanctum(page);
    await page.goto("/#/sanctum?system=1");
    await page.getByTestId("pref-damage-numbers").click();
    await expect(page.getByTestId("pref-damage-numbers")).toHaveAttribute("aria-checked", "false");

    await page.getByTestId("system-tab-advanced").click();
    await expect(page.getByTestId("system-advanced-api-base")).not.toBeEmpty();
    await page.getByTestId("system-reset-preferences").click();

    await page.getByTestId("system-tab-preferences").click();
    await expect(page.getByTestId("pref-damage-numbers")).toHaveAttribute("aria-checked", "true");
  });

  // fe-essentials: the Title screen this button was waiting on now exists (plate 01 §A).
  test("Quit to title closes Settings and navigates to the real Title screen", async ({ page }) => {
    await mockSanctum(page);
    await page.goto("/#/sanctum?system=1");
    await expect(page.getByTestId("system-quit-to-title")).not.toBeDisabled();
    await page.getByTestId("system-quit-to-title").click();
    await expect(page.getByTestId("system-layer")).not.toBeVisible();
    await expect(page).toHaveURL(/#\/$/);
    await expect(page.getByTestId("title-screen")).toBeVisible();
  });
});

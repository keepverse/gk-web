import { test, expect } from "@playwright/test";
import { mockShell, fulfillJson } from "./helpers/mock-shell";

const FIXTURE_INSTANCE_ID = "fixture-actor-1";
const APTITUDE_IDS = [
  "Might",
  "Fortitude",
  "Vigor",
  "Onslaught",
  "Agility",
  "Composure",
  "Pierce",
  "Focus",
  "Bulwark",
  "Retribution",
  "Precision",
  "Ferocity"
] as const;

const VIEWPORTS = [
  { name: "desktop-1440", width: 1440, height: 900 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "mobile-390", width: 390, height: 844 }
] as const;

function evenRows() {
  return APTITUDE_IDS.map((aptitudeId, i) => ({
    aptitudeId,
    targetPermille: 83 + (i < 4 ? 1 : 0)
  }));
}

function evenShares(budget: number) {
  const shares: Record<string, number> = {};
  let spent = 0;
  for (const id of APTITUDE_IDS) {
    const pm = evenRows().find((r) => r.aptitudeId === id)!.targetPermille;
    const v = Math.trunc((budget * pm) / 1000);
    shares[id] = v;
    spent += v;
  }
  return { shares, leftover: budget - spent, spent };
}

async function mockPresetApis(page: import("@playwright/test").Page) {
  let uniqueShares: Record<string, number> = Object.fromEntries(APTITUDE_IDS.map((id) => [id, id === "Might" ? 10 : 0]));
  let uniqueSpent = 10;
  let library: {
    presetId: string;
    playerId: number;
    name: string;
    kind: string;
    rows: ReturnType<typeof evenRows>;
  }[] = [];
  let activePresetId: string | null = null;
  const budget = 200;

  await page.route("**/api/aptitudes/unique/**", async (route) => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON() as { shares: Record<string, number> };
      uniqueShares = body.shares;
      uniqueSpent = Object.values(uniqueShares).reduce((a, b) => a + b, 0);
    }
    await fulfillJson(route, {
      instanceId: FIXTURE_INSTANCE_ID,
      playerId: 1,
      specimenLevel: 10,
      budget,
      spent: uniqueSpent,
      leftover: budget - uniqueSpent,
      withinBudget: uniqueSpent <= budget,
      shares: uniqueShares,
      theta: 10
    });
  });

  await page.route("**/api/aptitudes/**", (route) => {
    if (route.request().url().includes("/unique/")) return route.fallback();
    return fulfillJson(route, {
      theta: 100,
      budget: 300,
      spent: 0,
      withinBudget: true,
      shares: Object.fromEntries(APTITUDE_IDS.map((id) => [id, 0]))
    });
  });

  await page.route("**/api/aptitude-presets/**", async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (url.includes("/favour/")) {
      await fulfillJson(route, { sharesPermille: {} });
      return;
    }
    if (url.includes("/active")) {
      await fulfillJson(route, {
        playerId: 1,
        scope: "unique",
        scopeKey: FIXTURE_INSTANCE_ID,
        presetId: activePresetId
      });
      return;
    }
    if (url.includes("/materialize") && method === "POST") {
      const body = route.request().postDataJSON() as { presetId: string; budget: number };
      const mat = evenShares(body.budget);
      await fulfillJson(route, {
        presetId: body.presetId,
        budget: body.budget,
        shares: mat.shares,
        leftover: mat.leftover
      });
      return;
    }
    if (url.includes("/activate") && method === "POST") {
      const body = route.request().postDataJSON() as { presetId: string };
      activePresetId = body.presetId;
      const mat = evenShares(budget);
      uniqueShares = mat.shares;
      uniqueSpent = mat.spent;
      await fulfillJson(route, {
        playerId: 1,
        presetId: body.presetId,
        scope: "unique",
        scopeKey: FIXTURE_INSTANCE_ID,
        budget,
        shares: mat.shares,
        leftover: mat.leftover
      });
      return;
    }
    if (method === "POST" && !url.includes("/materialize") && !url.includes("/activate")) {
      const body = route.request().postDataJSON() as {
        playerId: number;
        name: string;
        rows: ReturnType<typeof evenRows>;
      };
      const presetId = `preset-${library.length + 1}`;
      const row = {
        presetId,
        playerId: body.playerId,
        name: body.name,
        kind: "player",
        rows: body.rows ?? evenRows()
      };
      library = [...library, row];
      await fulfillJson(route, row);
      return;
    }
    // GET library
    await fulfillJson(route, { presets: library });
  });
}

test.describe("Aptitude preset console (AS-3.4/3.5)", () => {
  test("open → save → activate commits UniqueCreature via activate API only", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockShell(page);
    await mockPresetApis(page);

    await page.goto("/#/actor-ladder-demo?mock=1");
    await page.getByTestId("actor-ladder-open-panel").click();
    await page.getByTestId("actor-sheet-tab-aptitudes").click();
    await expect(page.getByTestId("preset-entry")).toBeVisible();

    await page.getByTestId("preset-entry").click();
    await expect(page.getByTestId("aptitude-preset-console")).toBeVisible();
    await expect(page.getByTestId("preset-editor-sum")).toHaveAttribute("data-sum-ok", "true");
    await expect(page.getByTestId("preset-distribution-chart")).toBeVisible();

    await page.getByTestId("preset-editor-name").fill("E2E Even");
    const saveReq = page.waitForRequest(
      (r) => r.url().includes("/api/aptitude-presets") && r.method() === "POST" && !r.url().includes("activate")
    );
    await page.getByTestId("preset-save").click();
    await saveReq;

    await expect(page.getByTestId("preset-gallery-item-preset-1")).toBeVisible();
    await page.getByTestId("preset-gallery-item-preset-1").click();

    const activateReq = page.waitForRequest(
      (r) => r.url().includes("/api/aptitude-presets/activate") && r.method() === "POST"
    );
    // Ensure no allocate POST races Activate
    let allocatePosted = false;
    page.on("request", (r) => {
      if (r.url().includes("/api/aptitudes/unique/") && r.method() === "POST") allocatePosted = true;
    });
    await page.getByTestId("preset-activate").click();
    const act = await activateReq;
    const actBody = act.postDataJSON() as { scope: string; scopeKey: string; presetId: string };
    expect(actBody.scope).toBe("unique");
    expect(actBody.scopeKey).toBe(FIXTURE_INSTANCE_ID);
    expect(actBody.presetId).toBe("preset-1");
    expect(allocatePosted).toBe(false);

    await expect(page.getByTestId("aptitude-preset-console")).toHaveCount(0);
    await expect(page.getByTestId("aptitude-value-Might")).not.toHaveText("10");

    const obs = await page.evaluate(() => window.__fusionRpgAptitudeObs ?? []);
    expect(obs.some((e) => e.channel === "preset.open.opened")).toBe(true);
    expect(obs.some((e) => e.channel === "preset.activate.done")).toBe(true);
  });

  test("Apply to draft dirties allocate without activate; Save blocked when sum ≠ 1000", async ({
    page
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockShell(page);
    await mockPresetApis(page);

    await page.goto("/#/actor-ladder-demo?mock=1");
    await page.getByTestId("actor-ladder-open-panel").click();
    await page.getByTestId("actor-sheet-tab-aptitudes").click();
    await page.getByTestId("preset-entry").click();

    await page.getByTestId("preset-editor-name").fill("Draftable");
    await page.getByTestId("preset-save").click();
    await expect(page.getByTestId("preset-gallery-item-preset-1")).toBeVisible();
    await page.getByTestId("preset-gallery-item-preset-1").click();

    const mat = page.waitForRequest((r) => r.url().includes("/materialize") && r.method() === "POST");
    await page.getByTestId("preset-apply-draft").click();
    await mat;
    await expect(page.getByTestId("allocate-decision-confirm")).toBeEnabled();

    await page.getByTestId("preset-entry").click();
    await page.getByTestId("preset-editor-targetPermille-Might").fill("1");
    await expect(page.getByTestId("preset-editor-sum")).toHaveAttribute("data-sum-ok", "false");
    await expect(page.getByTestId("preset-save")).toBeDisabled();
  });

  for (const vp of VIEWPORTS) {
    test(`visual ${vp.name}: preset console gallery/editor/donut`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await mockShell(page);
      await mockPresetApis(page);
      await page.goto("/#/actor-ladder-demo?mock=1");
      await page.getByTestId("actor-ladder-open-panel").click();
      await page.getByTestId("actor-sheet-tab-aptitudes").click();
      await page.getByTestId("preset-entry").click();
      await expect(page.getByTestId("aptitude-preset-console")).toBeVisible();
      await expect(page.getByTestId("preset-gallery")).toBeVisible();
      await expect(page.getByTestId("preset-editor")).toBeVisible();
      await expect(page.getByTestId("preset-action-strip")).toBeVisible();
      await expect(page.getByTestId("preset-distribution-chart")).toBeVisible();
      // Sticky footer actions must not be clipped by the scroll body
      const actionsBox = await page.getByTestId("preset-action-strip").boundingBox();
      const vpHeight = page.viewportSize()?.height ?? 0;
      expect(actionsBox).toBeTruthy();
      expect(actionsBox!.y + actionsBox!.height).toBeLessThanOrEqual(vpHeight + 1);

      const shot = `e2e/artifacts/aptitude-preset-${vp.name}.png`;
      await page.screenshot({ path: shot, fullPage: false });

      const consoleBox = await page.getByTestId("aptitude-preset-console").boundingBox();
      expect(consoleBox).toBeTruthy();
      expect(consoleBox!.width).toBeGreaterThan(200);
      expect(consoleBox!.height).toBeGreaterThan(120);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
      );
      expect(overflow).toBe(false);
    });
  }
});

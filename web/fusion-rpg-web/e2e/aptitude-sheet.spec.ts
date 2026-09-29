import { test, expect } from "@playwright/test";
import { mockShell, fulfillJson } from "./helpers/mock-shell";

const FIXTURE_INSTANCE_ID = "fixture-actor-1";
const FIXTURE_LEVEL = 1;

const VIEWPORTS = [
  { name: "desktop-1440", width: 1440, height: 900 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "mobile-390", width: 390, height: 844 }
] as const;

const twelveShares = () => {
  const shares: Record<string, number> = {
    Might: 10,
    Fortitude: 5,
    Vigor: 0,
    Onslaught: 0,
    Agility: 5,
    Composure: 0,
    Pierce: 0,
    Focus: 0,
    Bulwark: 0,
    Retribution: 0,
    Precision: 0,
    Ferocity: 0
  };
  return shares;
};

async function mockAptitudeApis(page: import("@playwright/test").Page) {
  let uniqueShares = twelveShares();
  let uniqueSpent = 20;

  await page.route("**/api/aptitudes/unique/**", async (route) => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON() as { shares: Record<string, number> };
      uniqueShares = body.shares;
      uniqueSpent = Object.values(uniqueShares).reduce((a, b) => a + b, 0);
      await fulfillJson(route, {
        instanceId: FIXTURE_INSTANCE_ID,
        playerId: 1,
        specimenLevel: FIXTURE_LEVEL,
        budget: 200,
        spent: uniqueSpent,
        leftover: 200 - uniqueSpent,
        withinBudget: uniqueSpent <= 200,
        shares: uniqueShares,
        theta: FIXTURE_LEVEL
      });
      return;
    }
    await fulfillJson(route, {
      instanceId: FIXTURE_INSTANCE_ID,
      playerId: 1,
      specimenLevel: FIXTURE_LEVEL,
      budget: 200,
      spent: uniqueSpent,
      leftover: 200 - uniqueSpent,
      withinBudget: true,
      shares: uniqueShares,
      theta: FIXTURE_LEVEL
    });
  });

  await page.route("**/api/aptitudes/**", (route) => {
    if (route.request().url().includes("/unique/")) return route.fallback();
    return fulfillJson(route, {
      theta: 100,
      budget: 300,
      spent: 10,
      withinBudget: true,
      shares: { Might: 10 }
    });
  });
}

test.describe("Aptitude sheet Mode A (UniqueCreature)", () => {
  for (const vp of VIEWPORTS) {
    test(`visual ${vp.name}: leftover in-band, Cancel fiction, Unique scope`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await mockShell(page);
      await mockAptitudeApis(page);

      await page.goto("/#/actor-ladder-demo?mock=1");
      await page.getByTestId("actor-ladder-open-panel").click();
      await page.getByTestId("actor-sheet-tab-aptitudes").click();

      await expect(page.getByTestId("aptitudes-tab")).toHaveAttribute("data-mode", "unique");
      await expect(page.getByTestId("aptitudes-scope-chip")).toContainText("Unique specimen");
      await expect(page.getByTestId("leftover-gauge")).toBeVisible();
      await expect(page.getByTestId("allocate-decision-cancel")).toContainText("Cancel");
      await expect(page.getByTestId("aptitude-icon-Might")).toBeVisible();
      await expect(page.getByTestId("aptitude-posture-force")).toContainText("Force");

      const shot = `e2e/artifacts/aptitude-sheet-${vp.name}.png`;
      await page.screenshot({ path: shot, fullPage: false });

      // Layout: no page horizontal overflow; leftover hero above bands
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
      );
      expect(overflow).toBe(false);

      const leftoverBox = await page.getByTestId("leftover-gauge").boundingBox();
      const bandsBox = await page.getByTestId("aptitudes-bands").boundingBox();
      expect(leftoverBox).toBeTruthy();
      expect(bandsBox).toBeTruthy();
      expect(leftoverBox!.y).toBeLessThan(bandsBox!.y);
    });
  }

  test("increment → Confirm posts UniqueCreature allocate; Cancel reverts; obs ring", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockShell(page);
    await mockAptitudeApis(page);

    await page.goto("/#/actor-ladder-demo?mock=1");
    await page.getByTestId("actor-ladder-open-panel").click();
    await page.getByTestId("actor-sheet-tab-aptitudes").click();

    const before = await page.getByTestId("aptitude-value-Might").textContent();
    await page.getByTestId("aptitude-inc-Might").click();
    await expect(page.getByTestId("aptitude-value-Might")).not.toHaveText(before ?? "");

    await expect(page.getByTestId("allocate-decision-confirm")).toBeEnabled();
    const post = page.waitForRequest(
      (r) => r.url().includes("/api/aptitudes/unique/") && r.method() === "POST"
    );
    await page.getByTestId("allocate-decision-confirm").click();
    const req = await post;
    const body = req.postDataJSON() as { instanceId: string; shares: Record<string, number> };
    expect(body.instanceId).toBe(FIXTURE_INSTANCE_ID);
    expect(body.shares.Might).toBeGreaterThan(10);

    await page.getByTestId("aptitude-inc-Might").click();
    await page.getByTestId("allocate-decision-cancel").click();
    await expect(page.getByTestId("aptitude-value-Might")).toHaveText(String(body.shares.Might));

    const obs = await page.evaluate(() => window.__fusionRpgAptitudeObs ?? []);
    expect(obs.some((e) => e.channel === "aptitude.mode.bind")).toBe(true);
    expect(obs.some((e) => e.channel === "aptitude.confirm")).toBe(true);
  });

  test("shell mirror Cancel label (S8)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockShell(page);
    await mockAptitudeApis(page);
    await page.goto("/#/actor-ladder-demo?mock=1");
    await page.getByTestId("actor-ladder-open-panel").click();
    await page.getByTestId("actor-sheet-tab-aptitudes").click();
    await page.getByTestId("aptitude-inc-Might").click();
    await expect(page.getByTestId("actor-leftover-cancel")).toContainText("Cancel");
    await expect(page.getByTestId("actor-leftover-footer")).toBeVisible();
  });
});

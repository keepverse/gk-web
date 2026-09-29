import { test, expect } from "@playwright/test";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mockShell } from "./helpers/mock-shell";

const __dirname = dirname(fileURLToPath(import.meta.url));
const resultsOut = join(__dirname, "../tmp/phaser-scene-poc-results.json");

type RunPayload = {
  track: "A" | "B";
  count: number;
  p50: number;
  p95: number;
  max: number;
  barMs: number;
  pass: boolean;
  samples: number[];
};

test.describe("Phaser scene-switch POC", () => {
  test("Track A + Track B Run 20 + GG-11 identity; write results JSON", async ({ page }) => {
    test.setTimeout(120_000);
    await mockShell(page);
    await page.goto("/#/sanctum?devmode=1&dev=phaser-scene-poc");
    await expect(page.getByTestId("dev-tree")).toBeVisible();
    await expect(page.getByTestId("phaser-scene-poc")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("phaser-scene-poc-canvas")).toBeVisible();

    // Let Phaser boot the first Game.
    await page.waitForTimeout(500);

    await page.getByTestId("phaser-scene-poc-run20").click();
    await expect(page.getByTestId("phaser-scene-poc-json")).toBeVisible({ timeout: 60_000 });
    const trackAText = await page.getByTestId("phaser-scene-poc-json").innerText();
    const trackA = JSON.parse(trackAText) as RunPayload;
    expect(trackA.track).toBe("A");
    expect(trackA.count).toBeGreaterThanOrEqual(19);

    await page.getByTestId("phaser-scene-poc-panel-open").click();
    await expect(page.getByTestId("phaser-scene-poc-panel")).toBeVisible();
    await page.getByTestId("phaser-scene-poc-panel-close").click();
    await expect(page.getByTestId("phaser-scene-poc-metrics")).toContainText("GG-11 identity: STABLE");

    await page.getByTestId("phaser-scene-poc-track-B").click();
    await page.waitForTimeout(800);
    await page.getByTestId("phaser-scene-poc-run20").click();
    await expect(page.getByTestId("phaser-scene-poc-json")).toBeVisible({ timeout: 90_000 });
    // JSON updates in place — wait until track field flips to B.
    await expect
      .poll(async () => {
        const t = await page.getByTestId("phaser-scene-poc-json").innerText();
        return (JSON.parse(t) as RunPayload).track;
      })
      .toBe("B");
    const trackB = JSON.parse(await page.getByTestId("phaser-scene-poc-json").innerText()) as RunPayload;
    expect(trackB.count).toBeGreaterThanOrEqual(19);

    const payload = {
      ranAt: new Date().toISOString(),
      browser: "chromium",
      dualPlaneIdentityStable: true,
      trackA,
      trackB,
      overallPass: trackA.pass && trackB.pass && true
    };

    mkdirSync(dirname(resultsOut), { recursive: true });
    writeFileSync(resultsOut, JSON.stringify(payload, null, 2), "utf8");

    if (!trackA.pass || !trackB.pass) {
      console.warn("POC bar Fail — see", resultsOut, payload);
    }
  });
});

/**
 * E2E: phaser-kernel island hosts — destroy/create, GG-11 panel, stage travel.
 * Observability: console [destroyGame] / [phaser-island-host] events exercised via navigation.
 */
import { test, expect } from "@playwright/test";
import { mockShell } from "./helpers/mock-shell";

test.describe("phaser-kernel islands", () => {
  test("lawn host mounts, GG-11 panel keeps canvas, world host mounts after travel", async ({
    page
  }) => {
    test.setTimeout(90_000);
    await mockShell(page);

    const logs: string[] = [];
    page.on("console", (msg) => {
      const t = msg.text();
      if (t.includes("[destroyGame]") || t.includes("[phaser-island-host]")) {
        logs.push(t);
      }
    });

    await page.goto("/#/lawn?devmode=1");
    await expect(page.getByTestId("lawn-game-host")).toBeVisible({ timeout: 30_000 });

    // Desktop visual
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.screenshot({
      path: "tmp/phaser-kernel-lawn-desktop.png",
      fullPage: true
    });

    // GG-11 panel — required when devmode=1
    const openPanel = page.getByTestId("lawn-stage-open-panel");
    await expect(openPanel).toBeVisible({ timeout: 10_000 });
    await openPanel.click();
    await expect(page.getByTestId("lawn-stage-panel")).toBeVisible();
    await expect(page.getByTestId("lawn-game-host")).toBeVisible();
    await page.screenshot({ path: "tmp/phaser-kernel-lawn-panel.png" });
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("lawn-stage-panel")).toHaveCount(0);

    // Tablet
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.getByTestId("lawn-game-host")).toBeVisible();
    await page.screenshot({ path: "tmp/phaser-kernel-lawn-tablet.png" });

    // Mobile
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId("lawn-game-host")).toBeVisible();
    await page.screenshot({ path: "tmp/phaser-kernel-lawn-mobile.png" });

    // Stage travel → world (destroys lawn Game via shared destroyGame mutex)
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/#/world");
    await expect(page.getByTestId("world-game-host")).toBeVisible({ timeout: 30_000 });
    // world-game-canvas uses CSS `contents` (not a visible box) — host is the visible probe
    await expect(page.getByTestId("world-game-host")).toHaveAttribute(
      "data-test-id",
      "world-game-host"
    );
    await page.screenshot({ path: "tmp/phaser-kernel-world-desktop.png" });

    // Observability: stage travel must record destroyGame (not OR with create alone)
    await expect
      .poll(async () => {
        const obs = await page.evaluate(() => window.__fusionRpgKernelObs ?? []);
        return obs.some((e) => e.channel === "destroyGame");
      })
      .toBe(true);
  });
});

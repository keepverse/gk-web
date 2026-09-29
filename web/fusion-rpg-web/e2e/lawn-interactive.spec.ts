import { test, expect } from "@playwright/test";
import { mockShell } from "./helpers/mock-shell";

/**
 * Lawn interactive chrome — Field CTA, dock, spawn tray, commander bar, observability.
 * Mocks shell APIs the same way as lawn-hud.spec.ts so the page mounts without a live Server.
 */
test.describe("lawn interactive chrome", () => {
  test.beforeEach(async ({ page }) => {
    await mockShell(page);
    await page.goto("/#/lawn");
    await expect(page.getByTestId("page-lawn")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("lawn-match-hud")).toBeVisible({ timeout: 30_000 });
  });

  test("match HUD exposes Field CTA and connection", async ({ page }) => {
    const hud = page.getByTestId("lawn-match-hud");
    await expect(hud).toBeVisible();
    await expect(page.getByTestId("lawn-match-hud-field")).toBeVisible();
    await expect(page.getByTestId("lawn-hud-sun")).toBeVisible();
    const conn = page.getByTestId("lawn-match-hud-connection");
    await expect(conn).toBeVisible();
    await expect(conn).toHaveAttribute("data-connection", /optional|connected|disconnected/);
  });

  test("Field opens spawn tray; Esc closes tray", async ({ page }) => {
    await page.getByTestId("lawn-match-hud-field").click();
    await expect(page.getByTestId("spawn-tray")).toBeVisible();
    await expect(page.getByTestId("spawn-tray-hint")).toContainText(/no type id/i);
    // Player Field path must not expose the GG-41 typeId spawn control.
    await expect(page.locator('[data-testid="lawn-spawn-typeid"]')).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("spawn-tray")).toHaveCount(0);
  });

  test("commander action bar shows nine locked-visible slots", async ({ page }) => {
    await expect(page.getByTestId("commander-action-bar")).toBeVisible();
    for (let i = 1; i <= 9; i++) {
      await expect(page.getByTestId(`commander-action-slot-${i}`)).toBeVisible();
    }
    await expect(page.getByTestId("commander-action-slot-1")).toHaveAttribute("data-locked", "true");
  });

  test("observability ring records Field click", async ({ page }) => {
    await page.getByTestId("lawn-match-hud-field").click();
    const ring = await page.evaluate(() => {
      return (window as unknown as { __fusionRpgLawnInteractive?: { event: string }[] })
        .__fusionRpgLawnInteractive;
    });
    expect(ring?.some((e) => e.event === "hud.field")).toBeTruthy();
  });

  test("board chrome hosts dock rail and canvas", async ({ page }) => {
    await expect(page.getByTestId("lawn-board-chrome")).toBeVisible();
    await expect(page.getByTestId("lawn-canvas-plain")).toBeVisible();
  });
});

test.describe("lawn interactive responsive", () => {
  for (const viewport of [
    { name: "desktop", width: 1440, height: 900 },
    { name: "tablet", width: 1280, height: 720 },
    { name: "mobile", width: 390, height: 844 }
  ] as const) {
    test(`layout at ${viewport.name} ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await mockShell(page);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/#/lawn");
      await expect(page.getByTestId("lawn-match-hud")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId("lawn-match-hud-field")).toBeVisible();
      await expect(page.getByTestId("commander-action-bar")).toBeVisible();

      const metrics = await page.evaluate(() => {
        const el = document.documentElement;
        const hud = document.querySelector('[data-testid="lawn-match-hud"]') as HTMLElement | null;
        const bar = document.querySelector('[data-testid="commander-action-bar"]') as HTMLElement | null;
        return {
          noDocOverflowX: el.scrollWidth <= el.clientWidth + 2,
          hudVisible: !!hud && hud.getClientRects().length > 0,
          barVisible: !!bar && bar.getClientRects().length > 0,
          hudBottom: hud ? hud.getBoundingClientRect().bottom : -1,
          barTop: bar ? bar.getBoundingClientRect().top : -1
        };
      });
      expect(metrics.hudVisible).toBe(true);
      expect(metrics.barVisible).toBe(true);
      expect(metrics.noDocOverflowX).toBe(true);
      // Match strip above combat book — not stacked on top of each other.
      if (metrics.hudBottom >= 0 && metrics.barTop >= 0) {
        expect(metrics.hudBottom).toBeLessThanOrEqual(metrics.barTop + 1);
      }

      await page.screenshot({
        path: `e2e/artifacts/lawn-interactive-${viewport.name}.png`,
        fullPage: true
      });
    });
  }
});

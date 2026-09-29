/**
 * Side-by-side SSOT screenshots for owner visual gate.
 * Produces e2e/artifacts/derived/ssot-html.png and ssot-spa.png.
 *
 * Run (Server on :5088 with rebuilt wwwroot):
 *   DERIVED_SHEET_LIVE_E2E=1 npx playwright test e2e/derived-ssot-side-by-side.spec.ts --project=derived-live-chromium
 */
import { test, expect } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { isLiveDerivedSheetE2e } from "./helpers/derived-live-gate";
import { waitForApiHealth } from "./helpers/live-debug-api";

const liveEnabled = isLiveDerivedSheetE2e();
const API_BASE = (process.env.FUSIONRPG_API_BASE ?? "http://127.0.0.1:5088").replace(/\/$/, "");
const ARTIFACT_DIR = path.join("e2e", "artifacts", "derived");
const HTML_SSOT = path.resolve(
  "..",
  "..",
  "docs",
  "design",
  "gui-lego",
  "surfaces",
  "derived-console.html"
);

test.describe("Derived SSOT side-by-side (owner visual gate)", () => {
  test.skip(!liveEnabled, "requires derived-live-chromium project or DERIVED_SHEET_LIVE_E2E=1");

  test("capture ssot-html.png + ssot-spa.png at same viewport", async ({ page }) => {
    await waitForApiHealth();
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
    await page.setViewportSize({ width: 1440, height: 900 });

    // HTML draft
    expect(fs.existsSync(HTML_SSOT), `missing SSOT HTML at ${HTML_SSOT}`).toBe(true);
    await page.goto(pathToFileURL(HTML_SSOT).href);
    // Assembled Lego surface — root landmark is `.console[data-surface=derived-console]`
    const htmlRoot = page.locator(".console[data-surface='derived-console']");
    await expect(htmlRoot).toBeVisible({ timeout: 15_000 });
    await htmlRoot.screenshot({
      path: path.join(ARTIFACT_DIR, "ssot-html.png")
    });

    // Live SPA (rebuilt wwwroot)
    const seed = await fetch(`${API_BASE}/api/debug/derived-audit-actor`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    });
    if (!seed.ok) throw new Error(`seed failed ${seed.status}`);
    const { instanceId } = (await seed.json()) as { instanceId: string };

    await page.goto(`${API_BASE}/#/actor-ladder-demo?sel=${encodeURIComponent(instanceId)}`);
    await page.getByTestId("actor-ladder-open-panel").click();
    await expect(page.getByTestId("actor-panel")).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("actor-sheet-tab-derived").click();
    await expect(page.getByTestId("derived-combat-console")).toBeVisible({ timeout: 30_000 });

    const primary = page.getByTestId("derived-tab");
    await expect(primary.getByTestId("derived-tab-elements")).toBeVisible();
    await expect(primary.getByTestId("derived-tab-offense")).toHaveCount(0);
    await expect(page.getByTestId("derived-variant-rail")).toBeVisible();

    await page.getByTestId("derived-combat-console").screenshot({
      path: path.join(ARTIFACT_DIR, "ssot-spa.png")
    });

    expect(fs.existsSync(path.join(ARTIFACT_DIR, "ssot-html.png"))).toBe(true);
    expect(fs.existsSync(path.join(ARTIFACT_DIR, "ssot-spa.png"))).toBe(true);
  });
});

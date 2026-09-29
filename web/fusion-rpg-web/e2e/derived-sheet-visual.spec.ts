/**
 * Live Derived sheet visual audit — real Server Hub pipeline only.
 *
 * Requires FusionRpg.Server on http://127.0.0.1:5088 (loopback debug routes).
 * Does NOT mock /sheet with a synthetic 269-channel fixture.
 *
 * Run:
 *   DERIVED_SHEET_LIVE_E2E=1 npx playwright test e2e/derived-sheet-visual.spec.ts --project=derived-live-chromium
 */
import { test, expect, type Page } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";
import { isLiveDerivedSheetE2e } from "./helpers/derived-live-gate";
import { waitForApiHealth } from "./helpers/live-debug-api";

const liveEnabled = isLiveDerivedSheetE2e();
const API_BASE = (process.env.FUSIONRPG_API_BASE ?? "http://127.0.0.1:5088").replace(/\/$/, "");
const ARTIFACT_DIR = path.join("e2e", "artifacts", "derived");

type CoverageReport = {
  presentCount: number;
  touchedCount: number;
  present: string[];
  touched: string[];
  missingCook: string[];
  gap: { unwired: string[] };
  classified: {
    expectedStatusSession: string[];
    expectedNoProducer: string[];
    expectedInjectorTreeGap: string[];
    gapUnwired: string[];
  };
};

type SurfaceTab = {
  id: string;
  variants?: { id: string }[];
  actionCategoryVariants?: { id: string }[] | null;
  categories: { families: { family: string; expand: string }[] }[];
};

async function postSeed(): Promise<{ instanceId: string }> {
  const r = await fetch(`${API_BASE}/api/debug/derived-audit-actor`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}"
  });
  if (!r.ok) throw new Error(`seed failed ${r.status}: ${await r.text()}`);
  return (await r.json()) as { instanceId: string };
}

async function fetchCoverage(instanceId: string): Promise<CoverageReport> {
  const r = await fetch(
    `${API_BASE}/api/debug/derived-audit-coverage?instanceId=${encodeURIComponent(instanceId)}`
  );
  if (!r.ok) throw new Error(`coverage failed ${r.status}: ${await r.text()}`);
  return (await r.json()) as CoverageReport;
}

async function fetchSurface(): Promise<{ tabs: SurfaceTab[] }> {
  const r = await fetch(`${API_BASE}/api/catalogs/derived-surface?lang=en&side=plant`);
  if (!r.ok) throw new Error(`derived-surface failed ${r.status}: ${await r.text()}`);
  return (await r.json()) as { tabs: SurfaceTab[] };
}

function joinChannel(family: string, expand: string, variantId: string | null): string {
  if (expand === "none" || !variantId) return family;
  return `${family}.${variantId}`;
}

function variantIdsForTab(tab: SurfaceTab): string[] {
  if (tab.id === "other") {
    // D3: Shared lives on cook variants; action chips stay on actionCategoryVariants.
    return [
      ...(tab.variants ?? []).map((v) => v.id),
      ...(tab.actionCategoryVariants ?? []).map((v) => v.id)
    ];
  }
  return (tab.variants ?? []).map((v) => v.id);
}

function familyVisibleOnOther(famExpand: string, variantId: string | null, tab: SurfaceTab): boolean {
  const actionIds = new Set((tab.actionCategoryVariants ?? []).map((v) => v.id));
  const isAction = variantId != null && actionIds.has(variantId);
  if (!isAction) return famExpand === "none";
  return famExpand === "action-category";
}

async function ensureShowUnchanged(page: Page) {
  const toggle = page.getByTestId("derived-show-unchanged");
  await expect(toggle).toBeAttached({ timeout: 15_000 });
  const checked = await toggle.isChecked();
  if (!checked) {
    // HTML SSOT uses a track/knob label — the opacity-0 checkbox is covered; click the label.
    await page.locator(".derived-combat-console button.toggle").click();
    await expect(toggle).toBeChecked();
  }
}

test.describe("Derived sheet visual (live Server Hub)", () => {
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.skip(!liveEnabled, "requires derived-live-chromium project or DERIVED_SHEET_LIVE_E2E=1");

  let instanceId = "derived-audit";
  let coverage: CoverageReport;
  let surface: { tabs: SurfaceTab[] };
  let sheetPresent = new Set<string>();

  test.beforeAll(async () => {
    if (!liveEnabled) return;
    try {
      await waitForApiHealth();
    } catch (e) {
      test.skip(true, `live Server health failed — start Server on ${API_BASE} (no fake sheet fallback): ${e}`);
      return;
    }
    const seed = await postSeed();
    instanceId = seed.instanceId;
    coverage = await fetchCoverage(instanceId);
    surface = await fetchSurface();
    sheetPresent = new Set(coverage.present);

    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
    const gapsPath = path.join(ARTIFACT_DIR, "wiring-gaps.json");
    fs.writeFileSync(
      gapsPath,
      JSON.stringify(
        {
          instanceId,
          presentCount: coverage.presentCount,
          touchedCount: coverage.touchedCount,
          missingCook: coverage.missingCook,
          classified: coverage.classified,
          gap: coverage.gap
        },
        null,
        2
      )
    );
  });

  test("coverage artifact exists and Hub returned present channels", async () => {
    expect(coverage.presentCount).toBeGreaterThan(0);
    expect(fs.existsSync(path.join(ARTIFACT_DIR, "wiring-gaps.json"))).toBe(true);
  });

  test("walk cook tab×variant: screenshots + sheet-present cook ids reachable", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/#/actor-ladder-demo?sel=${encodeURIComponent(instanceId)}`);
    await page.getByTestId("actor-ladder-open-panel").click();
    await expect(page.getByTestId("actor-panel")).toBeVisible({ timeout: 30_000 });

    await page.getByTestId("actor-sheet-tab-derived").click();
    await expect(page.getByTestId("derived-combat-console")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("derived-tab")).toBeVisible({ timeout: 30_000 });
    await ensureShowUnchanged(page);

    // Contract: cook primary tabs present; sheetGroup Offense/Pools must not be primary rail.
    const primary = page.getByTestId("derived-tab");
    await expect(primary.getByTestId("derived-tab-elements")).toBeVisible();
    await expect(primary.getByTestId("derived-tab-status")).toBeVisible();
    await expect(primary.getByTestId("derived-tab-resources")).toBeVisible();
    await expect(primary.getByTestId("derived-tab-other")).toBeVisible();
    await expect(primary.getByTestId("derived-tab-offense")).toHaveCount(0);
    await expect(primary.getByTestId("derived-tab-pools")).toHaveCount(0);
    await expect(page.getByTestId("derived-variant-rail")).toBeVisible();
    await expect(page.getByTestId("derived-variant-fire")).toBeVisible();

    for (const tab of surface.tabs) {
      await page.getByTestId(`derived-tab-${tab.id}`).click();
      const variants = variantIdsForTab(tab);
      const variantList = variants.length > 0 ? variants : [null];

      for (const variantId of variantList) {
        if (variantId) {
          await page.getByTestId(`derived-variant-${variantId}`).click();
        }

        const expandFamilies = tab.categories.flatMap((c) => c.families);
        for (const fam of expandFamilies) {
          if (tab.id === "other" && !familyVisibleOnOther(fam.expand, variantId, tab)) continue;
          const channelId = joinChannel(fam.family, fam.expand, variantId);
          if (!sheetPresent.has(channelId)) continue;
          // Only assert reachability for channels Hub actually returned on the sheet.
          await expect(
            page.getByTestId(`derived-channel-${channelId}`),
            `sheet-present cook id not in UI for ${tab.id}/${variantId ?? "none"}: ${channelId}`
          ).toBeVisible({ timeout: 5_000 });
        }

        const shotName = variantId ? `${tab.id}-${variantId}.png` : `${tab.id}-none.png`;
        await page.getByTestId("derived-combat-console").screenshot({
          path: path.join(ARTIFACT_DIR, shotName)
        });
      }
    }
  });
});

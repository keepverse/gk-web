/**
 * Story-scene visual gate (T23 cutover, AFTER set) — the same beats, viewports and assertions as
 * the sibling `story-ui-evidence.spec.ts` BEFORE set (`e2e/artifacts/story-ui/`), captured against
 * the cutover surface into `e2e/artifacts/story-scene/` so before/after are directly comparable.
 *
 * This is a CAPTURE spec with one hard gate: it asserts only enough to prove the scene rendered
 * (dialog visible, beat advanced, cue correct, content read from the DOM rather than restated),
 * writes PNGs for human review — PLUS the short-viewport fit assertion the shipped dialog fails
 * (T23: dialog body `scrollHeight <= clientHeight` at 1280×720 AND a short viewport; the peer's
 * `known-defect` annotation on the sibling spec flips once this is green here).
 *
 * Locator vocabulary is the piece vocabulary, not the retired dialog's: the say-region testids
 * (`rift-prologue-say|speaker|line|teaching`) and `.rift-prologue-*` classes are superseded
 * (T23 row) by `.story-dialogue-window__*`, `.story-scene-stage[data-cue]`, and the labelled
 * sprite fallbacks. The two hooks that did NOT change — `rift-prologue-dialog` and
 * `[aria-label="Beat n of m"]` — are asserted identically in both specs.
 *
 * Run from gk-web/web/fusion-rpg-web (preview server on :4173 is started automatically):
 *   npx playwright test e2e/story-scene-visual.spec.ts --project=chromium
 *
 * Artifacts (gitignored, reproducible via the command above):
 *   e2e/artifacts/story-scene/<viewport>-beat<N>[-no-teaching].png
 *   e2e/artifacts/story-scene/capture-report.<viewport>.json
 */
import { test, expect } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";
import { mockSanctumWithEligibleStory } from "./helpers/sanctum-story-mock";

const ARTIFACT_DIR = path.join("e2e", "artifacts", "story-scene");

/** Beats as the script declares them: cue per beat, used only to walk the scene and name files. */
const BEATS = [
  { index: 1, cue: "rift.portal.open" },
  { index: 2, cue: "rift.portal.surge" },
  { index: 3, cue: "rift.quarantine.seal" },
  { index: 4, cue: "rift.quarantine.fade" }
] as const;

type CaptureRecord = {
  viewport: string;
  beat: number;
  /** Read from the rendered name tag, NOT assumed. Absent on the narration beat. */
  renderedSpeaker: string | null;
  cue: string;
  /** Read from the rendered live line, so the report cannot restate a stale mirror. */
  renderedLine: string | null;
  hasNameTag: boolean;
  hasTeaching: boolean;
  /** Dialog-body fit at this beat: the T23 gate — never a scrollbar, even at a short viewport. */
  bodyOverflows: boolean;
  file: string;
};

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
  // Gate viewports (T23): the shipped dialog fits 1280×720 with zero margin and clips 90px at
  // 1280×600. Both are captured AND asserted here.
  { name: "gate-720", width: 1280, height: 720 },
  { name: "gate-short", width: 1280, height: 600 }
] as const;

test.describe("Story-scene visual gate (cutover AFTER set)", () => {
  for (const vp of VIEWPORTS) {
    test(`capture every beat at ${vp.name}`, async ({ page }) => {
      fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await mockSanctumWithEligibleStory(page);

      const records: CaptureRecord[] = [];

      await page.goto("/#/sanctum");
      const dialog = page.getByTestId("rift-prologue-dialog");
      await expect(dialog).toBeVisible({ timeout: 15_000 });
      const body = dialog.getByTestId("rift-prologue-dialog-body");

      // Let the dialog-open animation finish before the first capture. Screenshots taken
      // mid-transition photograph a half-faded frame (caught by the first review pass); the
      // 220ms beat cross-fade lives in `gk-core/data/tuning/story-scene-ui.v1.json`, so the settle is
      // that plus margin — a capture concern, never a balance number.
      const settle = async () => page.waitForTimeout(500);
      await settle();

      for (const beat of BEATS) {
        // Progress label is the scene's own `Beat n of m` (aria-label) — reading it proves the
        // beat actually advanced rather than the capture photographing the same frame four times.
        await expect(dialog.locator(`[aria-label="Beat ${beat.index} of 4"]`)).toBeVisible({
          timeout: 10_000
        });

        // The cue the whole scene reads, on the stage root (piece vocabulary).
        await expect(dialog.locator(".story-scene-stage")).toHaveAttribute("data-cue", beat.cue);

        // Read what the page actually renders through the piece hooks. The narration beat (3)
        // renders NO name tag by contract — that absence is asserted, not worked around.
        const window = dialog.locator(".story-dialogue-window");
        await expect(window.locator(".story-dialogue-window__line")).toBeVisible();
        const renderedLine = (await window.locator(".story-dialogue-window__line").innerText()).trim();
        const nameTagCount = await window.locator(".story-dialogue-window__nameTag").count();
        const renderedSpeaker =
          nameTagCount > 0
            ? (await window.locator(".story-dialogue-window__nameTag").innerText()).trim()
            : null;
        const hasTeaching =
          (await window.locator(".story-dialogue-window__teaching").count()) > 0;
        if (beat.index === 3) {
          expect(renderedSpeaker).toBeNull();
          await expect(window).toHaveAttribute("data-narration", "true");
        } else {
          expect(renderedSpeaker).not.toBeNull();
        }

        // T23 fit gate: measure the DIALOG BODY, never the document — DialogShell's body is
        // overflow-y-auto, so the document never scrolls even when the scene is clipped (the
        // false-pass trap that hid the shipped 90px clip).
        const fit = await body.evaluate((el) => ({
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight
        }));
        const bodyOverflows = fit.scrollHeight > fit.clientHeight;

        // Checkpoint E, second box: "Full-bleed at 100dvh: window + advance control reachable
        // without scrolling". Geometry, not eyeball — and not the frame either: a full-bleed
        // dialog whose content overflows still screenshots at viewport size (its box equals the
        // viewport) and the document never scrolls (the shell body is overflow-y-auto), so neither
        // the PNG nor `documentElement.scrollHeight` can see it. Measured against the viewport
        // height, and separately for the advance row, which is what a player must be able to press.
        const dialogBox = await dialog.boundingBox();
        expect(dialogBox).not.toBeNull();
        expect(dialogBox!.height).toBeLessThanOrEqual(vp.height + 0.5);
        const advanceBox = await dialog.locator(".story-advance-control").boundingBox();
        expect(advanceBox).not.toBeNull();
        expect(advanceBox!.y + advanceBox!.height).toBeLessThanOrEqual(vp.height + 0.5);

        const file = path.join(
          ARTIFACT_DIR,
          `${vp.name}-beat${beat.index}${hasTeaching ? "" : "-no-teaching"}.png`
        );
        await dialog.screenshot({ path: file });

        records.push({
          viewport: vp.name,
          beat: beat.index,
          renderedSpeaker,
          cue: beat.cue,
          renderedLine,
          hasNameTag: (renderedSpeaker ?? "").length > 0,
          hasTeaching,
          bodyOverflows,
          file
        });

        // Skip is present on every beat including the last (T23 must-verify) — the last
        // beat pairs it with the final advance, never replaces it.
        await expect(dialog.getByRole("button", { name: "Skip intro" })).toBeVisible();

        if (beat.index < BEATS.length) {
          await dialog.getByRole("button", { name: "Next" }).click();
          await settle();
        }
      }

      fs.writeFileSync(
        path.join(ARTIFACT_DIR, `capture-report.${vp.name}.json`),
        JSON.stringify(records, null, 2)
      );

      expect(records).toHaveLength(BEATS.length);
      for (const record of records) {
        expect(record.bodyOverflows).toBe(false);
      }
    });
  }

  // T23 must-verify: prefers-reduced-motion makes transitions instant. The stage exposes the
  // branch as data-motion (the media query itself is the real enforcement; jsdom pins the hook).
  test("reduced motion marks the stage instant", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1280, height: 720 });
    await mockSanctumWithEligibleStory(page);
    await page.goto("/#/sanctum");
    const dialog = page.getByTestId("rift-prologue-dialog");
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await expect(dialog.locator(".story-scene-stage")).toHaveAttribute("data-motion", "instant");
  });
});

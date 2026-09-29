/**
 * Pseudo-locale story-scene gate — the **layout** half of owner decision S4.
 *
 * `spec-localization.md` says the pseudo locale "must render the scene" and gives it two jobs: expose
 * a missed `msg`, and expose a layout that cannot survive a longer translation. As of 2026-09-23 the
 * first job is asserted in jsdom (`StorySceneHost.pseudo.test.tsx`) and the second had **no mechanism
 * at all**: `setLocale("pseudo")` is a no-op outside `import.meta.env.DEV` and the dev debug hook is
 * stripped from a production build, so the preview bundle every other spec drives cannot render it.
 *
 * This spec closes that gap without changing what ships: it runs against `vite dev` (opt-in project
 * `pseudo-chromium`, see `e2e/helpers/pseudo-gate.ts`), switches the locale on the **live** instance
 * the way System → Preferences does, and then applies the same obligations the T23 gate applies in
 * English — the dialog body never overflows, and the advance control stays inside the viewport at the
 * gate viewports. It also proves the switch itself: a scene already mounted must re-resolve, which it
 * did not until the host keyed its resolvers on the active locale (System → Preferences could leave
 * the scene in the mount-time language).
 *
 * Run from gk-web/web/fusion-rpg-web (starts `npm run dev` on :5173):
 *   npx playwright test e2e/story-scene-pseudo.spec.ts --project=pseudo-chromium
 *
 * Artifacts (gitignored, reproducible via the command above):
 *   e2e/artifacts/story-scene/pseudo-<viewport>-beat<N>.png
 *   e2e/artifacts/story-scene/pseudo-capture-report.<viewport>.json
 */
import { test, expect } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";
import { mockSanctumWithEligibleStory } from "./helpers/sanctum-story-mock";

const ARTIFACT_DIR = path.join("e2e", "artifacts", "story-scene");

/** Beats as the script declares them — walked, never counted on in an assertion. */
const BEATS = [1, 2, 3, 4] as const;

/** The gate viewports: the two the T23 fit defect was measured at, plus mobile (stacked actors). */
const VIEWPORTS = [
  { name: "gate-720", width: 1280, height: 720 },
  { name: "gate-short", width: 1280, height: 600 },
  { name: "mobile", width: 390, height: 844 }
] as const;

type PseudoRecord = {
  viewport: string;
  beat: number;
  line: string;
  hasNameTag: boolean;
  /** True when every player string on the surface is pseudo-marked (no English left behind). */
  pseudoMarked: boolean;
  bodyOverflows: boolean;
  file: string;
};

/** Every player-copy element on the assembled surface, in one list so nothing is missed by hand. */
const COPY_SELECTORS = [
  ".story-dialogue-window__line",
  ".story-dialogue-window__teaching",
  ".story-dialogue-window__nameTag",
  ".story-actor-sprite__hint"
] as const;

test.describe("Story-scene pseudo-locale gate (layout under longer text)", () => {
  for (const vp of VIEWPORTS) {
    test(`renders every beat pseudo-marked and fits at ${vp.name}`, async ({ page }) => {
      fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await mockSanctumWithEligibleStory(page);

      await page.goto("/#/sanctum");
      const dialog = page.getByTestId("rift-prologue-dialog");
      await expect(dialog).toBeVisible({ timeout: 15_000 });

      // Switch on the running instance — the same call System → Preferences makes. Done *after* the
      // scene is mounted, deliberately: a mount-time-only resolution would pass a "reload then look"
      // test while leaving the shipped switcher broken.
      await page.evaluate(() => {
        const debug = (
          window as unknown as {
            __i18nDebug?: { setLocale: (locale: string) => void };
          }
        ).__i18nDebug;
        if (!debug) {
          throw new Error(
            "window.__i18nDebug is missing — this spec must run against `vite dev` (project pseudo-chromium)"
          );
        }
        debug.setLocale("pseudo");
      });

      // The switch reached the DOM, not just the i18n instance. This is the assertion that reds on a
      // mount-time-only resolver.
      await expect(dialog.locator(".story-dialogue-window__line")).toHaveText(/^\[!!/, {
        timeout: 10_000
      });

      const body = dialog.getByTestId("rift-prologue-dialog-body");
      const records: PseudoRecord[] = [];
      const settle = async () => page.waitForTimeout(300);

      let previousLabel: string | null = null;
      for (const beat of BEATS) {
        // The progress label is an attribute, not text, so it is asserted here rather than in the
        // copy sweep below. Its pseudo shape keeps the placeholders OUTSIDE the markers
        // (`[!!Beat !!]1[!! of !!]4` — that is the interpolated-message fix T9 made), so the beat
        // number is asserted as content, not as a prefix.
        const progress = dialog.locator(".story-scene-progress__label");
        await expect(progress).toBeVisible({ timeout: 10_000 });
        const progressLabel = (await progress.getAttribute("aria-label")) ?? "";
        expect(progressLabel, `beat ${beat} progress label`).toMatch(/^\[!![\s\S]*!!\]/);
        expect(progressLabel, `beat ${beat} progress label carries the beat number`).toContain(
          String(beat)
        );
        expect(progressLabel, `beat ${beat} progress label carries the total`).toContain(
          String(BEATS.length)
        );
        // …and it moved: a label that never changes would satisfy the two contains above.
        expect(progressLabel, `beat ${beat} progress label did not advance`).not.toBe(previousLabel);
        previousLabel = progressLabel;

        // Every player-copy element present on this beat is pseudo-marked. Beat 3 is narration and
        // renders no name tag; the selector simply is not there to check.
        const texts: { selector: string; text: string }[] = [];
        for (const selector of COPY_SELECTORS) {
          for (const el of await dialog.locator(selector).all()) {
            texts.push({ selector, text: ((await el.innerText()) || "").trim() });
          }
        }
        const controlTexts = (
          await dialog.locator(".story-advance-control button").allInnerTexts()
        ).map((text) => text.trim());
        const samples = [...texts.map((t) => t.text), ...controlTexts];
        expect(samples.length, `beat ${beat} produced no player copy at all`).toBeGreaterThan(0);
        const unmarked = samples.filter((text) => !text.startsWith("[!!") || !text.endsWith("!!]"));
        expect(unmarked, `beat ${beat} rendered un-pseudo-marked copy`).toEqual([]);

        // The layout obligations, identical to the English gate — measured on the dialog BODY, never
        // the document (the shell's body is `overflow-y-auto`, so the document never scrolls even when
        // the scene is clipped) and on the control the player has to reach.
        const fit = await body.evaluate((el) => ({
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight
        }));
        const bodyOverflows = fit.scrollHeight > fit.clientHeight;
        const advance = await dialog.locator(".story-advance-control").boundingBox();
        expect(advance).not.toBeNull();
        expect(advance!.y + advance!.height).toBeLessThanOrEqual(vp.height + 0.5);

        const file = path.join(ARTIFACT_DIR, `pseudo-${vp.name}-beat${beat}.png`);
        await dialog.screenshot({ path: file });

        records.push({
          viewport: vp.name,
          beat,
          line: (await dialog.locator(".story-dialogue-window__line").innerText()).trim(),
          hasNameTag: (await dialog.locator(".story-dialogue-window__nameTag").count()) > 0,
          pseudoMarked: unmarked.length === 0,
          bodyOverflows,
          file
        });

        expect(dialog.getByRole("button", { name: /^\[!!.*!!\]$/ }).first()).toBeVisible();

        if (beat < BEATS.length) {
          // The primary verb is the last button in the control; its label is pseudo-marked, so click
          // it by position rather than by a hard-coded language string.
          await dialog.locator(".story-advance-control button").last().click();
          await settle();
        }
      }

      fs.writeFileSync(
        path.join(ARTIFACT_DIR, `pseudo-capture-report.${vp.name}.json`),
        JSON.stringify(records, null, 2)
      );

      expect(records).toHaveLength(BEATS.length);
      for (const record of records) {
        // The point of the gate: longer text must not push the window or the control out of reach.
        expect(record.bodyOverflows, `beat ${record.beat} body overflow at ${record.viewport}`).toBe(
          false
        );
      }
    });
  }
});

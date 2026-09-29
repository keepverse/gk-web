/**
 * Story UI evidence capture — the current Rift prologue, at every beat, at three viewports.
 *
 * This exists so the owner can look at the actual rendered story UI as evidence rather than reading
 * an assertion about it. It is a CAPTURE spec: it asserts only enough to prove the scene rendered
 * (the dialog is visible, the beat advanced, the art vs placeholder branch is the expected one), and
 * it writes PNGs for human review. It makes no claim about taste.
 *
 * Run from gk-web/web/fusion-rpg-web (preview server on :4173 is started automatically):
 *   npx playwright test e2e/story-ui-evidence.spec.ts --project=chromium
 *
 * Artifacts (gitignored, like every other capture here):
 *   e2e/artifacts/story-ui/<viewport>-beat<N>[-narration|-placeholder].png
 *   e2e/artifacts/story-ui/capture-report.json
 *
 * The four beats come from the scene script
 * (src/features/story-scene/sceneScript.ts `RIFT_PROLOGUE_SCRIPT`; formerly the shipped dialog's
 * own BEATS constant, retired at the cutover). Beat 3 is the narration beat (no speaker), and
 * its cue is the quarantine seal. The capture walks them by clicking Next, so it also proves the
 * advance path works — the same path a player takes.
 */
import { test, expect, type Page, type Route } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";

const ARTIFACT_DIR = path.join("e2e", "artifacts", "story-ui");

/** Beats as the shipped dialog declares them; used only to walk the scene and name the files. */
const BEATS = [
  { index: 1, cue: "rift.portal.open" },
  { index: 2, cue: "rift.portal.surge" },
  { index: 3, cue: "rift.quarantine.seal" },
  { index: 4, cue: "rift.quarantine.fade" }
] as const;

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

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

/**
 * Mock the shell with the prologue ELIGIBLE, so `SanctumStage` opens it. The one field that matters
 * is `stories[0].eligible` — `SanctumStage.tsx:85-89` looks up `rift-prologue` v1 and opens on
 * `eligible`. Everything else is the standard Sanctum mock (mirrors `sanctum.spec.ts`).
 */
async function mockSanctumWithEligibleStory(page: Page, opts: { ackOk?: boolean } = {}) {
  const ackOk = opts.ackOk ?? true;
  await page.route("**/hub/rpg**", (route) => route.abort());
  await page.route("**/health", (route) => fulfillJson(route, health));
  await page.route("**/api/players", (route) =>
    fulfillJson(route, {
      items: [{ id: 1, name: "Default", createdUtc: "2026-01-01T00:00:00Z" }],
      currentPlayerId: 1
    })
  );
  await page.route("**/api/players/current", (route) => fulfillJson(route, { ok: true }));
  await page.route("**/api/sim", (route) => fulfillJson(route, null, 404));
  await page.route("**/api/unique/actors**", (route) => fulfillJson(route, { playerId: 1, items: [] }));
  await page.route("**/api/runs", (route) => fulfillJson(route, { items: [] }));
  await page.route("**/api/souls/**", (route) =>
    fulfillJson(route, {
      playerId: 1,
      balance: 500,
      earnedTotal: 500,
      spentTotal: 0,
      revision: 1,
      updatedUtc: "2026-01-01T00:00:00Z"
    })
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
  await page.route("**/api/onboarding/**", (route) => {
    const url = route.request().url();
    if (url.includes("/ack") || url.includes("/stories/")) {
      return fulfillJson(route, ackOk ? { ok: true } : { ok: false }, ackOk ? 200 : 500);
    }
    return fulfillJson(route, {
      playerId: 1,
      playerLevel: 1,
      revision: 1,
      checkpoints: [],
      stories: [
        {
          storyId: "rift-prologue",
          version: 1,
          state: "unseen",
          outcome: null,
          eligible: true
        }
      ]
    });
  });
}

/**
 * `desktop`/`tablet`/`mobile` are the general render sweep. `gate-1280x720` and `gate-short` exist
 * because T23's acceptance criteria name those two exactly ("no scrollbar at 1280x720 **and** at a
 * short viewport"), and a cutover comparison is only valid when the before and after are captured at
 * the same sizes. `gate-short` is a laptop-class height where a 100dvh scene is most likely to
 * overflow its own padding — the fit failure jsdom cannot see.
 */
const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
  { name: "gate-1280x720", width: 1280, height: 720 },
  { name: "gate-short", width: 1280, height: 600 }
] as const;

type CaptureRecord = {
  viewport: string;
  beat: number;
  /** Read from the rendered name tag, NOT assumed. Absent when the beat renders no tag. */
  renderedSpeaker: string | null;
  cue: string;
  /** Read from the rendered line, so the report cannot restate a stale mirror. */
  renderedLine: string | null;
  hasNameTag: boolean;
  hasTeaching: boolean;
  file: string;
  assetState: "art" | "placeholder";
  /**
   * Fit at this viewport, in CSS px. Present only on the `gate-*` viewports — T23's "no scrollbar at
   * 1280x720 and at a short viewport" is a **measurement**, not something a reviewer can reliably
   * eyeball (a 2px overflow is invisible but fails the criterion).
   *
   * Measured on the DIALOG BODY, not the document. `DialogShell` makes its body `overflow-y-auto`
   * inside `max-h-[min(720px,82vh)]` (`DialogShell.tsx:70,82`), so the page itself never scrolls even
   * when the scene is clipped — a document-level check reports a false pass. `bodyOverflows` is the
   * fact the criterion actually cares about.
   */
  bodyScrollHeight?: number;
  bodyClientHeight?: number;
  bodyOverflows?: boolean;
};

test.describe("Story UI evidence capture (Rift prologue, shipped)", () => {
  for (const vp of VIEWPORTS) {
    test(`capture every beat at ${vp.name}`, async ({ page }) => {
      fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await mockSanctumWithEligibleStory(page);

      const records: CaptureRecord[] = [];

      await page.goto("/#/sanctum");
      const dialog = page.getByTestId("rift-prologue-dialog");
      await expect(dialog).toBeVisible({ timeout: 15_000 });

      for (const beat of BEATS) {
        // Progress label is the dialog's own `Beat n of m` (aria-label, :167) — reading it proves the
        // beat actually advanced rather than the capture photographing the same frame four times.
        await expect(dialog.locator(`[aria-label="Beat ${beat.index} of 4"]`)).toBeVisible({
          timeout: 10_000
        });

        // Cutover 2026-09-16 (story-scene T23, owner-approved crossing): the retired
        // dialog's `.rift-prologue-scene` is the stage piece's `.story-scene-stage` — same
        // data-cue contract, new vocabulary. Assertion kept, locator migrated.
        const scene = dialog.locator(".story-scene-stage");
        await expect(scene).toHaveAttribute("data-cue", beat.cue);

        // Cutover: the art/placeholder branch is gone — the bed always renders and a missing
        // actor sprite is a labelled fallback (`role="img"`, like the old placeholder).
        // assetState now reads that signal instead of the retired class.
        const placeholder = dialog.locator(".story-actor-sprite__placeholder");
        const assetState: "art" | "placeholder" = (await placeholder.count()) > 0 ? "placeholder" : "art";

        // Read what the page actually renders, through the piece hooks (the say-region testids
        // `rift-prologue-say|speaker|line|teaching` are superseded — T23 row). Nothing here is
        // assumed from this spec's own copy — that is the whole point of reading rather than
        // restating. Beat 3 is narration by documented correction (T6 dropped the synthetic
        // "Gnome signal" speaker), so the speaker read is conditional; rendering no name tag
        // on narration is an explicit gate item, not a missing hook.
        const window = dialog.locator(".story-dialogue-window");
        const speakerCount = await window.locator(".story-dialogue-window__nameTag").count();
        const renderedSpeaker =
          speakerCount > 0
            ? (await window.locator(".story-dialogue-window__nameTag").innerText()).trim()
            : null;
        const renderedLine = (
          await window.locator(".story-dialogue-window__line").innerText()
        ).trim();
        const hasTeaching =
          (await window.locator(".story-dialogue-window__teaching").count()) > 0;

        const file = path.join(
          ARTIFACT_DIR,
          `${vp.name}-beat${beat.index}${hasTeaching ? "" : "-no-teaching"}${assetState === "placeholder" ? "-placeholder" : ""}.png`
        );
        await dialog.screenshot({ path: file });

        records.push({
          viewport: vp.name,
          beat: beat.index,
          renderedSpeaker,
          cue: beat.cue,
          renderedLine,
          // Cutover: null on the narration beat (see the conditional read above).
          hasNameTag: (renderedSpeaker ?? "").length > 0,
          hasTeaching,
          file,
          assetState
        });

        if (beat.index < BEATS.length) {
          await dialog.getByRole("button", { name: "Next" }).click();
        }
      }

      // The gate viewports also record the fit measurement T23 asserts. Measured once, after the
      // scene is fully mounted on its last beat, so an overflow caused by the tallest beat is caught.
      // Measured on the dialog BODY (`DialogShell.tsx:82`), NOT the document — the shell scrolls its
      // own body inside a capped height (`max-h-[min(720px,82vh)]`, `:70`), so the document never
      // overflows and a document-level check would report a false pass.
      if (vp.name.startsWith("gate-")) {
        const body = dialog.getByTestId("rift-prologue-dialog-body");
        const fit = await body.evaluate((el) => ({
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight
        }));
        const bodyOverflows = fit.scrollHeight > fit.clientHeight;
        for (const record of records) {
          record.bodyScrollHeight = fit.scrollHeight;
          record.bodyClientHeight = fit.clientHeight;
          record.bodyOverflows = bodyOverflows;
        }

        // T23 gate, flipped 2026-09-16: the piece-based scene fits — the shipped 90px clip
        // (469px of content in a 379px body at 1280x600) is gone, proven with bodyOverflows=false
        // on every beat at both gate sizes. The known-defect annotation is retired; the named
        // criterion is now a strict assertion on BOTH gate viewports, so any regression fails
        // loudly instead of annotating.
        expect(
          fit.scrollHeight,
          `scene must fit at ${vp.name} (${fit.scrollHeight}px in a ${fit.clientHeight}px body)`
        ).toBeLessThanOrEqual(fit.clientHeight);
      }

      fs.writeFileSync(
        path.join(ARTIFACT_DIR, `capture-report.${vp.name}.json`),
        JSON.stringify(records, null, 2)
      );

      expect(records).toHaveLength(BEATS.length);
    });
  }
});

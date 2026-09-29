import { defineConfig, devices } from "@playwright/test";
import { isLiveActorHudE2e } from "./e2e/helpers/live-gate";
import { isLiveDerivedSheetE2e } from "./e2e/helpers/derived-live-gate";
import { isPseudoLocaleE2e } from "./e2e/helpers/pseudo-gate";

// The pseudo-locale gate needs `vite dev` for the same reason the live gates do: it exercises a
// runtime-only affordance (`setLocale("pseudo")`, which is a no-op in a production build). See
// `e2e/helpers/pseudo-gate.ts`.
const isPseudoE2e = isPseudoLocaleE2e();

// ⚠️ Ports are overridable because `reuseExistingServer` is on by default, and several lanes share
// this machine: a second worktree already listening on 4173 means a run **silently tests that
// worktree's build** and reports it as green (seen 2026-09-23, two cmdc lanes). One lane per port, or
// set `E2E_PREVIEW_PORT`/`E2E_DEV_PORT` to a free one:
//   E2E_PREVIEW_PORT=4401 npx playwright test e2e/story-scene-visual.spec.ts --project=chromium
const PREVIEW_PORT = process.env.E2E_PREVIEW_PORT ?? "4173";
const DEV_PORT = process.env.E2E_DEV_PORT ?? "5173";
const isLiveE2e = isLiveActorHudE2e() || isLiveDerivedSheetE2e() || isPseudoE2e;
if (isLiveActorHudE2e()) {
  process.env.ACTOR_HUD_LIVE_E2E = "1";
}
if (isLiveDerivedSheetE2e()) {
  process.env.DERIVED_SHEET_LIVE_E2E = "1";
}
if (isPseudoE2e) {
  process.env.PSEUDO_LOCALE_E2E = "1";
}

export default defineConfig({
  testDir: "./e2e",
  // `.test.ts` anywhere under e2e/ is a vitest-only unit test (picked up separately by
  // vite.config.ts's `e2e/**/*.test.{ts,tsx}` include) — never a Playwright spec. Matched with no
  // path-separator anchor so it holds on Windows too: `/\/helpers\//`, the previous form, silently
  // matched nothing here because Playwright's own path is backslash-joined, so
  // `e2e/helpers/live-debug-api-core.test.ts` (and, once I1 added it,
  // e2e/fixtures/passive-tree-volume.test.ts) were both still collected as specs and crashed at
  // load time on the bare vitest `describe`/`it` globals they import instead of using.
  testIgnore: /\.test\.ts$/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: isLiveE2e ? `http://127.0.0.1:${DEV_PORT}` : `http://127.0.0.1:${PREVIEW_PORT}`,
    trace: "on-first-retry"
  },
  webServer: isLiveE2e
    ? {
        command: `npm run dev -- --host 127.0.0.1 --port ${DEV_PORT}`,
        url: `http://127.0.0.1:${DEV_PORT}`,
        reuseExistingServer: true,
        timeout: 120_000
      }
    : {
        command: `npm run preview -- --host 127.0.0.1 --port ${PREVIEW_PORT}`,
        url: `http://127.0.0.1:${PREVIEW_PORT}`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000
      },
  projects: [
    {
      name: "chromium",
      // A project-level testIgnore replaces, rather than adds to, the top-level one above — so the
      // `.test.ts` exclusion has to be repeated here too, or this project re-collects every
      // vitest-only file the top-level pattern was meant to keep out.
      testIgnore: [
        /\.test\.ts$/,
        /actor-hud-live\.spec\.ts$/,
        /derived-sheet-visual\.spec\.ts$/,
        /derived-ssot-side-by-side\.spec\.ts$/,
        /story-scene-pseudo\.spec\.ts$/
      ],
      use: { ...devices["Desktop Chrome"] }
    },
    {
      name: "pseudo-chromium",
      testMatch: /story-scene-pseudo\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"] }
    },
    {
      name: "live-chromium",
      testMatch: /actor-hud-live\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"] }
    },
    {
      name: "derived-live-chromium",
      testMatch: /derived-(sheet-visual|ssot-side-by-side)\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});

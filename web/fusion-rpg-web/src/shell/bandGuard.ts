import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

export type GuardViolation = {
  file: string;
  line: number;
  text: string;
};

const SCANNABLE_EXTENSIONS = new Set([".ts", ".tsx", ".css"]);
const SKIPPED_DIR_NAMES = new Set(["node_modules", "dist", "coverage"]);
const TEST_FILE_PATTERN = /\.(test|spec)\.[jt]sx?$/;

function walk(rootDir: string, onFile: (filePath: string) => void): void {
  for (const entry of readdirSync(rootDir)) {
    if (SKIPPED_DIR_NAMES.has(entry)) continue;
    const fullPath = join(rootDir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      walk(fullPath, onFile);
    } else if (SCANNABLE_EXTENSIONS.has(extname(fullPath)) && !TEST_FILE_PATTERN.test(entry)) {
      onFile(fullPath);
    }
  }
}

function scanLines(
  rootDir: string,
  shouldSkip: (relPath: string) => boolean,
  patterns: RegExp[]
): GuardViolation[] {
  const violations: GuardViolation[] = [];
  walk(rootDir, (filePath) => {
    const relPath = relative(rootDir, filePath).split("\\").join("/");
    if (shouldSkip(relPath)) return;
    const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
    lines.forEach((line, index) => {
      if (patterns.some((pattern) => pattern.test(line))) {
        violations.push({ file: relPath, line: index + 1, text: line.trim() });
      }
    });
  });
  return violations;
}

/**
 * GG-5's guard: nothing outside the token definitions and the seven `.band-*`
 * utility classes (`stage`/`scrim`/`hud`/`panel`/`dialog`/`toast`/`system` — `scrim` added
 * 2026-09-04, world-stage W55's GG-5 amendment) may set `z-index` or use a Tailwind `z-*` class.
 * Any hit means a surface picked its own stacking tier instead of one of the seven.
 */
const STRAY_Z_INDEX_PATTERNS = [
  /z-index\s*:/,
  /(^|[\s"'`])z-\[[^\]]+\]/,
  /(^|[\s"'`])z-(0|10|20|30|40|50)\b/
];

export function scanForStrayZIndex(srcDir: string): GuardViolation[] {
  return scanLines(
    srcDir,
    (relPath) => relPath === "theme/tokens.css",
    STRAY_Z_INDEX_PATTERNS
  );
}

/**
 * T1's other guard: `LayerStack` is a shell-only mechanism (GG-1's stack is
 * one owner of visibility). Only the shells that register themselves in it —
 * currently `PanelShell` and `DialogShell` — and the store's own test may
 * import it.
 */
const LAYER_STACK_IMPORT_PATTERN = /from\s+["'](?:@\/shell\/layerStack|\.{1,2}\/.*layerStack)["']/;

export function scanForLayerStackImports(srcDir: string): GuardViolation[] {
  return scanLines(
    srcDir,
    (relPath) => relPath.startsWith("shell/"),
    [LAYER_STACK_IMPORT_PATTERN]
  );
}

/**
 * GG-53 / D6: only run-ending results may open a blocking (band-3) surface unprompted — level-ups,
 * drops and contract offers report at band 4 and queue for the sanctum instead. No run-result
 * screen exists yet (it's part of T24, excluded this phase), so today's real invariant is
 * narrower and fully checkable: nothing outside `src/shell/`, `ui/ConfirmDialog.tsx` and the
 * `world-confirms` module's three dialogs may render `DialogShell` or claim the `band-dialog`
 * class. Each is exempt by construction, not by assumption — a fully controlled component (the
 * caller's own `open` state decides visibility), never self-opening from a background event
 * (`stages/world/confirms/noSelfOpen.test.tsx`, world-stage W105, is that module's own standing
 * proof); GG-41 also exempts developer surfaces from GG-53 entirely, so the same allow-list
 * `vocabularyGuard.ts` uses for those applies here.
 */
const DIALOG_BAND_PATTERNS = [/<DialogShell\b/, /\bband-dialog\b/, /band:\s*["']dialog["']/];

const DIALOG_BAND_ALLOWED_PATHS = new Set([
  "ui/ConfirmDialog.tsx",
  "stages/world/confirms/CommitLegionDialog.tsx",
  "stages/world/confirms/BindWardenDialog.tsx",
  "stages/world/confirms/ReleaseGroundDialog.tsx",
  // item module 20 (2026-09-06): the socket bench and the compendium are band-3 by their own spec's
  // decision, not by a component's preference — they are the third and last push of the Relics
  // depth budget (Relics → item → bench), and putting them back inside the panel is what the 640px
  // measurement already ruled out. Both qualify the same way the three world dialogs above do:
  // fully controlled (the layer's own `open` state decides visibility) and never self-opening from
  // a background event — each opens only from an explicit button press on a selected row.
  "layers/relics/SocketBench.tsx",
  "layers/relics/Compendium.tsx",
  // item modules 14/15/16 (2026-09-06): the craft bench is the workbench's write surface and sits at
  // exactly the same depth as the socket bench above — the third push of the Relics budget, opened
  // only by the Craft button on an already-selected armoury row, and fully controlled by the layer's
  // own `craftOpen` state. It qualifies on the same two grounds, and for the same reason it is a
  // dialog at all: a spend is a decision, which is what band 3 is for.
  "layers/relics/Workbench.tsx",
  // party-dungeon D5.9 (spec-delve-stage.md §7): "the extraction summary — the one result, with any
  // wipe or permanent-loss notice folded in" — the one band-3 result the delve stage produces
  // (`ExtractionSettlement.Decide`, `DelveLoot.AtExtraction`). Qualifies the same way the three world
  // dialogs above do: fully controlled by its own `open` prop, never self-opening from a background
  // event (`ExtractionSummary.test.tsx`'s own "open=false leaves the layer stack empty" case).
  "stages/delve/summary/ExtractionSummary.tsx",
  // party-dungeon D5.8 (spec-delve-stage.md §7): "Descent confirm (single-descent domains, and the
  // Oath), extract confirm, retreat confirm — confirms, not results." Only `DescendConfirm.tsx` is
  // listed here, not all three: `ExtractConfirm.tsx`/`RetreatConfirm.tsx` are thin `ui/ConfirmDialog`
  // wrappers (already-exempt path above) that never themselves render `<DialogShell` or claim
  // `band-dialog` — the scan patterns above simply never match their own source, so listing them would
  // be an inert, meaningless entry rather than a real exemption. `DescendConfirm.tsx` is real: it needs
  // `DialogShell` for the Oath checkbox `ConfirmDialog`'s flat `message: string` has no slot for.
  // Qualifies on the same two grounds as every entry above: fully controlled by its own `open` prop
  // (`DelvePickerLayer.tsx` decides when to show it), never self-opening from a background event
  // (`DescendConfirm.test.tsx`'s own "renders nothing when closed" case). `stages/delve/bandDiscipline
  // .test.ts`'s own `Only_the_summary_and_three_confirms_open_band_3` is the real-tree guard that keeps
  // this list honest.
  "stages/delve/confirms/DescendConfirm.tsx",
  // onboarding / story-scene (2026-09-15): the four-beat Rift prologue, the one band-3 surface the
  // onboarding flow produces. It is band-3 by its own narrative source's decision, not by a
  // component's preference: `docs/ideas/onboarding-gnome-teaser.md:37` — "The teaser is a band-3
  // `DialogShell` owned by the Sanctum stage." Qualifies the same way every entry above does:
  //   (1) fully controlled — visibility is the Sanctum stage's own `riftOpen` state, set from the
  //       server's own `eligible` flag (`SanctumStage.tsx:85-89`); the dialog never self-opens, and
  //       `RiftPrologueDialog.tsx` takes `open` as a prop with no internal trigger.
  //   (2) never self-opening from a background event — no timer, subscription or socket opens it;
  //       the only other path is the player pressing the advance/skip button, which is the decision
  //       band 3 exists for (the four beats conclude in one explicit choice, "Anchor the lawn").
  //   (3) why band 3 and not band 2 — it is a decision surface (`DialogShell.tsx:17-21`), and a
  //       story scene must not interrupt a panel already open (the stage checks `openLayer === null`).
  // story-scene T23 cutover (2026-09-16): the render moved here from the wrapper, as this
  // entry's own note required — re-pointed, not left stale. `RiftPrologueDialog.tsx` is now a
  // thin prop-pass-through that never itself renders `<DialogShell` (the scan patterns no longer
  // match its source), so listing it would be an inert, meaningless entry. The host qualifies on
  // the same three grounds: (1) fully controlled — `open` is a prop owned by the Sanctum stage's
  // own `riftOpen` state, set from the server's own `eligible` flag; the host has no internal
  // trigger. (2) never self-opening from a background event — no timer, subscription or socket
  // opens it; the only other path is the player's own advance/skip press. (3) still band 3, not
  // band 2 — it is the same decision surface (`DialogShell size="scene"`), and a story scene must
  // not interrupt a panel already open (the stage checks `openLayer === null`).
  "ui/story-scene/StorySceneHost.tsx"
]);

const DEV_SURFACE_PREFIXES = [
  "dev/",
  "features/status/",
  "features/stats/",
  "features/pvz-activity/",
  "features/icon-dump/",
  "features/almanac-dump/",
  "features/cheats/",
  "features/sim/",
  "features/log/",
  "features/metrics/",
  "features/lawn/",
  "features/roster/",
  "stages/lawn/"
];

export function scanForUnvettedDialogBandOwners(srcDir: string): GuardViolation[] {
  return scanLines(
    srcDir,
    (relPath) =>
      relPath.startsWith("shell/") ||
      relPath === "theme/tokens.css" ||
      DIALOG_BAND_ALLOWED_PATHS.has(relPath) ||
      DEV_SURFACE_PREFIXES.some((p) => relPath.startsWith(p)),
    DIALOG_BAND_PATTERNS
  );
}

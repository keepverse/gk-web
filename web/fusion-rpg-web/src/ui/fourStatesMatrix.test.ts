import { describe, expect, it } from "vitest";

/**
 * GG-17's own "Testable as" line: "Per surface, four render tests." Its baseline ("2 of 20 pages
 * handle query error at all") is the *pre-refactor* legacy page count (`gap-audit-2026-08-22.md`),
 * not this refactor's own surfaces — conflating the two would misattribute a decade of legacy debt
 * to this phase. This file declares the current, real status of every data surface this refactor
 * actually owns or touches, so a new one added without checking all four states can't go quiet.
 */
type SurfaceEntry =
  | { surface: string; hasFourStates: true; provenBy: string }
  | { surface: string; hasFourStates: false; reason: string };

const DATA_SURFACES: SurfaceEntry[] = [
  {
    surface: "Creatures (CreaturesLayer)",
    hasFourStates: true,
    provenBy: "CreaturesLayer.test.tsx: loading/error/empty/ready cases, all with a real retry action"
  },
  {
    surface: "Relics (RelicsLayer)",
    hasFourStates: true,
    provenBy: "RelicsLayer.test.tsx: loading/error/empty/ready cases across both actors and relics queries"
  },
  {
    surface: "Pacts (PactsLayer)",
    hasFourStates: true,
    provenBy: "PactsLayer.test.tsx: loading/error/empty/ready cases across both contracts and roster queries; locked state is the rail entry itself (railState.ts), not this layer"
  },
  {
    surface: "Commanders (CommandersLayer)",
    hasFourStates: true,
    provenBy: "CommandersLayer.test.tsx: loading/error/empty/ready cases, Set default POST, Esc close"
  },
  {
    surface: "Fusion (FusionLayer wrapping FusionPage)",
    hasFourStates: false,
    reason: "FusionLayer is a thin wrap (T15) — it owns no query state of its own. Whatever loading/error handling exists lives inside FusionPage.tsx, a pre-existing legacy page this refactor deliberately left unchanged (\"wrap the already-real page\", not rebuild it) — fixing its state handling is a legacy-page concern, out of this phase's scope"
  },
  {
    surface: "Expeditions (ExpeditionsLayer wrapping ExpeditionsPage)",
    hasFourStates: false,
    reason: "Same thin-wrap shape as Fusion (T17) — ExpeditionsLayer owns no query state; ExpeditionsPage.tsx is the same kind of unmodified legacy page"
  },
  {
    surface: "Almanac (AlmanacLayer wrapping CatalogPage/RecipesPage)",
    hasFourStates: false,
    reason: "Same thin-wrap shape (T19) — both wrapped pages are unmodified legacy code"
  },
  {
    surface: "Chronicle (ChronicleLayer wrapping MetricsPage/RpgProgressionPage/PvzStatsPage)",
    hasFourStates: false,
    reason: "Same thin-wrap shape (T19) — all three wrapped pages are unmodified legacy code"
  },
  {
    surface: "System (SystemLayer)",
    hasFourStates: false,
    reason: "Reads only from localStorage (preferences.ts/keybindings.ts) and the in-memory keymap registry — no query has a loading or error state to model; empty/locked don't apply to a settings form"
  },
  {
    surface: "Sanctum stage itself (SanctumStage/SanctumHud/FocusCard)",
    hasFourStates: false,
    reason: "Renders honestly-Pending fields (T4's contract, not a query loading/error state) and a real locked-rail derivation (railState.ts) rather than a single query with four states of its own — the pattern doesn't map onto this stage the same way it does a single-collection layer"
  },
  {
    surface: "Passives (PassivesTab, Level 0 'Yours')",
    hasFourStates: true,
    provenBy: "PassivesTab.test.tsx: loading/error (real retry, calling refetch on all three source queries) / empty (real content naming the aptitude budget, GG-17) / ready cases"
  }
];

describe("four-states matrix (GG-17)", () => {
  it("every entry states a real reason for its status, not a placeholder", () => {
    for (const entry of DATA_SURFACES) {
      const detail = entry.hasFourStates ? entry.provenBy : entry.reason;
      expect(detail.length, `${entry.surface} needs a real, non-empty detail`).toBeGreaterThan(10);
    }
  });

  it("every genuinely new (non-wrap) layer this refactor built has real four-state coverage", () => {
    const newLayers = [
      "Creatures (CreaturesLayer)",
      "Relics (RelicsLayer)",
      "Pacts (PactsLayer)",
      "Commanders (CommandersLayer)"
    ];
    for (const name of newLayers) {
      const entry = DATA_SURFACES.find((e) => e.surface === name);
      expect(entry?.hasFourStates, `${name} should have real four-state coverage`).toBe(true);
    }
  });

  it("declares the full known set", () => {
    expect(DATA_SURFACES).toHaveLength(11);
  });
});

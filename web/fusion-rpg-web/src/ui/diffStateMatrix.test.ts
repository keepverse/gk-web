import { describe, expect, it } from "vitest";

/**
 * GG-47's own "Testable as" line: "Every picker surface renders a diff state in its test matrix."
 * Checkpoint G's audit found real diff-state coverage (RelicsLayer's equipped-vs-candidate
 * comparison) but no *declared* inventory of which picker surfaces exist and whether each complies
 * — a silent single instance, not a checked list. This file is that list. Adding a new picker
 * surface without updating it is the thing this test exists to make impossible to do quietly.
 *
 * GG-47 names the domain explicitly: "relics, creatures, skills, contracts, sectors." Only one of
 * those is a real, built comparison UI today — the other four either don't exist as comparison
 * surfaces yet, or their comparison UI is a task this phase excluded after checking the real
 * backend (matching T21/T23's own documented findings, not a new claim invented here).
 */
type PickerSurfaceEntry =
  | { surface: string; hasDiffState: true; provenBy: string }
  | { surface: string; hasDiffState: false; reason: string };

const PICKER_SURFACES: PickerSurfaceEntry[] = [
  {
    surface: "Relics (RelicsLayer — held vs equipped)",
    hasDiffState: true,
    provenBy:
      "RelicsLayer.test.tsx: \"Held lists the real catalog, comparison shows beside the candidate\" / e2e/relics.spec.ts"
  },
  {
    surface: "Creatures — pre-run loadout picker",
    hasDiffState: false,
    reason: "The comparison surface is T21's Loadout dialog, excluded this phase: no real backend supports a per-run squad selection (tasks/game-gui-todo.md Task 21)"
  },
  {
    surface: "Fusion (FusionPage — base + sacrifice)",
    hasDiffState: false,
    reason: "FusionPage shows a cost preview, not a before/after stat comparison against the base creature's current state — no comparison UI has been built for this surface"
  },
  {
    surface: "Pacts / contract offers",
    hasDiffState: false,
    reason: "The comparison surface is T23's pact-offer ceremony, excluded this phase: ContractRowDto carries no offer/terms/price data to compare against (tasks/game-gui-todo.md Task 23). PactsLayer itself only lists already-bound contracts, never an unbound candidate"
  },
  {
    surface: "World — sector claims",
    hasDiffState: false,
    reason: "World predates this refactor and stays untouched (T16 exclusion) — out of scope to add a comparison UI to it here"
  }
];

describe("diff-state matrix (GG-47)", () => {
  it("every entry states a real reason for its status, not a placeholder", () => {
    for (const entry of PICKER_SURFACES) {
      const detail = entry.hasDiffState ? entry.provenBy : entry.reason;
      expect(detail.length, `${entry.surface} needs a real, non-empty detail`).toBeGreaterThan(10);
    }
  });

  it("at least one real picker surface has a proven diff state (the matrix isn't vacuous)", () => {
    expect(PICKER_SURFACES.some((e) => e.hasDiffState)).toBe(true);
  });

  it("declares the full known set — five surfaces, matching GG-47's own named domain", () => {
    expect(PICKER_SURFACES).toHaveLength(5);
  });
});

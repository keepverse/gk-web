/**
 * spec-assign-ladder.md (EP1.5, W1) — the fill logic that used to live here is now the server's
 * `AssignLadder` (`POST /api/aptitude-presets/suggest`, called by `runAutoAssign.ts`). This file
 * keeps only what the host still needs on the FE side: the closed rule/result types, the aptitude
 * id roster, and the pure "apply a shares map into the draft" helper — never a second fill.
 */
import autoAssignCatalogJson from "../../../../../data/tuning/aptitude-auto-assign-catalog.v1.json";

export type AutoAssignRule =
  | "even"
  | "posture-force"
  | "posture-finesse"
  | "posture-bastion"
  | "active-preset"
  | "species-favour";

export type AutoAssignResult = {
  ok: boolean;
  reason: string;
  shares: Record<string, number>;
  leftover: number;
};

const POSTURE_OF: Record<string, "force" | "finesse" | "bastion"> = {
  Might: "force",
  Fortitude: "force",
  Vigor: "force",
  Onslaught: "force",
  Agility: "finesse",
  Composure: "finesse",
  Pierce: "finesse",
  Focus: "finesse",
  Bulwark: "bastion",
  Retribution: "bastion",
  Precision: "bastion",
  Ferocity: "bastion"
};

export const APTITUDE_IDS = Object.keys(POSTURE_OF);

/** spec-auto-assign-control.md (EP1.20) — the display text itself is catalog-sourced, never an FE
 * literal (DESIGN-GATE's UI row: player copy loads from `gk-core/data/tuning/*-catalog.v{n}.json`). A
 * balance/copy pass changes the catalog and republishes through `gk-core/tools/tuning/publish.py`; it never
 * edits this file. The catalog is imported directly, the same way `lib/bus/actorSurface.ts` reads
 * `aptitude-catalog.v1.json` — no loader registry to register it in. */
function catalogLabel(id: AutoAssignRule): string {
  const row = autoAssignCatalogJson.entries.find((e) => e.id === id);
  return row?.displayName ?? id;
}

/** spec-default-build.md EP1.17 — the ONE place a rule id maps to display copy. The sheet reads
 * this catalog to label a default ("Suggested build (<label>)"), never re-deriving copy from the
 * rule id inline in a component (a switch/ternary there would be the exact "FE string union" the
 * spec forbids). `Record<AutoAssignRule, string>` makes a missing label a compile error, not a
 * silent gap, the moment a seventh rule is ever added to the closed vocabulary above — each value
 * below is a catalog lookup (EP1.20), so the *keys* stay the closed TypeScript union while the
 * *strings* live in `aptitude-auto-assign-catalog.v1.json`. */
export const RULE_LABELS: Record<AutoAssignRule, string> = {
  even: catalogLabel("even"),
  "posture-force": catalogLabel("posture-force"),
  "posture-finesse": catalogLabel("posture-finesse"),
  "posture-bastion": catalogLabel("posture-bastion"),
  "active-preset": catalogLabel("active-preset"),
  "species-favour": catalogLabel("species-favour")
};

/** Falls back to the raw rule id for a value outside the closed vocabulary above (defensive only —
 * the server only ever sends one of `RULE_LABELS`' own keys). */
export function ruleLabel(ruleId: string): string {
  return (RULE_LABELS as Record<string, string>)[ruleId] ?? ruleId;
}

/** Apply a fill result into a draft via per-id setValue (no POST). */
export function applyAutoAssignShares(
  setValue: (id: string, next: number) => void,
  shares: Record<string, number>
): void {
  for (const id of APTITUDE_IDS) {
    setValue(id, shares[id] ?? 0);
  }
}

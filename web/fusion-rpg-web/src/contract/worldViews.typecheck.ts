import type { ForceView, LegionPosition } from "./types";

/**
 * world-stage W4 — compile-only proof, not a runtime test. `*.test.ts` files are excluded from
 * `tsconfig.json`'s scope, so a `@ts-expect-error` inside one is never actually checked; this file
 * is a plain module `npm run build`'s `tsc --noEmit` pass does cover. It has no runtime behaviour —
 * every binding below exists only so a real type error becomes a real build failure.
 *
 * If either `@ts-expect-error` below stops being necessary (because a refactor accidentally made
 * the illegal read legal again), `tsc` fails with "Unused '@ts-expect-error' directive" — the
 * proof is two-sided, not just "this line has red squiggles today".
 */

declare const bandedForce: ForceView & { exact: false };
// @ts-expect-error — `strength` does not exist on the `exact: false` arm of the discriminated
// union; a band is a fog artefact and must never be read as if it were an exact figure.
void bandedForce.strength;

declare const exactForce: ForceView & { exact: true };
// @ts-expect-error — the reverse: `bandName`/`bandCeiling` do not exist once `exact` is `true`.
void exactForce.bandName;

// The legal reads compile with no directive at all — proves the two branches aren't just both
// permissive (which would make the two errors above meaningless).
declare const anyForce: ForceView;
if (anyForce.exact) {
  void anyForce.strength;
} else {
  void anyForce.bandName;
  void anyForce.bandCeiling;
}

// Same shape of proof for `LegionPosition`: a lane's `progress` is unreachable while at a sector,
// and a sector id is unreachable while on a lane.
declare const atSector: LegionPosition & { kind: "sector" };
// @ts-expect-error — `progress` only exists on the `"lane"` arm.
void atSector.progress;

declare const onLane: LegionPosition & { kind: "lane" };
// @ts-expect-error — `sectorId` only exists on the `"sector"` arm (the field is `towardSectorId` here).
void onLane.sectorId;

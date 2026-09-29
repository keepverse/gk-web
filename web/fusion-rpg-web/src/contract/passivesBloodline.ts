import type { TreeResolveReport } from "@/lib/bus";
import { isKnown, isPending, type Pending } from "./pending";

/**
 * passive-tree-todo.md I5 — Level 0b, the bloodline READ route (spec-tree-surface.md §3). A species
 * tree belongs to exactly one creature and is reached two ways: spent on that creature's own actor
 * sheet (the pin, never a browse) and read from the Creature Codex, read-only (§3 point 2, GG-9 --
 * "other surfaces link into the canonical one rather than re-implementing it"). This module is the
 * read route's pure derivation, mirroring the shape `passivesYours.ts`/`passivesBrowse.ts` already
 * use: unit-testable without mounting React, and the one place that decides which of §9's
 * presentations applies so `BloodlineTree.tsx` stays a thin render layer.
 *
 * `CreatureCodexEntryDto` (`lib/bus/creatures.ts`) is never imported here or by any caller in `ui/` --
 * `contractGuard.test.ts` forbids `ui/`, `stages/` and `layers/` from binding to a `*Dto`-suffixed
 * wire type; only `contract/` may. Callers pass the bare `state` field this module already treats as
 * the whole of that DTO it needs (`bloodlineDiscoveryOf`), the same narrowing
 * `CreaturesPage.tsx:369-370`'s own `codexBySpecies.get(...)` already does inline.
 */

/** `CreatureCodexEntryDto.state` is `"seen" | "discovered"`; a species with no codex entry at all (the
 * common case for anything never encountered) reads as `"undiscovered"` -- there is no explicit wire
 * value for it, the same `undefined`-means-unknown reading `CreaturesPage.tsx`'s own codex map uses. */
export type BloodlineDiscovery = "discovered" | "seen" | "undiscovered";

export function bloodlineDiscoveryOf(codexState: "seen" | "discovered" | undefined): BloodlineDiscovery {
  return codexState ?? "undiscovered";
}

/** §3 / §9's silhouette rule: `CreaturesPage.tsx:370`'s own `known` reading -- "discovered" and "seen"
 * both count as known, and the bloodline's real content is allowed to render for either. Only
 * "undiscovered" degrades to a silhouette. */
export function isBloodlineKnown(discovery: BloodlineDiscovery): boolean {
  return discovery === "discovered" || discovery === "seen";
}

export type BloodlineReadState =
  /** §9's silhouette presentation: identity hidden, no tree content of any kind. */
  | { kind: "silhouette" }
  /** The bloodline is known but its resolve report hasn't loaded yet -- a loading state, not a
   * silhouette (GG-17: loading and locked are different states and must not look alike). */
  | { kind: "pending"; reason: string }
  /** The bloodline is known and the query resolved with nothing on file -- a genuine data gap
   * (every bound creature has exactly one species tree by construction, D23), never silently
   * repainted as a silhouette (D14/D11's own "never silently repaired" rule extended here). */
  | { kind: "empty" }
  /** The bloodline is known and its report is in hand -- render the real tree. */
  | { kind: "tree"; report: TreeResolveReport };

/**
 * The one function the read route calls. Discovery is checked FIRST and unconditionally: an
 * undiscovered bloodline renders a silhouette regardless of whether `report` happens to already be
 * `known` (e.g. prefetched) -- the surface must never leak a real creature's bloodline contents
 * through a data-availability accident. This is the trust boundary; `BloodlineTree.tsx` never
 * re-derives it and never reaches into `report` before asking this function first.
 */
export function bloodlineReadState(
  discovery: BloodlineDiscovery,
  report: Pending<TreeResolveReport>
): BloodlineReadState {
  if (!isBloodlineKnown(discovery)) return { kind: "silhouette" };
  if (isPending(report)) return { kind: "pending", reason: report.reason };
  if (isKnown(report)) return { kind: "tree", report: report.value };
  return { kind: "empty" };
}

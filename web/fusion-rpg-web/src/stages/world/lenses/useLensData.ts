import { useRef } from "react";
import { useWorldState } from "@/lib/bus/world";
import { adaptWorldState, type AdaptedWorldState } from "@/contract/adapt";
import type { LensId } from "./lensCatalog";

export type LensDataResult = {
  /**
   * The already-adapted view to actually draw. Never `undefined` once the first load has ever
   * completed — while lens 4's own `?lifelines=true` request is in flight, this still holds
   * whatever last resolved (that request's own previous fetch, or a plain fetch from any other
   * lens), so a consumer can never render an empty frame mid-fetch.
   */
  displayed: AdaptedWorldState | undefined;
  /** True only while lens 4 (`supply`) is the active lens and its own request is in flight — the
   * other five lenses never carry a loading state (`useWorldState` already resolves from cache or
   * a plain, cheap fetch for them). */
  isLensFourLoading: boolean;
};

/**
 * world-stage W97 (spec-world-lenses.md, `WorldEndpoints.cs:48-51`) — lens 4 is the one that costs a
 * real round-trip (`"Reconnection cost is an O(holdings⁴) sweep ... asked for rather than always
 * paid for"`). GG-17 makes that a designed loading state rather than a blank frame: `useWorldState`
 * already threads `lifelines` into its own query key (`lib/bus/world.ts`), so selecting lens 4 is a
 * distinct cache entry and a genuine fetch — this hook's only job is remembering the last
 * *already-adapted* value that ever resolved, so the map keeps drawing it for the whole in-flight
 * window. Adapts through `adaptWorldState` (never names `WorldStateDto` itself) so this file — under
 * `stages/` — stays inside `contractGuard.ts`'s own rule: `query.data`'s type is inferred, never
 * imported by name, matching `WorldStage.tsx`'s own established `Parameters<typeof adaptWorldState>`
 * idiom for the same constraint.
 */
export function useLensData(worldId: string | null | undefined, activeLensId: LensId): LensDataResult {
  const lifelines = activeLensId === "supply";
  const query = useWorldState(worldId, { lifelines });

  const lastGoodRef = useRef<AdaptedWorldState | undefined>(undefined);
  if (query.data !== undefined) {
    lastGoodRef.current = adaptWorldState(query.data, { lifelinesRequested: lifelines });
  }

  return {
    displayed: lastGoodRef.current,
    isLensFourLoading: lifelines && query.isFetching
  };
}

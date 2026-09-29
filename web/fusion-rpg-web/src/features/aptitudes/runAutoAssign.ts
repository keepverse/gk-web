/**
 * Host-side auto-assign: fill draft only (spec-assign-ladder.md, EP1.5, W1). The route owns the
 * ladder (`POST /api/aptitude-presets/suggest`); this is a thin caller that applies whatever
 * `draftShares` it returns via `setValue` — no share arithmetic runs in the FE.
 */
import { applyAutoAssignShares, type AutoAssignResult } from "./autoAssign";
import { suggestAptitudePreset } from "@/lib/bus/aptitudePresets";

export type AutoAssignHostMode = "unique" | "species" | "commander";

export type RunAutoAssignArgs = {
  rule: string;
  mode: AutoAssignHostMode;
  playerId: number;
  /**
   * @deprecated the server resolves its own budget for the scope (spec-assign-ladder.md "One
   * implementation") — kept optional so existing callers do not need editing in the same change.
   */
  budget?: number;
  /**
   * @deprecated the server resolves the species itself from `scopeKey` — kept optional so existing
   * callers do not need editing in the same change.
   */
  speciesId?: string | null;
  /** Mode A unique instanceId / Mode B species id / Mode C empty. */
  scopeKey?: string | null;
  setValue: (id: string, next: number) => void;
};

export async function runAutoAssign(args: RunAutoAssignArgs): Promise<AutoAssignResult> {
  try {
    const result = await suggestAptitudePreset({
      playerId: args.playerId,
      scope: args.mode,
      scopeKey: args.scopeKey ?? "",
      rule: args.rule
    });
    applyAutoAssignShares(args.setValue, result.draftShares);
    return { ok: true, reason: "", shares: result.draftShares, leftover: result.leftover };
  } catch (err) {
    const reason = err instanceof Error && err.message ? err.message : "autoAssign.suggest.fetchFailed";
    return { ok: false, reason, shares: {}, leftover: 0 };
  }
}

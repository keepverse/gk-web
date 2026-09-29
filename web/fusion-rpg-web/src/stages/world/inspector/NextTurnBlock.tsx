import type { SectorView } from "@/contract/types";

export type NextTurnPin = "keep" | "release-first";

export type NextTurnBlockProps = {
  sector: SectorView;
  /** `cedeCapability.ts`'s `CEDE_ORDER_AVAILABLE` in real use — a caller-supplied boolean here so
   * this component's own tests can drive both states regardless of what the real vocabulary says
   * today. `spec-world-inspector.md` §3: until this is true, the pin's own controls do not render
   * at all — the forecast sentence still does, truthfully, either way. */
  cedeOrderAvailable: boolean;
  /** `"keep"` maps to a real `stand-fast` order, `"release-first"` to a real `cede` order — this
   * component only names the intent; filing the actual `WorldCommandRequest` is the caller's job. */
  onPin?: (pin: NextTurnPin) => void;
};

/**
 * Block 3 (world-stage W59) — the most delicate on the surface, per `spec-world-inspector.md` §3:
 * `LoamPhases` picks the release target itself every turn (`LoamForecast.Weakest`), so no copy here
 * may say "choose what to release" until the engine actually lets the player choose. **That day has
 * arrived** (`cedeCapability.ts`'s own finding) — but the component still gates on its prop, not a
 * hard-coded truth, so its own tests can prove both states hold correctly forever.
 */
export function NextTurnBlock({ sector, cedeOrderAvailable, onPin }: NextTurnBlockProps) {
  return (
    <div data-testid="next-turn-block">
      <h4 className="mb-1 font-display text-sm text-text">Next turn</h4>
      {sector.willReleaseNextTurn ? (
        <>
          <p className="text-sm text-bad" data-testid="next-turn-forecast">
            This sector will be released next turn if nothing changes.
          </p>
          {cedeOrderAvailable ? (
            <div className="mt-1 flex gap-2" data-testid="next-turn-pin-controls">
              <button
                type="button"
                className="rounded-sm border border-border px-2 py-1 text-xs"
                onClick={() => onPin?.("keep")}
              >
                Keep this ground
              </button>
              <button
                type="button"
                className="rounded-sm border border-border px-2 py-1 text-xs"
                onClick={() => onPin?.("release-first")}
              >
                Give this up first
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <p className="text-sm text-muted" data-testid="next-turn-forecast">
          Not at risk of release next turn.
        </p>
      )}
    </div>
  );
}

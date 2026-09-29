import { Badge, TypeIcon } from "@/ui";
import { LawnHudCommander, type LawnMatchCommanderChip } from "./LawnHudCommander";

export type LawnDeployedChip = {
  ptr: string;
  side: "plant" | "zombie";
  typeId: number;
  typeName?: string | null;
};

/**
 * T28 (plate 04 §A): the clean player HUD — "no ornament anywhere on this stage. Sun, wave, timer,
 * deployed creatures, transport." Sun and wave are real (`LawnEconomy`, already read by the debug
 * Inspector's own "Economy" row); deployed chips fold the same `living` occupant list the debug
 * Spawn/Inspector panel already reads, filtered to the player's own side.
 *
 * Two pieces of the plate are not real and are shown honestly rather than faked:
 *   - "next in 0:18" (a countdown to the next wave) — `LawnEconomy` carries `wave`/`maxWave`, no
 *     timer field at all (confirmed by reading `lawnViewModel.ts`'s own type).
 *   - Pause/1×/2× playback — no speed/pause control exists anywhere in this app's mutation surface
 *     (grepped for it); the actual PVZ game process owns its own simulation loop; this overlay
 *     observes it (`Page`'s own description: "never FE Admit or optimistic living"), it doesn't
 *     drive it. Rendered disabled with the reason inline (title), the same convention the Sound tab
 *     and Rail's own locked entries already use, rather than a working-looking triplet of buttons.
 */
export function LawnHud({
  sun,
  wave,
  maxWave,
  hugeWave,
  matchCommander,
  deployed,
  onOpenCommanderSheet
}: {
  sun?: number;
  wave?: number;
  maxWave?: number;
  hugeWave?: boolean;
  matchCommander?: LawnMatchCommanderChip;
  deployed: LawnDeployedChip[];
  onOpenCommanderSheet?: () => void;
}) {
  return (
    <div
      className="mb-3 flex flex-wrap items-center gap-3 rounded-md border border-border bg-soil-raised px-3 py-2"
      data-testid="lawn-hud"
    >
      <div className="flex items-center gap-1.5" data-testid="lawn-hud-sun">
        <span aria-hidden="true" className="text-lg text-sun">
          ☀
        </span>
        <span className="font-mono text-lg font-bold text-sun">{sun ?? "—"}</span>
      </div>

      <Badge tone={hugeWave ? "warn" : "neutral"} data-testid="lawn-hud-wave">
        {wave != null && maxWave != null ? `Wave ${wave} of ${maxWave}` : "Wave —"}
        {hugeWave ? " · huge" : ""}
      </Badge>

      {matchCommander ? (
        <LawnHudCommander commander={matchCommander} onOpenSheet={onOpenCommanderSheet} />
      ) : null}

      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5" data-testid="lawn-hud-deployed">
        <span className="text-xs text-muted">deployed</span>
        {deployed.length === 0 ? (
          <span className="text-xs text-muted" data-testid="lawn-hud-deployed-empty">
            none yet
          </span>
        ) : (
          deployed.map((d) => (
            <span
              key={d.ptr}
              className="inline-flex items-center gap-1 rounded-pill border border-border bg-panel-inset px-2 py-0.5 text-xs text-text"
              data-testid={`lawn-hud-deployed-${d.ptr}`}
            >
              <TypeIcon side={d.side} typeId={d.typeId} size={16} />
              {d.typeName ?? `#${d.typeId}`}
            </span>
          ))
        )}
      </div>

      <div
        className="flex items-center gap-1 rounded-sm border border-border-control p-0.5"
        data-testid="lawn-hud-playback"
        title="No playback control exists yet — the game itself runs the simulation, this overlay only observes it"
      >
        <button
          type="button"
          disabled
          aria-label="Pause"
          className="cursor-not-allowed rounded-sm px-2 py-1 text-xs text-faint opacity-60"
        >
          ❚❚
        </button>
        <button
          type="button"
          disabled
          aria-label="Normal speed"
          className="cursor-not-allowed rounded-sm px-2 py-1 text-xs text-faint opacity-60"
        >
          1×
        </button>
        <button
          type="button"
          disabled
          aria-label="Double speed"
          className="cursor-not-allowed rounded-sm px-2 py-1 text-xs text-faint opacity-60"
        >
          2×
        </button>
      </div>
    </div>
  );
}

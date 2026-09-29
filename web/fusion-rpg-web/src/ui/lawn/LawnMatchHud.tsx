import { Badge, TypeIcon } from "@/ui";
import { LawnHudCommander, type LawnMatchCommanderChip } from "@/features/lawn/LawnHudCommander";
import { logLawnInteractive } from "@/ui/lawn/lawnInteractiveObserve";
import { cn } from "@/lib/cn";

export type LawnDeployedChip = {
  ptr: string;
  side: "plant" | "zombie";
  typeId: number;
  typeName?: string | null;
  instanceId?: string;
};

/**
 * Band-1 match strip (lawn-interactive `lawn-match-hud`).
 * Extends plate 04 / prior LawnHud with clock, connection, Field CTA.
 */
export function LawnMatchHud({
  sun,
  wave,
  maxWave,
  hugeWave,
  clockLabel,
  phase,
  connection,
  selectionLabel,
  matchCommander,
  deployed,
  onOpenCommanderSheet,
  onField,
  className
}: {
  sun?: number;
  wave?: number;
  maxWave?: number;
  hugeWave?: boolean;
  /** Wave/match clock when observe provides it. */
  clockLabel?: string;
  phase?: string;
  connection?: "connected" | "disconnected" | "optional";
  selectionLabel?: string;
  matchCommander?: LawnMatchCommanderChip;
  deployed: LawnDeployedChip[];
  onOpenCommanderSheet?: () => void;
  onField?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "safe-area-top mb-3 flex flex-wrap items-center gap-3 rounded-md border border-border bg-soil-raised px-3 py-2",
        className
      )}
      data-testid="lawn-match-hud"
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

      {clockLabel ? (
        <span className="font-mono text-sm text-muted" data-testid="lawn-match-hud-clock">
          {clockLabel}
        </span>
      ) : null}

      {phase ? (
        <Badge tone="neutral" data-testid="lawn-match-hud-phase">
          {phase}
        </Badge>
      ) : null}

      {connection ? (
        <span
          data-testid="lawn-match-hud-connection"
          data-connection={connection}
          className="text-xs text-muted"
        >
          {connection === "connected"
            ? "Live"
            : connection === "optional"
              ? "Observe (Fusion optional)"
              : "Disconnected"}
        </span>
      ) : null}

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
              {d.typeName ?? (d.instanceId ? "Fielded" : `#${d.typeId}`)}
            </span>
          ))
        )}
      </div>

      {selectionLabel ? (
        <span className="text-xs text-muted" data-testid="lawn-match-hud-selection">
          {selectionLabel}
        </span>
      ) : null}

      {onField ? (
        <button
          type="button"
          data-testid="lawn-match-hud-field"
          className="rounded-md border border-border bg-panel px-3 py-1 text-sm font-semibold text-text"
          onClick={() => {
            logLawnInteractive("hud.field", {});
            onField();
          }}
        >
          Field
        </button>
      ) : null}

      <div
        className="flex items-center gap-1 rounded-sm border border-border-control p-0.5"
        data-testid="lawn-hud-playback"
        title="No playback control exists yet — the game itself runs the simulation, this overlay only observes it"
      >
        <button type="button" disabled aria-label="Pause" className="cursor-not-allowed rounded-sm px-2 py-1 text-xs text-faint opacity-60">
          ❚❚
        </button>
        <button type="button" disabled aria-label="Normal speed" className="cursor-not-allowed rounded-sm px-2 py-1 text-xs text-faint opacity-60">
          1×
        </button>
        <button type="button" disabled aria-label="Double speed" className="cursor-not-allowed rounded-sm px-2 py-1 text-xs text-faint opacity-60">
          2×
        </button>
      </div>
    </div>
  );
}

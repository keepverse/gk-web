import { Badge, Button } from "@/ui";
import { cn } from "@/lib/cn";

export type AuraSlotState = "active" | "equipped-inactive" | "locked";

/**
 * aura-skill T18c (`spec-aura-surface.md` §2.1): one aura — GG-55 requires never disabling without
 * saying why, and "enabling X switched off Y" is the same class of information. This component is
 * purely presentational: the caller (`ActionsTab`) resolves catalog + runtime state and mutation
 * wiring; this only renders it and forwards the enable/disable intent.
 *
 * <para>Active vs equipped-inactive must be "unmistakably distinct, not a subtle tint" — a colored
 * `Badge` (not a border-opacity tweak) carries that, matching this program's own Badge-tone
 * convention for other binary states elsewhere in the actor sheet.</para>
 */
export function AuraSlot({
  auraId,
  state,
  lockedReason,
  refusalReason,
  upkeepNote,
  busy,
  onEnable,
  onDisable
}: {
  auraId: string;
  state: AuraSlotState;
  lockedReason?: string;
  refusalReason?: string;
  /** aura-skill T18c: which pool + how much per tick, from a REAL authored cost
   * (`RpgStore.ListCosts`) — undefined when no cost has been authored for this aura yet (today's
   * real state for all twelve), never a fabricated placeholder. Shown before the toggle so it is
   * visible before committing, per spec-aura-surface.md §2.1. */
  upkeepNote?: string;
  busy?: boolean;
  onEnable: () => void;
  onDisable: () => void;
}) {
  if (state === "locked") {
    return (
      <div
        className={cn(
          "grid place-items-center gap-1 rounded-sm border p-3 text-center",
          "cursor-not-allowed border-transparent text-faint opacity-60"
        )}
        title={lockedReason}
        data-testid={`aura-slot-${auraId}`}
        data-state="locked"
      >
        <span aria-hidden="true" className="text-lg leading-none">
          🔒
        </span>
        <span className="text-2xs font-extrabold leading-none tracking-wide">{auraId}</span>
      </div>
    );
  }

  const isActive = state === "active";

  return (
    <div
      className="flex flex-col gap-1 rounded-sm border border-border-control p-3"
      data-testid={`aura-slot-${auraId}`}
      data-state={state}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-2xs font-extrabold uppercase tracking-wide">{auraId}</span>
        <Badge tone={isActive ? "ok" : "neutral"} data-testid={`aura-slot-${auraId}-badge`} aria-selected={isActive}>
          {isActive ? "Active" : "Equipped"}
        </Badge>
      </div>

      {upkeepNote ? (
        <span className="text-2xs text-muted" data-testid={`aura-slot-${auraId}-upkeep`}>
          {upkeepNote}
        </span>
      ) : null}

      <Button
        className="mt-1"
        disabled={busy}
        title={refusalReason}
        data-testid={`aura-slot-${auraId}-toggle`}
        onClick={isActive ? onDisable : onEnable}
      >
        {isActive ? "Disable" : "Enable"}
      </Button>

      {refusalReason ? (
        <span className="text-2xs text-bad" data-testid={`aura-slot-${auraId}-refusal`}>
          {refusalReason}
        </span>
      ) : null}
    </div>
  );
}

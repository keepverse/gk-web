import { Badge, Button } from "@/ui";
import { cn } from "@/lib/cn";

/**
 * A30 (actions-tab-fe-wiring, T70) — audit finding: `AuraSlot`'s 3-state model
 * (`"active" | "equipped-inactive" | "locked"`) does not fit actions as-is. Auras are a toggle;
 * actions additionally have a COOLDOWN state (equipped, held, but temporarily unusable) with no aura
 * equivalent. There is also no "locked" concept here at all — unlike the twelve fixed auras, there is
 * no small, browsable catalog of every action that exists; this grid only ever shows what the
 * specimen actually HOLDS (spec's own design point 1: "the held set is the catalog"). So the real
 * states are: held-but-not-equipped, equipped, and equipped-on-cooldown.
 *
 * `"equipped-cooldown"` is a real, named state with NO live production signal today (the same
 * honest-gap shape `isMidRun`/`AggressionOf` already established elsewhere in this program) — no
 * per-action cooldown telemetry reaches the FE yet, so this branch is exercised by nothing real until
 * that wiring lands. Kept in the type rather than omitted so the render code and its tests already
 * have a real slot for it, not a `/idea-ui` deferral.
 */
export type ActionSlotState = "held" | "equipped" | "equipped-cooldown";

export function ActionSlot({
  actionId,
  state,
  busy,
  refusalReason,
  onEquip,
  onUnequip,
  onDiscard
}: {
  actionId: string;
  state: ActionSlotState;
  busy?: boolean;
  refusalReason?: string;
  onEquip: () => void;
  onUnequip: () => void;
  onDiscard: () => void;
}) {
  const isEquipped = state === "equipped" || state === "equipped-cooldown";
  const onCooldown = state === "equipped-cooldown";

  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-sm border p-3",
        onCooldown ? "border-border-control opacity-70" : "border-border-control"
      )}
      data-testid={`action-slot-${actionId}`}
      data-state={state}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-2xs font-extrabold uppercase tracking-wide">{actionId}</span>
        <Badge
          tone={onCooldown ? "neutral" : isEquipped ? "ok" : "neutral"}
          data-testid={`action-slot-${actionId}-badge`}
        >
          {onCooldown ? "Cooldown" : isEquipped ? "Equipped" : "Held"}
        </Badge>
      </div>

      <div className="mt-1 flex flex-wrap gap-1">
        <Button
          size="sm"
          disabled={busy || onCooldown}
          title={onCooldown ? "On cooldown — cannot change equip state right now" : refusalReason}
          data-testid={`action-slot-${actionId}-toggle`}
          onClick={isEquipped ? onUnequip : onEquip}
        >
          {isEquipped ? "Unequip" : "Equip"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          title={busy ? "Working…" : undefined}
          data-testid={`action-slot-${actionId}-discard`}
          onClick={onDiscard}
        >
          Discard
        </Button>
      </div>

      {refusalReason ? (
        <span className="text-2xs text-bad" data-testid={`action-slot-${actionId}-refusal`}>
          {refusalReason}
        </span>
      ) : null}
    </div>
  );
}

import { cn } from "@/lib/cn";
import { logLawnInteractive } from "@/ui/lawn/lawnInteractiveObserve";

export type CommanderOrderSlot = {
  id: string;
  slot: number;
  name: string;
  /** Cost label naming the stock — never bare number alone. */
  costLabel: string;
  locked?: boolean;
  lockedReason?: string;
  unaffordable?: boolean;
  unaffordableReason?: string;
};

/**
 * Band-1 off-board combat book (1–9). Empty corpus → locked-visible slots (GG-44).
 */
export function CommanderActionBar({
  slots,
  armedId,
  onArm,
  className
}: {
  slots: CommanderOrderSlot[];
  armedId?: string | null;
  onArm: (slot: CommanderOrderSlot) => void;
  className?: string;
}) {
  const nine = Array.from({ length: 9 }, (_, i) => {
    const n = i + 1;
    return (
      slots.find((s) => s.slot === n) ??
      ({
        id: `locked-${n}`,
        slot: n,
        name: "Locked",
        costLabel: "—",
        locked: true,
        lockedReason: "Orders unlock with the action corpus"
      } satisfies CommanderOrderSlot)
    );
  });

  return (
    <div
      data-testid="commander-action-bar"
      className={cn(
        "band-hud safe-area-bottom flex flex-wrap justify-center gap-1 px-2 py-2 sm:flex-nowrap",
        className
      )}
    >
      {nine.map((s) => {
        const disabled = Boolean(s.locked || s.unaffordable);
        const reason = s.lockedReason ?? s.unaffordableReason;
        return (
          <button
            key={s.id}
            type="button"
            data-testid={`commander-action-slot-${s.slot}`}
            data-armed={armedId === s.id}
            data-locked={Boolean(s.locked)}
            disabled={disabled}
            title={reason}
            onClick={() => {
              if (disabled) return;
              logLawnInteractive("order.arm", { actionId: s.id, slot: s.slot });
              onArm(s);
            }}
            className={cn(
              "flex w-[calc(20%-0.25rem)] max-w-[4.75rem] flex-col items-center rounded-md border border-border bg-panel px-1 py-1 text-xs sm:w-auto sm:min-w-[4.5rem] sm:max-w-none sm:px-2",
              "min-h-[3.25rem]",
              armedId === s.id && "ring-2 ring-lawn-hot",
              s.unaffordable && "border-bad text-bad",
              s.locked && "cursor-not-allowed opacity-80 border-dashed"
            )}
          >
            <span className="font-mono text-muted">{s.slot}</span>
            <span className="max-w-full truncate px-0.5 text-center font-semibold text-text">{s.name}</span>
            <span
              className={cn("text-2xs", s.unaffordable ? "text-bad" : "text-muted")}
              data-testid={`commander-action-cost-${s.slot}`}
            >
              {s.costLabel}
            </span>
          </button>
        );
      })}
    </div>
  );
}

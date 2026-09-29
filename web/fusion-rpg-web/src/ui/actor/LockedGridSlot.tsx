import { cn } from "@/lib/cn";

/**
 * actor-sheet program, locked-preview-tabs — shared by Actions and Passives. Reuses Rail.tsx's own
 * real locked-state classes (`cursor-not-allowed border-transparent text-faint opacity-60`, a small
 * lock badge) rather than the design plate's `.actionslot`/`.passnode` CSS, which has no React
 * equivalent anywhere in this app. Deliberately not a <button> — nothing here is clickable, and a
 * disabled button would still be focusable/tab-stoppable for an action that can never do anything.
 *
 * `id` is caller-supplied rather than derived from `label` — a display-text rename should never
 * silently rename the testid a future test might target.
 */
export function LockedGridSlot({ id, label, reason }: { id: string; label: string; reason: string }) {
  return (
    <div
      className={cn(
        "grid place-items-center gap-1 rounded-sm border p-3 text-center",
        "cursor-not-allowed border-transparent text-faint opacity-60"
      )}
      title={reason}
      data-testid={`locked-slot-${id}`}
    >
      <span aria-hidden="true" className="text-lg leading-none">
        🔒
      </span>
      <span className="text-2xs font-extrabold leading-none tracking-wide">{label}</span>
    </div>
  );
}

import { Badge } from "@/ui";

export type LawnMatchCommanderChip = {
  id: string;
  displayName: string;
  auraDisplayName: string | null;
};

/** Read-only commander + aura chips from the match snapshot (plate 04 §A). */
export function LawnHudCommander({
  commander,
  onOpenSheet
}: {
  commander: LawnMatchCommanderChip;
  onOpenSheet?: () => void;
}) {
  const content = (
    <>
      <Badge tone="neutral" data-testid="lawn-hud-commander">
        {commander.displayName}
      </Badge>
      {commander.auraDisplayName ? (
        <Badge tone="neutral" data-testid="lawn-hud-aura">
          {commander.auraDisplayName}
        </Badge>
      ) : null}
    </>
  );

  if (!onOpenSheet) {
    return (
      <div className="flex flex-wrap items-center gap-1.5" data-testid="lawn-hud-commander-cluster">
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      className="flex flex-wrap items-center gap-1.5 rounded-sm border border-transparent p-0.5 hover:border-border focus-visible:border-border"
      data-testid="lawn-hud-commander-open"
      onClick={onOpenSheet}
    >
      {content}
    </button>
  );
}

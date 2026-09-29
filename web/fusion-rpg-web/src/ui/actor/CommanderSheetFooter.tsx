import { Button } from "@/ui/Button";

/** Commander role footer for ActorPanel — Set default / Defend the lawn only (plate 08 §I). */
export function CommanderSheetFooter({
  isDefault,
  setDefaultPending,
  editsScope,
  onClose,
  onSetDefault,
  onDefendLawn,
  onOpenCommandersList
}: {
  isDefault: boolean;
  setDefaultPending: boolean;
  editsScope?: "nextRun";
  onClose: () => void;
  onSetDefault: () => void;
  onDefendLawn: () => void;
  onOpenCommandersList: () => void;
}) {
  return (
    <div className="flex w-full flex-wrap items-center justify-end gap-2">
      <span className="mr-auto text-xs text-muted">
        {isDefault ? "Default lawn commander" : "Not default yet"} ·{" "}
        <button
          type="button"
          className="text-text underline-offset-2 hover:underline"
          data-testid="commander-sheet-change-in-list"
          onClick={onOpenCommandersList}
        >
          change in list
        </button>
      </span>
      <Button variant="ghost" size="sm" data-testid="commander-sheet-close" onClick={onClose}>
        Close
      </Button>
      <Button
        size="sm"
        data-testid="commander-sheet-set-default"
        disabled={isDefault || setDefaultPending}
        title={setDefaultPending ? "Working…" : isDefault ? "Already the default commander" : undefined}
        onClick={onSetDefault}
      >
        {editsScope === "nextRun" ? "Set default (next run)" : "Set default"}
      </Button>
      <Button size="sm" variant="ghost" data-testid="commander-sheet-defend" onClick={onDefendLawn}>
        Defend the lawn
      </Button>
    </div>
  );
}

import { DialogShell } from "@/shell/DialogShell";
import { formatMagnitude } from "@/i18n/magnitude";
import { LoamFigure } from "@/ui/world/LoamFigure";
import { buildCommitStakeRows, type CommitStakeInput, type StakeRow } from "./stakeRows";

export type CommitLegionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  input: CommitStakeInput;
  onConfirm: () => void;
};

function RowBody({ row }: { row: StakeRow }) {
  switch (row.data.kind) {
    case "garrison":
      return (
        <span data-testid="stake-row-garrison-value">
          {formatMagnitude(row.data.count)} bound creature{row.data.count.value === 1 ? "" : "s"} leave your ground
        </span>
      );
    case "supply":
      if (row.data.amount.state !== "known") {
        return (
          <span data-testid="stake-row-supply-pending">
            {row.data.amount.state === "pending" ? row.data.amount.reason : "no supply carried"}
          </span>
        );
      }
      return <LoamFigure kind="stock" amount={row.data.amount.value} capacity={row.data.capacity} />;
    case "burn":
      if (row.data.amount.state !== "known") {
        return (
          <span data-testid="stake-row-burn-pending">
            {row.data.amount.state === "pending" ? row.data.amount.reason : "not burning"}
          </span>
        );
      }
      return <LoamFigure kind="flow" amount={row.data.amount.value} period="every night" />;
    case "runway": {
      const { turnsLeft, currentTurn } = row.data;
      if (turnsLeft.state === "pending") {
        return <span data-testid="stake-row-runway-pending">{turnsLeft.reason}</span>;
      }
      if (turnsLeft.state === "absent" || turnsLeft.value == null) {
        return <span data-testid="stake-row-runway-value">not burning supply</span>;
      }
      return (
        <span data-testid="stake-row-runway-value">
          runs out on night {currentTurn + turnsLeft.value}
        </span>
      );
    }
    case "fade": {
      const afterText = row.data.after.state === "known" ? formatMagnitude(row.data.after.value) : null;
      return (
        <span data-testid="stake-row-fade-value">
          {formatMagnitude(row.data.before)} →{" "}
          {afterText ?? (row.data.after.state === "pending" ? row.data.after.reason : "not projected")}
        </span>
      );
    }
    case "waiting": {
      if (!row.data.force) {
        return <span data-testid="stake-row-waiting-value">nothing known to be waiting</span>;
      }
      return (
        <span data-testid="stake-row-waiting-value">
          {row.data.force.exact
            ? formatMagnitude(row.data.force.strength)
            : `${row.data.force.bandName} (up to ${formatMagnitude(row.data.force.bandCeiling)})`}
        </span>
      );
    }
    default: {
      const exhaustive: never = row.data;
      throw new Error(`RowBody: unhandled stake row ${JSON.stringify(exhaustive)}`);
    }
  }
}

/**
 * world-stage W101 (spec-world-confirms.md §1, plate 11 §K.1) — the commit-a-legion confirm. All
 * six stakes come from `buildCommitStakeRows` (`stakeRows.ts`) as data, so a dropped row is a
 * visible diff here rather than a silently shorter dialog. Filing, not executing: closes with the
 * timing truth so the order's own queued nature is never mistaken for an immediate result.
 */
export function CommitLegionDialog({ open, onOpenChange, input, onConfirm }: CommitLegionDialogProps) {
  const rows = buildCommitStakeRows(input);

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Commit this legion to march"
      testId="commit-legion-dialog"
      footer={
        <>
          <button type="button" data-testid="commit-legion-cancel" onClick={() => onOpenChange(false)}>
            Cancel
          </button>
          <button
            type="button"
            data-testid="commit-legion-confirm"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            File the order
          </button>
        </>
      }
    >
      <ul data-testid="commit-legion-stakes">
        {rows.map((row) => (
          <li key={row.id} data-testid={`stake-row-${row.id}`} data-tone={row.tone}>
            <span aria-hidden="true">{row.glyph}</span> <span>{row.says}</span> <RowBody row={row} />
          </li>
        ))}
      </ul>
      <p data-testid="commit-legion-timing">A fight is likely. Nothing resolves until you end the turn.</p>
    </DialogShell>
  );
}

import { cn } from "@/lib/cn";
import type { StatusCatalogRow } from "@/contract/actorSurface";

/** Shared glyph for Condition strip, Status tab, and Band B HUD catalog path. */
export function StatusGlyph({
  status,
  live,
  selected,
  onSelect,
  testId
}: {
  status: StatusCatalogRow;
  live?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  testId?: string;
}) {
  return (
    <button
      type="button"
      title={status.reading}
      data-testid={testId ?? `status-glyph-${status.id}`}
      data-live={live ? "true" : "false"}
      onClick={onSelect}
      className={cn(
        "relative rounded-sm border bg-panel-inset p-2 text-center",
        selected ? "border-lawn-hot" : "border-border-control"
      )}
    >
      <span className="block font-display text-lg" style={{ color: status.color }}>
        {status.hudToken}
      </span>
      <span className="block truncate text-2xs text-muted">{status.displayName}</span>
      {live ? (
        <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-lawn-hot" aria-label="live" />
      ) : null}
    </button>
  );
}

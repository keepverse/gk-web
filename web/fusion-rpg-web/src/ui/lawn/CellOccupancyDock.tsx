import { useEffect, useMemo, useState } from "react";
import { ActorCollection, type ActorCollectionItem, type ActorCollectionQuery } from "@/ui/actor";
import {
  adaptOccupants,
  encodeLawnSel,
  type LawnCollectionRow
} from "@/ui/lawn/adaptOccupant";
import { LAWN_DOCK_WIDTH_PX } from "@/ui/lawn/lawnPresentationTokens";
import { logLawnInteractive } from "@/ui/lawn/lawnInteractiveObserve";
import type { Occupant } from "@/features/lawn/lawnViewModel";
import { cn } from "@/lib/cn";

export function CellOccupancyDock({
  open,
  occupants,
  cellLabel,
  selectionKey,
  onSelectRow,
  onClose,
  className
}: {
  open: boolean;
  occupants: Occupant[];
  cellLabel: string;
  selectionKey?: string | null;
  onSelectRow: (row: LawnCollectionRow) => void;
  onClose?: () => void;
  className?: string;
}) {
  const [query, setQuery] = useState<ActorCollectionQuery>({
    search: "",
    side: "all",
    sort: "default"
  });

  // Reset query when the cell (occupant set identity) changes — new collection.
  const cellFingerprint = occupants.map((o) => o.ptr).join("|");
  useEffect(() => {
    setQuery({ search: "", side: "all", sort: "default" });
  }, [cellFingerprint]);

  useEffect(() => {
    if (!open) return;
    logLawnInteractive("dock.open", { cellLabel, count: occupants.length });
    // T13: focus first collection item when present; otherwise the dock title.
    requestAnimationFrame(() => {
      const firstItem = document.querySelector<HTMLElement>(
        '[data-testid="cell-occupancy-dock"] [data-testid*="-item-"]'
      );
      if (firstItem) {
        firstItem.focus({ preventScroll: true });
        return;
      }
      const title = document.querySelector<HTMLElement>('[data-testid="cell-occupancy-dock-title"]');
      title?.setAttribute("tabindex", "-1");
      title?.focus({ preventScroll: true });
    });
  }, [open, cellLabel, occupants.length]);

  const rows = useMemo(() => adaptOccupants(occupants), [occupants]);
  const items: ActorCollectionItem[] = useMemo(
    () =>
      rows.map((r) => ({
        key: r.key,
        label: r.displayName,
        sideLabel: r.side,
        chip: r.chip,
        hpFraction: r.hpFraction
      })),
    [rows]
  );

  if (!open) return null;

  return (
    <aside
      data-testid="cell-occupancy-dock"
      data-dock-width={LAWN_DOCK_WIDTH_PX}
      className={cn(
        "band-panel motion-safe:transition-[width,opacity] motion-safe:duration-150 flex shrink-0 flex-col gap-2 border-r border-border bg-soil-raised p-3",
        "motion-reduce:transition-none",
        className
      )}
      style={{ width: LAWN_DOCK_WIDTH_PX }}
      data-reduced-motion="respect"
    >
      <div className="flex items-center gap-2">
        <h2 className="min-w-0 flex-1 font-display text-lg text-text" data-testid="cell-occupancy-dock-title">
          {cellLabel}
        </h2>
        {onClose ? (
          <button
            type="button"
            data-testid="cell-occupancy-dock-close"
            className="rounded-sm border border-border px-2 py-0.5 text-xs text-muted"
            onClick={onClose}
          >
            Esc
          </button>
        ) : null}
      </div>
      <ActorCollection
        testId="cell-occupancy-collection"
        items={items}
        density="list"
        query={query}
        onQueryChange={setQuery}
        selectionKey={selectionKey}
        showHpSliver
        onSelect={(key) => {
          const row = rows.find((r) => r.key === key);
          if (!row) return;
          logLawnInteractive("dock.select", {
            key,
            chip: row.chip,
            sel: encodeLawnSel(row)
          });
          onSelectRow(row);
        }}
        empty={<p className="text-sm text-muted">No living occupants on this cell.</p>}
      />
    </aside>
  );
}

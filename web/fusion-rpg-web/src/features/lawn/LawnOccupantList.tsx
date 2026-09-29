import { Badge, DataTable, TypeIcon, type DataTableColumn } from "@/ui";
import type { Occupant } from "./lawnViewModel";
import { normalizePtr } from "./lawnViewModel";

export function LawnOccupantList({
  living,
  onCanvasPtrs,
  selectedPtr,
  onSelect
}: {
  living: Occupant[];
  onCanvasPtrs: Set<string>;
  selectedPtr?: string;
  onSelect: (occ: Occupant) => void;
}) {
  const canvasCount = Math.min(onCanvasPtrs.size, living.length);
  const columns: DataTableColumn<Occupant>[] = [
    {
      key: "icon",
      header: "",
      cell: (row) => <TypeIcon side={row.side} typeId={row.typeId} size={28} />
    },
    {
      key: "name",
      header: "Type",
      cell: (row) => row.typeName ?? `${row.side} #${row.typeId}`
    },
    {
      key: "cell",
      header: "r,c",
      cell: (row) =>
        row.row != null && row.col != null && row.col >= 0
          ? `${row.row},${row.col}`
          : "—"
    },
    {
      key: "hp",
      header: "HP",
      cell: (row) =>
        row.hp != null ? `${row.hp}${row.maxHp != null ? `/${row.maxHp}` : ""}` : "—"
    },
    {
      key: "side",
      header: "Side",
      cell: (row) => row.side
    },
    {
      key: "where",
      header: "Where",
      cell: (row) =>
        onCanvasPtrs.has(normalizePtr(row.ptr)) ? "canvas" : "list"
    }
  ];

  return (
    <div className="mt-4 border-t border-border pt-3" data-testid="lawn-occupant-list">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-text">Living</p>
        <Badge tone="neutral" data-testid="lawn-canvas-badge">
          canvas {canvasCount} / living {living.length}
        </Badge>
      </div>
      <DataTable
        className="max-h-64"
        columns={columns}
        rows={living}
        rowKey={(row) => row.ptr}
        onRowClick={onSelect}
        rowClassName={(row) =>
          onCanvasPtrs.has(normalizePtr(row.ptr)) ? undefined : "text-muted"
        }
        empty={<p className="text-sm text-muted">No living occupants.</p>}
      />
      {selectedPtr ? (
        <p className="mt-1 text-xs text-muted">Selected {selectedPtr}</p>
      ) : null}
    </div>
  );
}

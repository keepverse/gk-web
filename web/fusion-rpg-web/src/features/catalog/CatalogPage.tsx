import { useTypes, type TypeItem } from "@/lib/bus";
import { Page } from "@/layouts/Page";
import { Badge, DataTable, EmptyState, HelpText, Panel, type DataTableColumn } from "@/ui";

const columns: DataTableColumn<TypeItem>[] = [
  {
    key: "side",
    header: "Side",
    cell: (row) => (
      <Badge tone={row.side === "plant" ? "plant" : row.side === "zombie" ? "zombie" : "neutral"}>
        {row.side}
      </Badge>
    )
  },
  { key: "type", header: "Id", cell: (row) => row.type },
  { key: "typeName", header: "Name", cell: (row) => row.typeName ?? "—" },
  { key: "displayName", header: "Display", cell: (row) => row.displayName ?? "—" },
  { key: "hpBase", header: "First-seen HP (ref)", cell: (row) => row.hpBase ?? "—" },
  { key: "seen", header: "Seen", cell: (row) => row.seenCount },
  { key: "killed", header: "Killed", cell: (row) => row.killedCount }
];

export function CatalogPage() {
  const types = useTypes();

  return (
    <Page testId="page-types" title="Types" description="Type catalog captured from the game.">
      <Panel title="Type catalog" testId="panel-types">
        <HelpText>
          Names and first-seen sample only. HP/ATK here are a reference snapshot, not live combat
          stats. Open a run’s spawn dumps for the real object.
        </HelpText>
        <DataTable
          columns={columns}
          rows={types.data ?? []}
          rowKey={(row) => `${row.side}-${row.type}`}
          empty={
            <EmptyState
              title="No types yet"
              hint="Play a match or click Hello in sim."
              className="mt-3"
            />
          }
        />
      </Panel>
    </Page>
  );
}

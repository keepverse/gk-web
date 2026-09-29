import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiBase, getJson } from "@/lib/bus/rest";
import { Page } from "@/layouts/Page";
import { EmptyState, HelpText, Panel, Select, TextInput } from "@/ui";

type DumpLayer = {
  name: string;
  source?: string | null;
  width: number;
  height: number;
  url: string;
};

type DumpItem = {
  side: string;
  typeId: number;
  typeName?: string | null;
  displayName?: string | null;
  layers: DumpLayer[];
  composedUrl?: string | null;
};

export function IconDumpPage() {
  const [side, setSide] = useState("");
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const dumps = useQuery({
    queryKey: ["iconDumps", side],
    queryFn: () =>
      getJson<{ items: DumpItem[] }>(
        side ? `/api/icons/dump?side=${encodeURIComponent(side)}` : "/api/icons/dump"
      )
  });

  const items = dumps.data?.items ?? [];
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        String(i.typeId).includes(q) ||
        (i.typeName ?? "").toLowerCase().includes(q) ||
        (i.displayName ?? "").toLowerCase().includes(q)
    );
  }, [items, filter]);

  const active = filtered.find((i) => `${i.side}:${i.typeId}` === selected) ?? filtered[0] ?? null;

  return (
    <Page
      testId="page-icon-dump"
      title="Icon dump"
      description="All almanac card layers captured from the game. Tell us the stack order and we will compose the real icon."
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select
          data-testid="icon-dump-side"
          value={side}
          onChange={(e) => {
            setSide(e.target.value);
            setSelected(null);
          }}
        >
          <option value="">all sides</option>
          <option value="plant">plant</option>
          <option value="zombie">zombie</option>
        </Select>
        <TextInput
          data-testid="icon-dump-filter"
          placeholder="filter type / name"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <HelpText>
          {filtered.length} dumps · SQLite type_icon_layers / type_icons
        </HelpText>
      </div>

      {dumps.isLoading ? (
        <HelpText>Loading dumps…</HelpText>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No icon dumps yet"
          hint="Open the in-game almanac and select plant/zombie cards while the RPG server is running."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
          <Panel title="Types" testId="icon-dump-list">
            <ul className="max-h-[70vh] space-y-1 overflow-auto text-sm">
              {filtered.map((i) => {
                const id = `${i.side}:${i.typeId}`;
                const label = i.displayName || i.typeName || `#${i.typeId}`;
                const on = (active && `${active.side}:${active.typeId}` === id) || selected === id;
                return (
                  <li key={id}>
                    <button
                      type="button"
                      data-testid={`icon-dump-item-${i.side}-${i.typeId}`}
                      className={
                        on
                          ? "w-full rounded-sm bg-lawn px-2 py-1.5 text-left text-text"
                          : "w-full rounded-sm px-2 py-1.5 text-left text-muted hover:bg-soil-raised"
                      }
                      onClick={() => setSelected(id)}
                    >
                      <span className="font-semibold">{i.side}</span> {label}{" "}
                      <span className="text-xs opacity-70">({i.layers.length})</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Panel>

          {active ? (
            <Panel
              title={`${active.side} #${active.typeId} — ${active.displayName || active.typeName || "unnamed"}`}
              testId="icon-dump-detail"
            >
              <HelpText className="mb-3">
                Portrait for Progression is layer <span className="font-mono text-text">image</span>{" "}
                (AlmanacCardUI.image). Other tiles are frames/masks — keep them for compose experiments.
              </HelpText>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {active.layers.map((layer) => {
                  const isPortrait = layer.name === "image";
                  return (
                  <figure
                    key={layer.name}
                    data-testid={`icon-dump-layer-${layer.name}`}
                    className={
                      isPortrait
                        ? "rounded-md border-2 border-lawn-hot bg-panel-inset p-2"
                        : "rounded-md border border-border bg-panel-inset p-2"
                    }
                  >
                    <img
                      src={`${apiBase()}${layer.url}`}
                      alt={layer.name}
                      className="mx-auto max-h-40 object-contain"
                      style={{ imageRendering: "pixelated" }}
                    />
                    <figcaption className="mt-2 break-all text-xs">
                      <div className="font-semibold text-text">
                        {layer.name}
                        {isPortrait ? " · portrait" : ""}
                      </div>
                      <div className="text-muted">
                        {layer.width}×{layer.height}
                      </div>
                      {layer.source ? <div className="text-muted">{layer.source}</div> : null}
                    </figcaption>
                  </figure>
                  );
                })}
              </div>
            </Panel>
          ) : null}
        </div>
      )}
    </Page>
  );
}

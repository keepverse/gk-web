import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getJson } from "@/lib/bus/rest";
import { Page } from "@/layouts/Page";
import { EmptyState, HelpText, Panel, Select, TextInput } from "@/ui";

type AlmanacDump = {
  side: string;
  typeId: number;
  typeName?: string | null;
  displayName?: string | null;
  fields: Record<string, string | null | undefined>;
  sources?: Record<string, string> | null;
  capturedUtc: string;
};

const PRIORITY = ["name", "displayName", "enumName", "cost", "info", "introduce", "uiName", "uiCost", "uiInfo", "uiIntroduce"];

export function AlmanacDumpPage() {
  const [side, setSide] = useState("");
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const dumps = useQuery({
    queryKey: ["almanacDumps", side],
    queryFn: () =>
      getJson<{ items: AlmanacDump[] }>(
        side ? `/api/almanac/dump?side=${encodeURIComponent(side)}` : "/api/almanac/dump"
      )
  });

  const items = dumps.data?.items ?? [];
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => {
      if (String(i.typeId).includes(q)) return true;
      if ((i.typeName ?? "").toLowerCase().includes(q)) return true;
      if ((i.displayName ?? "").toLowerCase().includes(q)) return true;
      return Object.values(i.fields).some((v) => (v ?? "").toLowerCase().includes(q));
    });
  }, [items, filter]);

  const active = filtered.find((i) => `${i.side}:${i.typeId}` === selected) ?? filtered[0] ?? null;

  const orderedKeys = useMemo(() => {
    if (!active) return [];
    const keys = Object.keys(active.fields);
    const pri = PRIORITY.filter((k) => keys.includes(k));
    const rest = keys.filter((k) => !PRIORITY.includes(k)).sort();
    return [...pri, ...rest];
  }, [active]);

  return (
    <Page
      testId="page-almanac-dump"
      title="Almanac text"
      description="Pedia name / info / cost / introduce and UI TMP scraped on almanac select. Review here before promoting into Progression."
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select
          data-testid="almanac-dump-side"
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
          data-testid="almanac-dump-filter"
          placeholder="filter type / text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <HelpText>{filtered.length} dumps · SQLite type_almanac_dump</HelpText>
      </div>

      {dumps.isLoading ? (
        <HelpText>Loading…</HelpText>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No almanac text yet"
          hint="Open the in-game pedia and select cards. Text uploads once per type (cached in DB)."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
          <Panel title="Types" testId="almanac-dump-list">
            <ul className="max-h-[70vh] space-y-1 overflow-auto text-sm">
              {filtered.map((i) => {
                const id = `${i.side}:${i.typeId}`;
                const label = i.displayName || i.typeName || i.fields.name || `#${i.typeId}`;
                const on = active && `${active.side}:${active.typeId}` === id;
                return (
                  <li key={id}>
                    <button
                      type="button"
                      data-testid={`almanac-dump-item-${i.side}-${i.typeId}`}
                      className={
                        on
                          ? "w-full rounded-sm bg-lawn px-2 py-1.5 text-left text-text"
                          : "w-full rounded-sm px-2 py-1.5 text-left text-muted hover:bg-soil-raised"
                      }
                      onClick={() => setSelected(id)}
                    >
                      <span className="font-semibold">{i.side}</span> {label}{" "}
                      <span className="text-xs opacity-70">({Object.keys(i.fields).length})</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Panel>

          {active ? (
            <Panel
              title={`${active.side} #${active.typeId} — ${active.displayName || active.typeName || "unnamed"}`}
              testId="almanac-dump-detail"
            >
              <HelpText className="mb-3">
                Captured {active.capturedUtc}. Prefer PlantInfo/ZombieInfo fields; ui_* are live TMP scrapes.
              </HelpText>
              <div className="space-y-3">
                {orderedKeys.map((key) => (
                  <div
                    key={key}
                    data-testid={`almanac-field-${key}`}
                    className="rounded-md border border-border bg-panel-inset p-3"
                  >
                    <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-mono text-sm font-semibold text-sun">{key}</span>
                      {active.sources?.[key] ? (
                        <span className="text-xs text-muted">{active.sources[key]}</span>
                      ) : null}
                    </div>
                    <pre className="whitespace-pre-wrap break-words font-ui text-sm text-text">
                      {active.fields[key] || "—"}
                    </pre>
                  </div>
                ))}
              </div>
            </Panel>
          ) : null}
        </div>
      )}
    </Page>
  );
}

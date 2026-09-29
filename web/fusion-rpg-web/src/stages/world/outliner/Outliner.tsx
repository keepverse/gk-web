import { useEffect, useRef, useState } from "react";
import type { OutlinerGroup, OutlinerRow as OutlinerRowData, OutlinerRowKind } from "./outlinerModel";
import { LegionRow } from "./LegionRow";
import { SectorRow } from "./SectorRow";
import { useWorldVerbs } from "@/stages/world/turn/worldVerbs";

export type OutlinerProps = {
  groups: readonly OutlinerGroup[];
  selectedId: string | null;
  onSelect: (id: string, kind: OutlinerRowKind) => void;
  /** world-stage W93 / gaps D25 — fired only by `⏎`, never by a click or an arrow: the caller emits
   * `world:camera` `{ op: "centre", x, y }` from `sectorCenter` (not arrow pin-hop) and never reads
   * back from here. */
  onCentreRequest: (row: OutlinerRowData) => void;
  /** For a test to swap in a bare placeholder without every fact `LegionRow`/`SectorRow` (W92) render
   * — defaults to the real per-kind row body. */
  renderRow?: (row: OutlinerRowData) => React.ReactNode;
};

function defaultRenderRow(row: OutlinerRowData): React.ReactNode {
  if (row.kind === "legion") return <LegionRow legion={row.legion!} unresolved={row.flagged} />;
  return <SectorRow sector={row.sector!} fading={row.flagged} />;
}

/**
 * world-stage W91/W93 (spec-world-outliner.md) — `role="listbox"`, options with `aria-selected`,
 * group headers as real headings carrying their count in the accessible name, and one roving
 * `tabIndex` so the whole list is a single tab stop. Focus and selection are drawn and behave
 * differently: `↑`/`↓` move focus and change nothing else — never selection, never the camera; `⏎`
 * selects the focused row **and** requests the camera centre on it; a click does the first half of
 * that (select) without the second (centring is a deliberate, keyboard-only request per spec). `O`
 * (registered through `worldVerbs.ts`, W78's own single owner) focuses whichever row is currently
 * active, bringing the list itself into focus without touching the pointer.
 */
export function Outliner({ groups, selectedId, onSelect, onCentreRequest, renderRow }: OutlinerProps) {
  const allRows = groups.flatMap((g) => g.rows);
  const [activeId, setActiveId] = useState<string | null>(allRows[0]?.id ?? null);
  const activeRowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (allRows.length === 0) {
      setActiveId(null);
      return;
    }
    if (activeId == null || !allRows.some((r) => r.id === activeId)) {
      setActiveId(allRows[0]!.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allRows.map((r) => r.id).join(",")]);

  useWorldVerbs([{ key: "o", id: "world-outliner-focus", handler: () => activeRowRef.current?.focus() }]);

  function moveFocus(delta: number) {
    if (allRows.length === 0) return;
    const currentIndex = activeId ? allRows.findIndex((r) => r.id === activeId) : -1;
    const next = allRows[Math.min(allRows.length - 1, Math.max(0, currentIndex + delta))]!;
    setActiveId(next.id);
  }

  function selectAndCentre(row: OutlinerRowData) {
    onSelect(row.id, row.kind);
    onCentreRequest(row);
  }

  return (
    <div
      role="listbox"
      aria-label="Empire outliner"
      data-testid="outliner"
      onKeyDown={(event) => {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          moveFocus(1);
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          moveFocus(-1);
        } else if (event.key === "Enter") {
          event.preventDefault();
          const active = allRows.find((r) => r.id === activeId);
          if (active) selectAndCentre(active);
        }
      }}
    >
      {groups.map((group) => (
        <div key={group.kind}>
          <h3 data-testid={`outliner-group-${group.kind}`}>
            {group.label} ({group.count})
          </h3>
          {group.rows.map((row) => (
            <div
              key={row.id}
              ref={activeId === row.id ? activeRowRef : undefined}
              role="option"
              aria-selected={selectedId === row.id}
              tabIndex={activeId === row.id ? 0 : -1}
              data-testid={`outliner-row-${row.id}`}
              onClick={() => {
                setActiveId(row.id);
                onSelect(row.id, row.kind);
              }}
              onFocus={() => setActiveId(row.id)}
            >
              {(renderRow ?? defaultRenderRow)(row)}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

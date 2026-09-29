import { useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { adaptArmouryPage, adaptItemSurfaces } from "@/contract/adapt";
import type { ArmouryFilterState, ArmouryRowView, SurfaceStatusView } from "@/contract/types";
import { useArmoury, useItemSurfaces } from "@/lib/bus/items";
import { cn } from "@/lib/cn";
import { Banner, Button, TextInput } from "@/ui";
import { EmptyState } from "@/ui/EmptyState";
import { ArmouryFilter, EMPTY_ARMOURY_FILTER } from "./ArmouryFilter";
import { RarityPips } from "./ItemCard";

/**
 * The armoury — the held items, filtered, sorted and paged.
 *
 * **GG-50, and the band comes from the server.** The row count decides how much reaches the DOM:
 * every row renders below the first band, a window scrolls above it, and above the second the list
 * starts narrow rather than drawing thousands of nodes. ⛔ **No band refuses a row.** The
 * collection is the same size in all three; only the DOM is bounded.
 *
 * **The four designed states are the surface's own**, read from the surfaces route rather than
 * inferred from an empty array — a locked surface renders and says what unlocks it, a loading one
 * spins, an errored one says it could not read, and an empty one says the player owns nothing yet.
 * Those are four different sentences and this component never merges two of them.
 *
 * ⛔ **A locked row is never hidden.** The exemption is the first clause of the predicate, written
 * as one predicate rather than a union so the caller's chosen order survives.
 */

const ESTIMATED_ROW_HEIGHT = 52;
const LIST_HEIGHT_PX = 320;

function surfaceOf(surfaces: SurfaceStatusView[], id: SurfaceStatusView["surface"]) {
  return surfaces.find((s) => s.surface === id);
}

/** The unlock keys the server sends, in the player's own words. */
function unlockSentence(unlockKey: string): string {
  switch (unlockKey) {
    case "first-container-acquired":
      return "Find your first piece of equipment and this opens up.";
    case "second-container-owned":
      return "Hold two pieces at once and this opens up.";
    case "first-socketed-item":
      return "Find a piece with sockets and this opens up.";
    default:
      return "Keep playing and this opens up.";
  }
}

/**
 * One predicate, not a union of them, so the row order the sort chose is the order that survives.
 * The locked exemption is first: a filter may never take a locked row out of the list.
 */
export function applyArmouryFilter(rows: ArmouryRowView[], filter: ArmouryFilterState): ArmouryRowView[] {
  return rows.filter((row) => {
    if (row.locked) return true;
    if (filter.rarityMin !== null && row.rarity.ordinal < filter.rarityMin) return false;
    if (filter.rarityMax !== null && row.rarity.ordinal > filter.rarityMax) return false;
    if (filter.unseenOnly && !row.unseen) return false;
    if (filter.hideAssigned && row.assigned) return false;
    if (filter.hideStale && row.stale) return false;
    return true;
  });
}

/** Descending on every axis except the acquired tiebreak, matching the server's own sort. */
export function sortArmoury(rows: ArmouryRowView[], sort: ArmouryFilterState["sort"]): ArmouryRowView[] {
  const byAcquired = (a: ArmouryRowView, b: ArmouryRowView) => b.acquiredUtc.localeCompare(a.acquiredUtc);
  const copy = [...rows];
  switch (sort) {
    case "rarity":
      return copy.sort((a, b) => b.rarity.ordinal - a.rarity.ordinal || byAcquired(a, b));
    case "unseen":
      return copy.sort((a, b) => Number(b.unseen) - Number(a.unseen) || byAcquired(a, b));
    case "locked":
      return copy.sort((a, b) => Number(b.locked) - Number(a.locked) || byAcquired(a, b));
    case "assigned":
      return copy.sort((a, b) => Number(b.assigned) - Number(a.assigned) || byAcquired(a, b));
    case "acquired":
    default:
      return copy.sort(byAcquired);
  }
}

function ArmouryRow({
  row,
  name,
  selected,
  onSelect
}: {
  row: ArmouryRowView;
  name: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      data-testid={`armoury-row-${row.instanceId}`}
      data-selected={selected}
      aria-current={selected}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 border-b border-border px-3 py-2 text-left last:border-b-0",
        "focus-visible:bg-panel-raised aria-current:bg-panel-raised"
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-text">{name}</span>
        <span className="block text-xs text-muted">
          <RarityPips rarity={row.rarity} />
          {row.assigned ? " · equipped" : ""}
          {row.locked ? " · locked" : ""}
          {row.stale ? " · out of date" : ""}
          {/* item-content `granted-action-text` (T15), `ssot-presentation.md` §9.14: the tag belongs
              on the compact line too, so a player scanning the armoury learns which items are inert
              on the lawn without opening each card. */}
          {row.battleOnly ? (
            <span data-testid={`armoury-battle-only-${row.instanceId}`}> · battle only</span>
          ) : null}
        </span>
      </span>
      {row.unseen ? (
        <span
          className="inline-block h-2 w-2 shrink-0 rounded-full bg-lawn-hot"
          aria-label="not reviewed yet"
          data-testid={`armoury-unseen-${row.instanceId}`}
        />
      ) : null}
    </button>
  );
}

export function ArmouryList({
  playerId,
  selectedId,
  onSelect,
  nameFor
}: {
  playerId: number;
  selectedId: string | null;
  /** The whole row, so the detail pane never has to re-fetch or re-derive what the list already has. */
  onSelect: (row: ArmouryRowView | null) => void;
  /**
   * A container's real name — the relic catalog's, else the base type's authored one.
   *
   * ⛔ **Never the container id** (item-content `item-naming` T3). The caller's own fallback is a
   * sentence saying this build has no name for it; the row's `data-testid` still carries the
   * instance id, so nothing debuggable moved.
   */
  nameFor: (containerId: string) => string;
}) {
  const [filter, setFilter] = useState<ArmouryFilterState>(EMPTY_ARMOURY_FILTER);
  const [search, setSearch] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const surfacesQuery = useItemSurfaces(playerId);
  const armouryQuery = useArmoury(playerId);

  const surfaces = useMemo(
    () => (surfacesQuery.data ? adaptItemSurfaces(surfacesQuery.data) : []),
    [surfacesQuery.data]
  );
  const page = useMemo(
    () => (armouryQuery.data ? adaptArmouryPage(armouryQuery.data) : null),
    [armouryQuery.data]
  );

  const visible = useMemo(() => {
    if (!page) return [];
    const filtered = applyArmouryFilter(page.rows, filter);
    const needle = search.trim().toLowerCase();
    const searched = needle
      ? filtered.filter((r) => nameFor(r.containerId).toLowerCase().includes(needle))
      : filtered;
    return sortArmoury(searched, filter.sort);
  }, [page, filter, search, nameFor]);

  const searchFirst = page?.strategy === "searchFirst" && search.trim().length === 0;
  const rows = searchFirst ? [] : visible;

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 8
  });

  const surface = surfaceOf(surfaces, "armoury");

  if (surface?.state === "locked") {
    return (
      <EmptyState
        title="Nothing to keep yet"
        hint={unlockSentence(surface.unlockKey)}
        testId="armoury-locked"
      />
    );
  }

  if (surfacesQuery.isLoading || armouryQuery.isLoading) {
    return (
      <p className="text-sm text-muted" data-testid="armoury-loading" aria-busy="true">
        Loading what you're carrying…
      </p>
    );
  }

  if (armouryQuery.isError || surfacesQuery.isError) {
    return (
      <Banner tone="error" data-testid="armoury-error">
        Couldn't read what you're carrying.
        <Button
          size="sm"
          variant="ghost"
          className="ml-2"
          onClick={() => {
            void armouryQuery.refetch();
            void surfacesQuery.refetch();
          }}
        >
          Retry
        </Button>
      </Banner>
    );
  }

  if (!page || page.rows.length === 0) {
    return (
      <EmptyState
        title="You aren't carrying anything yet"
        hint="Equipment you pick up shows here."
        testId="armoury-empty"
      />
    );
  }

  return (
    <div className="flex flex-col gap-3" data-testid="armoury">
      <ArmouryFilter
        value={filter}
        onChange={setFilter}
        inbox={page.inbox}
        strategy={page.strategy}
        shownCount={rows.length}
      />

      {page.strategy === "searchFirst" ? (
        <TextInput
          data-testid="armoury-search"
          placeholder="Search what you're carrying"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      ) : null}

      {searchFirst ? (
        <EmptyState
          title="Search to start"
          hint="You're carrying more than fits on one screen — type a name to narrow it down."
          testId="armoury-search-first"
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title="Nothing matches"
          hint="Loosen the filters above to see more of what you're carrying."
          testId="armoury-filtered-empty"
        />
      ) : page.strategy === "renderAll" ? (
        <div className="rounded-md border border-border" data-testid="armoury-list">
          {rows.map((row) => (
            <ArmouryRow
              key={row.instanceId}
              row={row}
              name={nameFor(row.containerId)}
              selected={row.instanceId === selectedId}
              onSelect={() => onSelect(row.instanceId === selectedId ? null : row)}
            />
          ))}
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="overflow-y-auto rounded-md border border-border"
          style={{ height: LIST_HEIGHT_PX }}
          data-testid="armoury-list"
        >
          <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index]!;
              return (
                <div
                  key={row.instanceId}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualRow.start}px)`
                  }}
                >
                  <ArmouryRow
                    row={row}
                    name={nameFor(row.containerId)}
                    selected={row.instanceId === selectedId}
                    onSelect={() => onSelect(row.instanceId === selectedId ? null : row)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

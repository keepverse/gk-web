import { useMemo, useRef, useState, type ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/cn";
import { TextInput } from "@/ui";
import { ActorCard } from "./ActorCard";
import { ActorRow } from "./ActorRow";
import type { ActorRungState } from "./actorRungState";
import {
  ACTOR_COLLECTION_PAGE_SIZE,
  ACTOR_COLLECTION_RENDER_ALL_MAX,
  ACTOR_COLLECTION_SEARCH_FIRST_ABOVE
} from "@/ui/lawn/lawnPresentationTokens";
import { logLawnInteractive } from "@/ui/lawn/lawnInteractiveObserve";

export type ActorCollectionDensity = "list" | "grid";

export type ActorCollectionItem = {
  key: string;
  /** When set, renders ActorRow/ActorCard from rung state. */
  rungState?: ActorRungState;
  /** Lightweight row when rungState absent (lawn Wave/Fielded). */
  label?: string;
  sideLabel?: string;
  chip?: "Fielded" | "Wave" | "Bound";
  hpFraction?: number;
  lockedReason?: string;
};

export type ActorCollectionQuery = {
  search: string;
  side: "all" | "plant" | "zombie";
  sort: "default" | "name";
};

const ESTIMATED_ROW_HEIGHT = 56;
const LIST_HEIGHT_PX = 320;

function volumeTier(count: number, hasActiveQuery: boolean): "all" | "windowed" | "search-first" {
  if (count > ACTOR_COLLECTION_SEARCH_FIRST_ABOVE && !hasActiveQuery) return "search-first";
  if (count > ACTOR_COLLECTION_RENDER_ALL_MAX) return "windowed";
  return "all";
}

function matchesQuery(item: ActorCollectionItem, q: ActorCollectionQuery): boolean {
  if (q.side !== "all") {
    const side = (item.sideLabel ?? "").toLowerCase();
    if (side && side !== q.side) return false;
  }
  const needle = q.search.trim().toLowerCase();
  if (!needle) return true;
  const hay = `${item.label ?? ""} ${item.sideLabel ?? ""} ${item.chip ?? ""} ${item.key}`.toLowerCase();
  return hay.includes(needle);
}

/**
 * Shared Actor Row/Card list (GG-9 / GG-50 / GG-51). Creatures, dock, spawn tray, scope picker consume this.
 */
export function ActorCollection({
  items,
  density = "list",
  query: queryProp,
  onQueryChange,
  selectionKey,
  onSelect,
  empty,
  lockedReason,
  showHpSliver = false,
  className,
  testId = "actor-collection"
}: {
  items: ActorCollectionItem[];
  density?: ActorCollectionDensity;
  query?: ActorCollectionQuery;
  onQueryChange?: (q: ActorCollectionQuery) => void;
  selectionKey?: string | null;
  onSelect?: (key: string) => void;
  empty?: ReactNode;
  lockedReason?: string;
  showHpSliver?: boolean;
  className?: string;
  testId?: string;
}) {
  const [localQuery, setLocalQuery] = useState<ActorCollectionQuery>({
    search: "",
    side: "all",
    sort: "default"
  });
  const query = queryProp ?? localQuery;
  const setQuery = onQueryChange ?? setLocalQuery;

  const hasActiveQuery = Boolean(query.search.trim()) || query.side !== "all";
  const filtered = useMemo(() => {
    const next = items.filter((i) => matchesQuery(i, query));
    if (query.sort === "name") {
      next.sort((a, b) => (a.label ?? a.key).localeCompare(b.label ?? b.key));
    }
    return next;
  }, [items, query]);

  const tier = volumeTier(items.length, hasActiveQuery);
  const showSearchFirstPrompt = tier === "search-first" && !hasActiveQuery;
  const windowed = tier === "windowed";
  const displayItems = showSearchFirstPrompt
    ? []
    : windowed
      ? filtered.slice(0, ACTOR_COLLECTION_PAGE_SIZE)
      : filtered;

  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: windowed && density === "list" ? displayItems.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 8
  });

  if (lockedReason) {
    return (
      <div
        data-testid={testId}
        data-state="locked"
        className={cn("rounded-md border border-border p-3 text-sm text-muted", className)}
      >
        {lockedReason}
      </div>
    );
  }

  return (
    <div data-testid={testId} data-density={density} data-volume={tier} className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-wrap items-center gap-2" data-testid={`${testId}-query`}>
        <TextInput
          value={query.search}
          onChange={(e) => setQuery({ ...query, search: e.target.value })}
          placeholder="Search…"
          data-testid={`${testId}-search`}
          className="min-w-[8rem] flex-1"
        />
        <select
          value={query.side}
          onChange={(e) => setQuery({ ...query, side: e.target.value as ActorCollectionQuery["side"] })}
          data-testid={`${testId}-side`}
          className="rounded-md border border-border bg-panel px-2 py-1 text-sm"
        >
          <option value="all">All</option>
          <option value="plant">Plant</option>
          <option value="zombie">Zombie</option>
        </select>
      </div>

      {showSearchFirstPrompt ? (
        <p className="text-sm text-muted" data-testid={`${testId}-search-first`}>
          Too many to list — search or filter to narrow the roster.
        </p>
      ) : displayItems.length === 0 ? (
        <div data-testid={`${testId}-empty`}>{empty ?? <p className="text-sm text-muted">None here.</p>}</div>
      ) : density === "grid" ? (
        <div className="flex flex-wrap gap-2" data-testid={`${testId}-grid`}>
          {displayItems.map((item) => (
            <CollectionGridItem
              key={item.key}
              item={item}
              selected={item.key === selectionKey}
              showHpSliver={showHpSliver}
              onSelect={onSelect}
              testId={testId}
            />
          ))}
        </div>
      ) : windowed ? (
        <div
          ref={scrollRef}
          className="overflow-y-auto rounded-md border border-border"
          style={{ height: LIST_HEIGHT_PX }}
          data-testid={`${testId}-list`}
          data-virtualized="true"
        >
          <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>
            {virtualizer.getVirtualItems().map((row) => {
              const item = displayItems[row.index]!;
              return (
                <div
                  key={row.key}
                  data-index={row.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${row.start}px)`
                  }}
                >
                  <CollectionListItem
                    item={item}
                    selected={item.key === selectionKey}
                    showHpSliver={showHpSliver}
                    onSelect={onSelect}
                    testId={testId}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-md border border-border" data-testid={`${testId}-list`} data-virtualized="false">
          {displayItems.map((item) => (
            <CollectionListItem
              key={item.key}
              item={item}
              selected={item.key === selectionKey}
              showHpSliver={showHpSliver}
              onSelect={onSelect}
              testId={testId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CollectionListItem({
  item,
  selected,
  showHpSliver,
  onSelect,
  testId
}: {
  item: ActorCollectionItem;
  selected: boolean;
  showHpSliver: boolean;
  onSelect?: (key: string) => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      data-testid={`${testId}-item-${item.key}`}
      data-selected={selected}
      data-chip={item.chip}
      disabled={Boolean(item.lockedReason)}
      title={item.lockedReason}
      onClick={() => {
        logLawnInteractive("collection.select", { key: item.key, chip: item.chip });
        onSelect?.(item.key);
      }}
      className={cn(
        "block w-full text-left focus-visible:bg-panel-raised",
        selected && "bg-panel-raised",
        item.lockedReason && "cursor-not-allowed opacity-60"
      )}
      aria-current={selected}
    >
      {item.rungState ? (
        <ActorRow state={item.rungState} />
      ) : (
        <div className="flex min-w-0 items-center gap-3 border-b border-border px-3 py-2 last:border-b-0">
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-text">{item.label ?? item.key}</p>
            <p className="flex items-center gap-2 text-xs text-muted">
              {item.sideLabel ? <span>{item.sideLabel}</span> : null}
              {item.chip ? (
                <span
                  data-testid={`${testId}-chip-${item.key}`}
                  className="rounded-pill border border-border px-1.5 py-0.5 text-2xs uppercase"
                >
                  {item.chip}
                </span>
              ) : null}
            </p>
          </div>
          {showHpSliver && item.hpFraction != null ? (
            <div
              className="h-1.5 w-12 overflow-hidden rounded-full bg-panel-inset"
              data-testid={`${testId}-hp-${item.key}`}
            >
              <div className="h-full bg-ok" style={{ width: `${Math.round(item.hpFraction * 100)}%` }} />
            </div>
          ) : null}
        </div>
      )}
    </button>
  );
}

function CollectionGridItem({
  item,
  selected,
  showHpSliver,
  onSelect,
  testId
}: {
  item: ActorCollectionItem;
  selected: boolean;
  showHpSliver: boolean;
  onSelect?: (key: string) => void;
  testId: string;
}) {
  if (item.rungState) {
    return (
      <div
        data-testid={`${testId}-item-${item.key}`}
        data-selected={selected}
        data-chip={item.chip}
        title={item.lockedReason}
        aria-disabled={Boolean(item.lockedReason)}
        className={cn(
          selected && "ring-2 ring-lawn-hot",
          item.lockedReason && "cursor-not-allowed opacity-60"
        )}
        onClick={() => {
          if (item.lockedReason) return;
          logLawnInteractive("collection.select", { key: item.key, chip: item.chip });
          onSelect?.(item.key);
        }}
        onKeyDown={(e) => {
          if (item.lockedReason) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect?.(item.key);
          }
        }}
        role="button"
        tabIndex={item.lockedReason ? -1 : 0}
      >
        <ActorCard state={item.rungState} onInspect={() => {
          if (item.lockedReason) return;
          onSelect?.(item.key);
        }} />
      </div>
    );
  }
  return (
    <CollectionListItem
      item={item}
      selected={selected}
      showHpSliver={showHpSliver}
      onSelect={onSelect}
      testId={testId}
    />
  );
}

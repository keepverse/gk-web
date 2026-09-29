import { useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/cn";
import { Select, TextInput } from "@/ui";
import { EmptyState } from "@/ui/EmptyState";
import {
  filterPathBrowse,
  GATELESS_CONDITION_TEXT,
  gatelessCount,
  gatelessPaths,
  orderPathBrowse,
  PATH_BROWSE_CATEGORIES,
  type PathBrowseQuery,
  type PathCategory
} from "@/contract/passivesBrowse";

// `ui/` never binds to a REST DTO type directly (contractGuard.ts's guard 2) -- same pattern
// `CreaturesLayer.tsx` uses for `UniqueActorDto`: derive the element shape from a `contract/`
// function's own parameter type instead of importing `TreeResolveReport` from `@/lib/bus` here.
type TreeReport = Parameters<typeof orderPathBrowse>[0][number];

// GG-50: below this, render every card directly; above it, window the render. 42 real shared paths
// (roster.aptitudes(12) + roster.elements(6) + roster.statuses(24), spec-tree-surface.md §9.1's own
// table -- D51, 2026-09-06, grew statuses 21 -> 24) sit above this threshold on purpose -- I4's own
// acceptance bullet is "39 cards render windowed" (pre-D51 wording; the real count is now 42), so the
// number must clear the real corpus size by less than CreaturesLayer's list ever needs to. Reusing
// CreaturesLayer's own literal (24) rather than inventing a second one for the same GG-50 shape.
const RENDER_ALL_MAX = 24;
const ESTIMATED_CARD_HEIGHT = 72;
const LIST_HEIGHT_PX = 360;

const CATEGORY_LABEL: Record<PathCategory, string> = {
  primary: "Primary",
  elemental: "Elemental",
  status: "Status",
  family: "Family"
};

/** Exported for reuse by `BloodlineTree.tsx` (I5, §3's read route) -- a species tree's card renders
 * exactly like a shared tree's, just outside this browse, so this stays the single place that
 * decides what a tree card looks like rather than growing a second copy.
 *
 * `onOpen` (I6) is the depth-3-budget push into Level 2 (§2.2: "sheet(1) -> path(2) -> trait(3)") --
 * optional so `BloodlineTree.tsx`'s read-only route (nothing reachable from the Codex is spendable,
 * per that file's own doc comment) keeps rendering a plain, non-interactive card by simply never
 * passing it. */
export function PathCard({ tree, onOpen }: { tree: TreeReport; onOpen?: (treeId: string) => void }) {
  const content = (
    <>
      <div className="min-w-0">
        {/* seedsmith-content-standard, passive-tree-identity-content (2026-09-08): the tree's own
            real generated name, falling back to the raw id for any tree the identity stage has
            not reached yet -- never a blank or fabricated label. */}
        <span className="font-display">{tree.name ?? tree.treeId}</span>
        <span className="ml-2 text-xs text-muted">{tree.category}</span>
        {tree.description ? (
          <p className="truncate text-2xs italic text-muted" data-testid="tree-identity-description">
            {tree.description}
          </p>
        ) : null}
      </div>
      <div className="shrink-0 text-xs text-muted">
        tier {tree.tierReached} of {tree.tiers}
        {tree.lenderTreeId ? <span> · lent by {tree.lenderTreeId}</span> : null}
      </div>
    </>
  );

  if (!onOpen) {
    return (
      <div
        data-testid={`path-card-${tree.treeId}`}
        className="flex items-center justify-between gap-2 border-b border-border px-2 py-2 text-sm text-text last:border-b-0"
      >
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      data-testid={`path-card-${tree.treeId}`}
      onClick={() => onOpen(tree.treeId)}
      className="flex w-full items-center justify-between gap-2 border-b border-border px-2 py-2 text-left text-sm text-text last:border-b-0 hover:bg-panel-inset"
    >
      {content}
    </button>
  );
}

function VirtualPathList({ trees, onOpen }: { trees: TreeReport[]; onOpen?: (treeId: string) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: trees.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ESTIMATED_CARD_HEIGHT,
    overscan: 8
  });

  return (
    <div
      ref={scrollRef}
      className="overflow-y-auto rounded-md border border-border"
      style={{ height: LIST_HEIGHT_PX }}
      data-testid="path-browse-list"
      data-virtualized="true"
    >
      <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>
        {virtualizer.getVirtualItems().map((row) => (
          <div
            key={row.key}
            data-index={row.index}
            ref={virtualizer.measureElement}
            style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${row.start}px)` }}
          >
            <PathCard tree={trees[row.index]!} onOpen={onOpen} />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * §9.1: sorts last, collapsed behind one row, counted in nothing this surface shows elsewhere.
 * `gateState` decides membership -- never a zero-value inference (rule 5) -- and the displayed
 * count is `gatelessCount`'s own read of the report, never a typed-in literal (rule 3).
 */
function GatelessPathsRow({ trees }: { trees: TreeReport[] }) {
  const [expanded, setExpanded] = useState(false);
  const gateless = gatelessPaths(trees);
  if (gateless.length === 0) return null;

  return (
    <div className="mt-2 rounded-md border border-border" data-testid="path-browse-gateless-row">
      <button
        type="button"
        className="w-full px-2 py-2 text-left text-xs text-muted"
        data-testid="path-browse-gateless-toggle"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      >
        <span data-testid="path-browse-gateless-count">{gateless.length}</span>{" "}
        {gateless.length === 1 ? "path isn't" : "paths aren't"} open to anyone yet — {expanded ? "collapse" : "expand"}
      </button>
      {expanded ? (
        <ul className="border-t border-border" data-testid="path-browse-gateless-list">
          {gateless.map((t) => (
            // Rule 1: the condition names the world, not the player -- no requirement number, no
            // have-number, no "locked", no "coming soon" (§9.1 rule 1).
            <li
              key={t.treeId}
              data-testid={`path-browse-gateless-${t.treeId}`}
              className="border-b border-border px-2 py-2 text-xs text-muted last:border-b-0"
            >
              <span className="font-display text-text">{t.treeId}</span> — {GATELESS_CONDITION_TEXT}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * Level 1 -- "All paths" (passive-tree-todo.md I4, spec-tree-surface.md §2.2/§7.3/§9.1). Ordering
 * IS the design here, not a cosmetic pass (§7.3: "at this scale ordering is the mitigation that
 * actually works") -- `orderPathBrowse` puts an actor's own invested paths first, its own stance's
 * other three paths second (D28's cross-unlock, already open and invisible without this), an
 * element match third, everything else fourth, and removes every gate-less path from this list
 * entirely (they collapse into `GatelessPathsRow` instead, never competing for a slot here).
 *
 * `query` is owned by the caller (`PassivesTab`) rather than local `useState` here, so it survives
 * this component being torn down and remounted when the Level 0/Level 1 sub-tab flips (GG-51: "query
 * state belongs to the layer and survives it" -- the same reasoning `CreaturesLayer.tsx` documents
 * for its own search/filter/sort state, just lifted one level further up since, unlike that layer,
 * this component's own parent tab body is what stays mounted).
 */
export function PathBrowse({
  trees,
  elementIds,
  query,
  onQueryChange,
  onOpen
}: {
  trees: TreeReport[];
  elementIds: readonly string[];
  query: PathBrowseQuery;
  onQueryChange: (query: PathBrowseQuery) => void;
  /** I6 -- opens Level 2 (the lattice) for one path. Optional: a caller that hasn't built Level 2 yet
   * (none remain after this task) simply renders a non-interactive browse, same as `PathCard` itself. */
  onOpen?: (treeId: string) => void;
}) {
  const ordered = useMemo(() => orderPathBrowse(trees, elementIds), [trees, elementIds]);
  const visible = useMemo(() => filterPathBrowse(ordered, query), [ordered, query]);
  const totalGateless = gatelessCount(trees);

  return (
    <div className="flex flex-col gap-3" data-testid="passives-path-browse">
      <div className="flex flex-wrap items-center gap-2" data-testid="path-browse-controls">
        <TextInput
          data-testid="path-browse-search"
          placeholder="Search paths…"
          value={query.searchText}
          onChange={(e) => onQueryChange({ ...query, searchText: e.target.value })}
          className="max-w-[220px]"
        />
        <Select
          data-testid="path-browse-category"
          aria-label="Filter by category"
          value={query.category}
          onChange={(e) => onQueryChange({ ...query, category: e.target.value as PathCategory | "all" })}
        >
          <option value="all">All categories</option>
          {PATH_BROWSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </Select>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          testId="path-browse-no-match"
          title={ordered.length === 0 ? "None of your paths are open yet" : "No paths match"}
          hint={
            ordered.length === 0
              ? `${totalGateless} ${totalGateless === 1 ? "path" : "paths"} below ${totalGateless === 1 ? "isn't" : "aren't"} open to anyone yet.`
              : "Try a different search or category."
          }
        />
      ) : visible.length > RENDER_ALL_MAX ? (
        <VirtualPathList trees={visible} onOpen={onOpen} />
      ) : (
        <div className={cn("rounded-md border border-border")} data-testid="path-browse-list-static">
          {visible.map((t) => (
            <PathCard key={t.treeId} tree={t} onOpen={onOpen} />
          ))}
        </div>
      )}

      <GatelessPathsRow trees={trees} />
    </div>
  );
}

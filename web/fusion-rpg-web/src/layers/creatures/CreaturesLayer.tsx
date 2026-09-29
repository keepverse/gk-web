import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUniqueActors } from "@/lib/bus";
import { adaptActor } from "@/contract/adapt";

// Same pattern RelicsLayer.tsx already uses for this exact situation: a layer may never import a
// raw REST DTO type directly (contractGuard.ts, T4's sealed-contract rule) — derive it from the
// adapter function's own parameter instead.
type UniqueActorDto = Parameters<typeof adaptActor>[0];
import { PanelShell } from "@/shell/PanelShell";
import { Banner, Button, Select } from "@/ui";
import {
  ActorCard,
  ActorCollection,
  type ActorCollectionItem,
  type ActorCollectionQuery,
  type ActorRungState
} from "@/ui/actor";
import { EmptyState } from "@/ui/EmptyState";

type SortOrder = "level-desc" | "level-asc";

/**
 * The bound roster (information-architecture.md §3: `C`, replaces
 * `/roster`). Ladder rungs: ActorCollection (GG-50/51) for the list, card for the
 * selected creature's detail — the same `ActorView` contract T8 built, never a
 * second rendering of the same data (GG-9). No `typeId` anywhere: every
 * label here comes from the adapted view, not the raw DTO.
 */
export function CreaturesLayer({
  open,
  onOpenChange,
  playerId,
  selectedId,
  onSelect
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playerId: number;
  selectedId: string | null;
  onSelect: (instanceId: string | null) => void;
}) {
  const navigate = useNavigate();
  const query = useUniqueActors(playerId);
  const actors = query.data?.items ?? [];
  const selected = selectedId ? actors.find((a) => a.instanceId === selectedId) : undefined;
  const selectedState: ActorRungState | null = selected ? { kind: "ready", data: adaptActor(selected) } : null;

  // T27/GG-51: query + sort belong to the layer — plain `useState` already survives close/reopen
  // within the session (`SanctumStage.tsx`'s `mountedLayers` gate keeps the instance mounted).
  // Volume cutoffs (GG-50) live in ActorCollection / lawnPresentationTokens — not restated here.
  const [collectionQuery, setCollectionQuery] = useState<ActorCollectionQuery>({
    search: "",
    side: "all",
    sort: "default"
  });
  const [sortOrder, setSortOrder] = useState<SortOrder>("level-desc");

  const items: ActorCollectionItem[] = useMemo(() => {
    const sorted = [...actors].sort((a, b) =>
      sortOrder === "level-desc" ? b.level - a.level : a.level - b.level
    );
    return sorted.map((a: UniqueActorDto) => ({
      key: a.instanceId,
      // Search haystack — ActorRow still paints from rungState (names unresolved / Pending).
      label: `lvl ${a.level} ${a.phase}`,
      sideLabel: a.side,
      rungState: { kind: "ready" as const, data: adaptActor(a) }
    }));
  }, [actors, sortOrder]);

  return (
    <PanelShell
      open={open}
      onOpenChange={onOpenChange}
      title="Creatures"
      subtitle={`${actors.length} bound`}
      testId="creatures-layer"
    >
      {query.isLoading ? (
        <p className="text-sm text-muted" data-testid="creatures-loading" aria-busy="true">
          Loading creatures…
        </p>
      ) : query.isError ? (
        <Banner tone="error" data-testid="creatures-error">
          Couldn't load your creatures.
          <Button size="sm" variant="ghost" className="ml-2" onClick={() => void query.refetch()}>
            Retry
          </Button>
        </Banner>
      ) : actors.length === 0 ? (
        <EmptyState
          title="No creatures bound yet"
          hint="Bind one to see it here — the roster fills in as you play."
        />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2" data-testid="creatures-controls">
            <Select
              data-testid="creatures-sort"
              aria-label="Sort creatures"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as SortOrder)}
            >
              <option value="level-desc">Level (high to low)</option>
              <option value="level-asc">Level (low to high)</option>
            </Select>
          </div>

          <p className="text-xs text-muted" data-testid="creatures-rung-note">
            Rows, not the plate's card grid — creature names aren't resolved yet (only side, level and
            phase are real), and rows keep the virtualized list's row-height math simple at volume.
          </p>

          <ActorCollection
            testId="creatures"
            items={items}
            density="list"
            query={collectionQuery}
            onQueryChange={setCollectionQuery}
            selectionKey={selectedId}
            onSelect={(key) => onSelect(key === selectedId ? null : key)}
            empty={
              <EmptyState
                testId="creatures-no-match"
                title="No creatures match"
                hint="Try a different search or filter."
              />
            }
          />

          {selectedState ? (
            <div data-testid="creatures-detail">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Selected</p>
              <ActorCard state={selectedState} />
              {selected?.phase === "Roster" ? (
                <Button
                  size="sm"
                  className="mt-2"
                  data-testid="creatures-deploy"
                  onClick={() => navigate(`/lawn?deploy=${encodeURIComponent(selected.instanceId)}`)}
                >
                  Deploy to the lawn
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </PanelShell>
  );
}

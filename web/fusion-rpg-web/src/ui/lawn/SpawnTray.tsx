import { useMemo } from "react";
import { ActorCollection, type ActorCollectionItem } from "@/ui/actor";
import { adaptActor } from "@/contract/adapt";
import { logLawnInteractive } from "@/ui/lawn/lawnInteractiveObserve";
import { cn } from "@/lib/cn";

type UniqueActorDto = Parameters<typeof adaptActor>[0];

export type SpawnTrayEntry = {
  actor: UniqueActorDto;
  /** Per-row lock (e.g. already Bound on the lawn). Global phase lock still applies via canSpawn. */
  lockedReason?: string;
};

export function SpawnTray({
  open,
  entries,
  canSpawn,
  lockedReason,
  selectionKey,
  onPick,
  onClose,
  className
}: {
  open: boolean;
  entries: SpawnTrayEntry[];
  canSpawn: boolean;
  lockedReason?: string;
  selectionKey?: string | null;
  onPick: (instanceId: string) => void;
  onClose?: () => void;
  className?: string;
}) {
  const items: ActorCollectionItem[] = useMemo(
    () =>
      entries.map(({ actor: a, lockedReason: rowLock }) => {
        const phaseLock = canSpawn ? undefined : lockedReason ?? "Cannot field right now";
        const lock = rowLock ?? phaseLock;
        return {
          key: a.instanceId,
          label:
            typeof a === "object" && a && "displayName" in a
              ? String((a as { displayName?: string }).displayName ?? a.instanceId)
              : a.instanceId,
          sideLabel: a.side,
          chip: rowLock ? ("Bound" as const) : ("Fielded" as const),
          rungState: { kind: "ready" as const, data: adaptActor(a) },
          lockedReason: lock
        };
      }),
    [entries, canSpawn, lockedReason]
  );

  if (!open) return null;

  return (
    <aside
      data-testid="spawn-tray"
      className={cn(
        "band-panel flex shrink-0 flex-col gap-2 border-r border-border bg-soil-raised p-3",
        className
      )}
      style={{ width: 320 }}
    >
      <div className="flex items-center gap-2">
        <h2 className="min-w-0 flex-1 font-display text-lg text-text">Field a creature</h2>
        {onClose ? (
          <button
            type="button"
            data-testid="spawn-tray-close"
            className="rounded-sm border border-border px-2 py-0.5 text-xs text-muted"
            onClick={onClose}
          >
            Esc
          </button>
        ) : null}
      </div>
      <p className="text-xs text-muted" data-testid="spawn-tray-hint">
        Pick a specimen — no type id typing.
      </p>
      <ActorCollection
        testId="spawn-tray-collection"
        items={items}
        density="grid"
        selectionKey={selectionKey}
        lockedReason={!canSpawn ? lockedReason ?? "Cannot field in this phase" : undefined}
        onSelect={(key) => {
          const entry = entries.find((e) => e.actor.instanceId === key);
          if (!canSpawn || entry?.lockedReason) return;
          logLawnInteractive("spawn.enter", { instanceId: key });
          onPick(key);
        }}
        empty={<p className="text-sm text-muted">No deployable uniques.</p>}
      />
    </aside>
  );
}

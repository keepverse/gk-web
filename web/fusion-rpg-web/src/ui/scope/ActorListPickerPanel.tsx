import { ActorCollection, type ActorCollectionItem, type ActorRungState } from "@/ui/actor";
import type { ScopePickerValue, ScopeTargetCandidate } from "./ActorMenuScopePicker";

type ListKind = "target" | "uniqueCreature";

function idOf(value: ScopePickerValue | null, kind: ListKind): string | null {
  if (!value || value.kind !== kind) return null;
  return value.kind === "target" ? value.targetPtr : value.instanceId;
}

function uniqueItems(candidates: ActorRungState[]): ActorCollectionItem[] {
  return candidates.map((state, index) => {
    if (state.kind === "ready") {
      return {
        key: state.data.instanceId,
        rungState: state,
        label:
          state.data.displayName.state === "known"
            ? state.data.displayName.value
            : state.data.instanceId,
        sideLabel: state.data.side
      };
    }
    return {
      key: `pending-uniqueCreature-${index}`,
      rungState: state,
      lockedReason: "Not ready"
    };
  });
}

function targetItems(candidates: ScopeTargetCandidate[]): ActorCollectionItem[] {
  const items: ActorCollectionItem[] = [];
  candidates.forEach((state, index) => {
    if (state.kind === "ready") {
      const ptr = state.targetPtr?.trim();
      if (!ptr) return;
      items.push({
        key: ptr,
        rungState: state.rungState,
        label:
          state.rungState.data.displayName.state === "known"
            ? state.rungState.data.displayName.value
            : ptr,
        sideLabel: state.rungState.data.side
      });
      return;
    }
    items.push({
      key: `pending-target-${index}`,
      rungState: state,
      lockedReason: "Not ready"
    });
  });
  return items;
}

/**
 * Target / UniqueCreature list body for ActorMenuScopePicker.
 * Uses shared ActorCollection (lawn-interactive T11) — never a private ActorRow fork.
 *
 * WhoSelector shapes stay distinct: target → targetPtr, uniqueCreature → instanceId.
 * Never pass instanceId as targetPtr.
 */
export function ActorListPickerPanel({
  kind,
  candidates,
  targetCandidates,
  value,
  onChange
}: {
  kind: ListKind;
  /** UniqueCreature candidates (instanceId identity). */
  candidates?: ActorRungState[];
  /** Target candidates — each ready row must carry an explicit targetPtr. */
  targetCandidates?: ScopeTargetCandidate[];
  value: ScopePickerValue | null;
  onChange: (value: ScopePickerValue) => void;
}) {
  const selectedId = idOf(value, kind);
  const items =
    kind === "target" ? targetItems(targetCandidates ?? []) : uniqueItems(candidates ?? []);

  return (
    <div data-testid={`scope-${kind}-list`}>
      <ActorCollection
        testId={`scope-${kind}-collection`}
        items={items}
        density="list"
        selectionKey={selectedId}
        onSelect={(key) => {
          if (kind === "target") {
            const ready = (targetCandidates ?? []).find(
              (c) => c.kind === "ready" && c.targetPtr.trim() === key
            );
            if (!ready || ready.kind !== "ready") return;
            onChange({ kind: "target", targetPtr: ready.targetPtr.trim() });
            return;
          }
          const ready = (candidates ?? []).find((c) => c.kind === "ready" && c.data.instanceId === key);
          if (!ready || ready.kind !== "ready") return;
          onChange({ kind: "uniqueCreature", instanceId: ready.data.instanceId });
        }}
        empty={
          <p className="text-sm italic text-muted" data-testid={`scope-${kind}-empty`}>
            No candidates available.
          </p>
        }
      />
    </div>
  );
}

import { useMemo, useState } from "react";
import {
  foldWonderComposerVm,
  toggleWonderRelic,
  wonderComposerToOrder,
  wonderRefusalVm,
  type WonderComposerVm
} from "@/features/gui-lego/foldWonderComposerVm";
import { createWonderComposerBus } from "@/features/gui-lego/wonderComposerBus";
import {
  useLegionCargo,
  useReachableRelics,
  useSectorStorage,
  useSubmitWorldCommands,
  useWorldCatalog
} from "@/lib/bus/world";
import type { SectorView, SlotView } from "@/contract/types";
import { orderId } from "../worldSelection";
import { wonderComposerCopy, wonderCapLine, wonderCountLine, wonderFoundationLine, wonderNightsLine } from "./copyCatalog";

/**
 * empire-wonder-surfaces `wonder-composer` (plan Task 4D.3,
 * spec-wonder-composer.md §§Design 1–5) — band-2 panel over the world stage.
 *
 * Recipe: tool-search + split-inspect(catalog / relic-shelf-link) +
 * slot-pick + wonder-cost-plate + confirm(band-3) + lifecycle overlays.
 * The fold (`foldWonderComposerVm`, pure) joins 4A.4's catalog/slot/sector
 * wire + reachability read against 4D.1's shelf rows (cargo tab + vault,
 * consumed by name — where-it-sits truth stays the sibling overlay's);
 * the closed `wonder-composer.*` bus carries the six events. Filing goes
 * through `wonder-rest`'s locked shape (`PendingOrder.relicInstanceIds` →
 * `useSubmitWorldCommands`); filing ≠ resolving (GG-15). Buttons never
 * disable silently (GG-55): the confirm names its blocker and answers
 * visibly when pressed while blocked.
 */

// ---------------------------------------------------------------------------
// Pure view (landmark-tested without react-query).
// ---------------------------------------------------------------------------

export type WonderComposerCallbacks = {
  onQueryChange: (q: string) => void;
  onSelectWonder: (structureId: string) => void;
  onToggleRelic: (instanceId: string) => void;
  onSelectSlot: (slotIndex: number) => void;
  onConfirmOpen: () => void;
  onConfirmAccept: () => void;
  onConfirmCancel: () => void;
  onRetry: () => void;
};

export function WonderComposerContent(props: {
  vm: WonderComposerVm;
  query: string;
  confirmOpen: boolean;
  fileNote: string | null;
  lastRefusalKey: string | null;
  cb: WonderComposerCallbacks;
}) {
  const { vm, query, confirmOpen, fileNote, lastRefusalKey, cb } = props;

  if (vm.phase === "error") {
    return (
      <div data-testid="wonder-composer" data-band="2">
        <div data-testid="wonder-phase-error" data-phase="error" role="status">
          <strong>phase-error</strong>
          <span>{wonderComposerCopy("wonder.error.read")}</span>
          <button type="button" data-testid="wonder-retry" onClick={cb.onRetry}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const selected = vm.catalogRows.find((r) => vm.costPlate.structureId === r.structureId) ?? null;

  return (
    <div data-testid="wonder-composer" data-band="2">
      <input
        data-testid="wonder-search"
        type="search"
        aria-label="Search works and treasure"
        placeholder="Search works and treasure"
        value={query}
        onChange={(e) => cb.onQueryChange(e.target.value)}
      />

      <div data-testid="wonder-split">
        <div data-testid="wonder-catalog-scroll" data-testid-scroll="scroll-region">
          <div data-testid="wonder-catalog" role="list" aria-label="Buildable wonders">
            {vm.catalogRows.map((row) => (
              <button
                key={row.structureId}
                type="button"
                role="listitem"
                data-testid="wonder-row"
                data-structure-id={row.structureId}
                data-selected={vm.costPlate.structureId === row.structureId ? "true" : "false"}
                data-buildable={row.buildable ? "true" : "false"}
                aria-selected={vm.costPlate.structureId === row.structureId}
                onClick={() => cb.onSelectWonder(row.structureId)}
              >
                <span data-testid="wonder-row-name">{row.name}</span>{" "}
                <span data-testid="wonder-row-price">
                  asks for {row.relicCost} · {row.buildTurns} nights
                </span>{" "}
                <span data-testid="wonder-row-effect">{wonderComposerCopy(row.blessingCopyKey)}</span>{" "}
                <span data-testid="wonder-row-scope-badge" data-theme-ref={row.themeRefs.scope}>
                  {row.scope}
                </span>{" "}
                <span data-testid="wonder-row-rarity-badge" data-theme-ref={row.themeRefs.rarity}>
                  {row.rarity}
                </span>{" "}
                {row.capped ? (
                  <span data-testid="wonder-row-cap-line" data-cap-state="live">
                    {wonderCapLine(row.liveCount, row.existenceCap)}
                  </span>
                ) : (
                  <span data-testid="wonder-row-cap-line" data-cap-state="uncapped">
                    {wonderComposerCopy("wonder.uncapped")}
                  </span>
                )}
                {row.blockerCopyKey ? (
                  <span data-testid="wonder-row-blocker">{wonderComposerCopy(row.blockerCopyKey)}</span>
                ) : null}
              </button>
            ))}
            {vm.lockedTeasers.map((teaser) => (
              <div
                key={teaser.id}
                role="listitem"
                data-testid="wonder-row"
                data-structure-id={teaser.id}
                data-selected="false"
                data-buildable="false"
              >
                <span data-testid="wonder-row-name">{wonderComposerCopy("wonder.placeholder.unknown")}</span>{" "}
                <span data-testid="wonder-row-locked-reason">{wonderComposerCopy(teaser.copyKey)}</span>{" "}
                <span data-testid="wonder-row-scope-badge" data-theme-ref={teaser.themeRef} data-not-yet="true">
                  not yet
                </span>
              </div>
            ))}
            {vm.unknownIds.map((id) => (
              <div key={id} role="listitem" data-testid="wonder-row" data-structure-id={id} data-selected="false" data-buildable="false">
                <span data-testid="wonder-row-name">{wonderComposerCopy("wonder.placeholder.unknown")}</span>
              </div>
            ))}
          </div>
        </div>

        <div data-testid="wonder-shelf-scroll" data-testid-scroll="scroll-region">
          <div data-testid="wonder-relic-shelf">
            <p data-testid="wonder-shelf-count-line">
              {wonderFoundationLine(vm.costPlate.picked, vm.costPlate.needed)}
            </p>
            {vm.phase === "empty" ? (
              <div data-testid="wonder-shelf-empty">{wonderComposerCopy("wonder.empty.shelf")}</div>
            ) : (
              <>
                <div data-testid="wonder-shelf-reachable" role="list" aria-label="Treasure within reach">
                  {vm.candidates
                    .filter((c) => c.reachable)
                    .map((c) => (
                      <button
                        key={c.instanceId}
                        type="button"
                        role="listitem"
                        data-testid="wonder-shelf-row"
                        data-instance-id={c.instanceId}
                        data-where={c.where}
                        data-picked={c.picked ? "true" : "false"}
                        aria-selected={c.picked}
                        onClick={() => cb.onToggleRelic(c.instanceId)}
                      >
                        {c.instanceId} · {c.where} · {c.picked ? "picked" : "lay it"}
                      </button>
                    ))}
                </div>
                {vm.remoteCount > 0 ? (
                  <details data-testid="wonder-shelf-disclosure">
                    <summary>Full shelf ({vm.remoteCount} more, out of reach)</summary>
                    <div data-testid="wonder-shelf-remote" role="list" aria-label="Treasure elsewhere">
                      {vm.candidates
                        .filter((c) => !c.reachable)
                        .map((c) => (
                          <button
                            key={c.instanceId}
                            type="button"
                            role="listitem"
                            data-testid="wonder-shelf-row"
                            data-instance-id={c.instanceId}
                            data-where={c.where}
                            data-picked="false"
                            onClick={() => cb.onToggleRelic(c.instanceId)}
                          >
                            {c.instanceId} · {wonderComposerCopy("wonder.refused.not-reachable")}
                          </button>
                        ))}
                    </div>
                  </details>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>

      <div data-testid="wonder-slot-pick">
        {vm.slots.map((slot) => (
          <button
            key={slot.slotIndex}
            type="button"
            data-testid="wonder-slot-option"
            data-slot-index={slot.slotIndex}
            data-compatible={slot.compatible ? "true" : "false"}
            data-selected={slot.selected ? "true" : "false"}
            aria-selected={slot.selected}
            onClick={() => cb.onSelectSlot(slot.slotIndex)}
          >
            Plot {slot.slotIndex} ({slot.slotTypeId})
            {slot.compatible ? "" : slot.reason === "wrong-kind" ? " — needs a different ground" : slot.reason === "occupied" ? " — already built" : slot.reason === "guarded" ? " — guarded" : " — cannot be built on"}
          </button>
        ))}
      </div>

      <div data-testid="wonder-cost-plate" data-affordable={vm.costPlate.affordable ? "true" : "false"}>
        <div data-testid="wonder-cost-relic-line" data-picked={vm.costPlate.picked} data-needed={vm.costPlate.needed}>
          {wonderCountLine(vm.costPlate.needed, vm.costPlate.picked)}
        </div>
        <div data-testid="wonder-cost-materials-line" data-state={vm.costPlate.materialsState}>
          {vm.costPlate.materialsState === "pending"
            ? "From this ground's own stores: reading the stores…"
            : vm.costPlate.materialsState === "short"
              ? "From this ground's own stores: short — gather stores, or choose a lesser work."
              : "From this ground's own stores: covered."}
        </div>
        {vm.costPlate.nights != null ? (
          <div data-testid="wonder-cost-nights-line" data-nights={vm.costPlate.nights}>
            {wonderNightsLine(vm.costPlate.nights)}
          </div>
        ) : null}
        {vm.costPlate.blessingCopyKey ? (
          <div data-testid="wonder-cost-blessing-line">{wonderComposerCopy(vm.costPlate.blessingCopyKey)}</div>
        ) : null}
        <div data-testid="wonder-cost-upkeep-line" data-state={vm.costPlate.upkeepState}>
          {vm.costPlate.upkeepState === "pending"
            ? "Upkeep note joins when the ledger wire lands."
            : "Upkeep joins the ground's own ledger."}
        </div>
        {vm.costPlate.confirmBlockedReason ? (
          <p data-testid="wonder-cost-blocker">{vm.costPlate.confirmBlockedReason}</p>
        ) : null}
      </div>

      <button
        type="button"
        data-testid="wonder-confirm-open"
        data-enabled={vm.costPlate.affordable ? "true" : "false"}
        aria-disabled={!vm.costPlate.affordable}
        title={vm.costPlate.confirmBlockedReason ?? "Lay the foundation"}
        onClick={cb.onConfirmOpen}
      >
        Confirm — names what leaves
      </button>

      {confirmOpen && selected ? (
        <div data-testid="wonder-confirm-dialog" data-band="3" role="dialog" aria-label="Confirm the laying">
          <p data-testid="wonder-confirm-copy">{wonderComposerCopy("wonder.confirm.spend")}</p>
          <button type="button" data-testid="wonder-confirm-accept" onClick={cb.onConfirmAccept}>
            Lay the foundation
          </button>
          <button type="button" data-testid="wonder-confirm-cancel" onClick={cb.onConfirmCancel}>
            Keep planning
          </button>
        </div>
      ) : null}

      <div data-testid="wonder-refusal-toasts" role="status" aria-live="polite">
        {lastRefusalKey
          ? (() => {
              const refusal = wonderRefusalVm(lastRefusalKey, { needed: vm.costPlate.needed, picked: vm.costPlate.picked });
              return refusal ? (
                <div data-testid="wonder-refusal-toast" data-reason={refusal.reason}>
                  <strong>{wonderComposerCopy(refusal.copyKey)}</strong>{" "}
                  <span data-testid="wonder-refusal-next">{wonderComposerCopy(refusal.nextAction)}</span>
                </div>
              ) : null;
            })()
          : null}
      </div>

      {vm.filedPending ? (
        <div data-testid="wonder-phase-pending" data-phase="pending" role="status">
          <strong>phase-pending</strong>
          <span>{wonderComposerCopy("wonder.filed.pending")}</span>
        </div>
      ) : null}
      {vm.phase === "empty" ? (
        <div data-testid="wonder-phase-empty" data-phase="empty" role="status">
          <span>{wonderComposerCopy("wonder.empty.shelf")}</span>
        </div>
      ) : null}

      {fileNote ? <p data-testid="wonder-file-note">{fileNote}</p> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Container (the reads + the filing wire).
// ---------------------------------------------------------------------------

export function WonderComposer(props: {
  worldId: string;
  entityId: string;
  sectorId: string;
  turn: number;
  commanderId?: string;
  sector: SectorView | null;
  slots: SlotView[];
}) {
  const { worldId, entityId, sectorId, turn } = props;
  const catalogQuery = useWorldCatalog();
  const reachQuery = useReachableRelics(worldId, entityId, sectorId);
  const cargoQuery = useLegionCargo(worldId, entityId);
  const storageQuery = useSectorStorage(worldId, sectorId);
  const submit = useSubmitWorldCommands(worldId);

  const [query, setQuery] = useState("");
  const [selectedStructureId, setSelectedStructureId] = useState<string | null>(null);
  const [pickedInstanceIds, setPickedInstanceIds] = useState<string[]>([]);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [fileNote, setFileNote] = useState<string | null>(null);
  const [lastRefusalKey, setLastRefusalKey] = useState<string | null>(null);
  const [filedPending, setFiledPending] = useState(false);

  // The closed `wonder-composer.*` bus — every interaction emits its event;
  // local state renders it. No handler outside this recipe consumes them.
  const bus = useMemo(createWonderComposerBus, []);

  const loading =
    catalogQuery.isLoading || reachQuery.isLoading || cargoQuery.isLoading || storageQuery.isLoading;
  if (loading) {
    return (
      <div data-testid="wonder-composer" data-band="2">
        <div data-testid="wonder-phase-loading" data-phase="loading" role="status">
          <strong>phase-loading</strong>
        </div>
      </div>
    );
  }
  if (
    catalogQuery.isError ||
    reachQuery.isError ||
    cargoQuery.isError ||
    storageQuery.isError ||
    !catalogQuery.data ||
    !cargoQuery.data ||
    !storageQuery.data ||
    !props.sector
  ) {
    const retry = () => {
      bus.emit("wonder-composer.retry", {});
      void catalogQuery.refetch();
      void reachQuery.refetch();
      void cargoQuery.refetch();
      void storageQuery.refetch();
    };
    return (
      <div data-testid="wonder-composer" data-band="2">
        <div data-testid="wonder-phase-error" data-phase="error" role="status">
          <strong>phase-error</strong>
          <button type="button" data-testid="wonder-retry" onClick={retry}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const vm = foldWonderComposerVm({
    structures: catalogQuery.data.structures,
    slots: props.slots,
    sector: {
      sectorId: props.sector.sectorId,
      wonderLiveCountSector: props.sector.wonderLiveCountSector,
      wonderLiveCountEmpire: props.sector.wonderLiveCountEmpire,
      wonderUpkeep: props.sector.loam.upkeepBreakdown.wonderUpkeep
    },
    reachability: reachQuery.data ?? null,
    cargoRows: cargoQuery.data.rows,
    storageRows: storageQuery.data.rows,
    // No catalog/sector wire projects stone-and-ironwork today — the
    // materials line renders the designed pending state, never a guess.
    materials: null,
    ui: { searchText: query, selectedStructureId, pickedInstanceIds, selectedSlotIndex, filedPending }
  });

  const needed = vm.costPlate.needed;
  const reachableSet = new Set(reachQuery.data?.reachableInstanceIds ?? []);

  const cb: WonderComposerCallbacks = {
    onQueryChange: (text) => {
      bus.emit("wonder-composer.search.set", { text });
      setQuery(text);
    },
    onSelectWonder: (structureId) => {
      bus.emit("wonder-composer.wonder.select", { structureId });
      const row = vm.catalogRows.find((r) => r.structureId === structureId);
      if (!row || !row.buildable) {
        setLastRefusalKey("wonder.cap-reached");
        setFileNote("That work cannot rise here — nothing was filed.");
        return;
      }
      setSelectedStructureId(structureId);
      setPickedInstanceIds([]);
      setSelectedSlotIndex(null);
      setLastRefusalKey(null);
    },
    onToggleRelic: (instanceId) => {
      bus.emit("wonder-composer.relic.toggle", { instanceId });
      const step = toggleWonderRelic(pickedInstanceIds, instanceId, needed, reachableSet);
      setPickedInstanceIds(step.picked);
      if (step.refusal) {
        setLastRefusalKey(step.refusal.reason);
        setFileNote(`${wonderComposerCopy(step.refusal.copyKey)} ${wonderComposerCopy(step.refusal.nextAction)}`);
      } else {
        setLastRefusalKey(null);
      }
    },
    onSelectSlot: (slotIndex) => {
      bus.emit("wonder-composer.slot.select", { slotIndex });
      setSelectedSlotIndex(slotIndex);
    },
    onConfirmOpen: () => {
      bus.emit("wonder-composer.confirm", {});
      if (!vm.costPlate.affordable) {
        setFileNote(`Not yet — ${vm.costPlate.confirmBlockedReason ?? "blocked"}. Nothing was filed.`);
        return;
      }
      setConfirmOpen(true);
    },
    onConfirmAccept: () => {
      const slot = vm.slots.find((o) => o.selected);
      if (!vm.costPlate.affordable || !vm.costPlate.structureId || !slot) {
        setFileNote("Not yet — nothing was filed.");
        setConfirmOpen(false);
        return;
      }
      const order = wonderComposerToOrder({
        commandId: orderId(turn, "build", entityId),
        entityId,
        sectorId,
        structureId: vm.costPlate.structureId,
        slotIndex: slot.slotIndex,
        relicInstanceIds: pickedInstanceIds,
        label: `raise ${vm.costPlate.structureId}`
      });
      setFileNote("Filing…");
      void submit
        .mutateAsync({
          commanderId: props.commanderId,
          commands: [
            {
              commandId: order.commandId,
              kind: order.kind,
              entityId: order.entityId,
              sectorId: order.sectorId,
              slotIndex: order.slotIndex,
              structureId: order.structureId,
              relicInstanceIds: order.relicInstanceIds
            }
          ]
        })
        .then(
          (result) => {
            const first = result.results[0];
            if (!first || !first.ok) {
              const reason = first?.reason ?? "";
              const refusal = wonderRefusalVm(reason, { needed, picked: pickedInstanceIds.length });
              setLastRefusalKey(reason || null);
              setFileNote(
                refusal
                  ? `${wonderComposerCopy(refusal.copyKey)} ${wonderComposerCopy(refusal.nextAction)}`
                  : "Couldn't file that order — nothing was moved."
              );
              setConfirmOpen(false);
              return;
            }
            setFiledPending(true);
            setFileNote(
              first.replayed
                ? "Already filed — showing the recorded answer."
                : "Filed — resolution arrives with the turn report, not this button."
            );
            setConfirmOpen(false);
          },
          () => setFileNote("Couldn't file that order — nothing was moved.")
        );
    },
    onConfirmCancel: () => setConfirmOpen(false),
    onRetry: () => {
      bus.emit("wonder-composer.retry", {});
      void catalogQuery.refetch();
      void reachQuery.refetch();
      void cargoQuery.refetch();
      void storageQuery.refetch();
    }
  };

  return <WonderComposerContent vm={vm} query={query} confirmOpen={confirmOpen} fileNote={fileNote} lastRefusalKey={lastRefusalKey} cb={cb} />;
}

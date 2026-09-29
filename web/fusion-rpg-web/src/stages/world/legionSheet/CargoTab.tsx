import { useEffect, useMemo, useState } from "react";
import { foldLegionCargoSheet, legionSheetGateCopyKey, legionSheetReasonKey } from "@/contract/adapt";
import { useLegionCargo } from "@/lib/bus/world";
import type {
  FoldedStockRow,
  LegionCargoFold,
  LegionCargoBusAction,
  LegionView
} from "@/contract/types";
import { legionSheetCopy } from "./copyCatalog";
import { useFileCargoAction } from "./cargoActions";

/**
 * empire-inventory-surfaces `legion-sheet` cargo sub-tab (plan Task 4D.1,
 * spec §§Design 2, 5–8). Recipe:
 *
 *   identity-strip + capacity-meter[slots+weight] + tool-search +
 *   scroll-region > stock-row* + action-row (load / unload / hand-to-band)
 *   → cargo-fold (pure) → events → cargo-actions bus (closed).
 *
 * Contract-guard note: no `import type ... from "@/lib/bus/..."` here —
 * the DTO arrives inferred from the hook, the fold adapts it in
 * `@/contract/adapt`, and this file binds only views. One legion per open
 * (never the empire inventory): the only read is `useLegionCargo`
 * (one-scope). Filing ≠ resolving (GG-15): the filer answers
 * filed/replayed/refused-at-submit in `cargo-file-note`; the turn report +
 * read-backs answer resolution in `cargo-report-note`. Buttons never
 * disable silently (GG-55).
 */

// ---------------------------------------------------------------------------
// Pure view (landmark-tested without react-query).
// ---------------------------------------------------------------------------

export function filterStockRows(rows: FoldedStockRow[], query: string): FoldedStockRow[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return rows;
  return rows.filter((r) => {
    // A refused / left-behind row stays visible with its reason (XCOM
    // lesson, ideal §6) — the filter never hides one.
    if (r.state === "refused" || r.state.startsWith("left-behind")) return true;
    const hay = `${r.nameFallback} ${r.kind} ${r.instanceId ?? ""} ${r.containerId ?? ""}`.toLowerCase();
    return hay.includes(q);
  });
}

export function rowDisplayName(row: FoldedStockRow): string {
  if (row.instanceId && row.instanceId.length > 0) return row.instanceId;
  if (row.containerId && row.containerId.length > 0) return row.containerId;
  return row.nameFallback;
}

export function CargoTabContent(props: {
  fold: LegionCargoFold;
  displayName: string | null;
  query: string;
  onQueryChange: (q: string) => void;
  selectedSeq: number | null;
  onSelectSeq: (seq: number | null) => void;
  fileNote: string | null;
  onAction: (action: LegionCargoBusAction) => void;
  // GG-55: actions never disable — not even while a filing is in flight.
  // Re-filing reuses the same `orderId(turn, kind, entityId)` commandId, so
  // a double-click replays instead of double-spending.
}) {
  const { fold } = props;
  const visible = useMemo(() => filterStockRows(fold.rows, props.query), [fold.rows, props.query]);
  const gateCopyKey = legionSheetGateCopyKey(fold.gateFlag);
  const gateCopy = gateCopyKey ? legionSheetCopy(gateCopyKey) : null;
  const [loadKind, setLoadKind] = useState<"instance" | "stack">("instance");
  const [loadRef, setLoadRef] = useState("");
  const [loadQty, setLoadQty] = useState("1");
  const [handTarget, setHandTarget] = useState("");

  return (
    <div data-testid="legion-cargo-tab">
      <div data-testid="legion-overview" data-role="identity-strip">
        {props.displayName && props.displayName.length > 0 ? props.displayName : fold.entityId} ·{" "}
        {fold.entityId} · as of turn {fold.asOfTurn}
      </div>

      <div data-testid="cargo-capacity-meter" data-density="slots+weight" data-gate-flag={fold.gateFlag}>
        <div data-testid="cargo-capacity-slots-track" data-gate="slots" data-fraction={fold.slots.fraction ?? "null"}>
          {fold.slots.used.value}/{fold.slots.capacity.value} slots
        </div>
        <div
          data-testid="cargo-capacity-weight-track"
          data-gate="weight"
          data-tight={fold.gateFlag === "weight" ? "true" : "false"}
          data-fraction={fold.weight.fraction ?? "null"}
        >
          {fold.weight.used.value}/{fold.weight.capacity.value} wt
        </div>
        {gateCopy ? <p data-testid="cargo-capacity-gate-copy">{gateCopy}</p> : null}
      </div>

      <input
        data-testid="cargo-search"
        type="search"
        aria-label="Search packs"
        placeholder="Search packs"
        value={props.query}
        onChange={(e) => props.onQueryChange(e.target.value)}
      />

      {visible.length === 0 && fold.rows.length === 0 ? (
        <div data-testid="cargo-empty">Nothing aboard — load from the stash or march to a cache.</div>
      ) : (
        <div data-testid="cargo-rows" role="list" aria-label="Packs aboard">
          {visible.map((row) => {
            const selected = props.selectedSeq === row.seq;
            const copy = row.copyKey ? legionSheetCopy(row.copyKey) : null;
            return (
              <button
                key={row.seq}
                type="button"
                role="listitem"
                data-testid="cargo-stock-row"
                data-seq={row.seq}
                data-state={row.state}
                data-selected={selected ? "true" : "false"}
                aria-selected={selected}
                onClick={() => props.onSelectSeq(selected ? null : row.seq)}
              >
                <span data-testid="stock-row-name">{rowDisplayName(row)}</span>{" "}
                <span data-testid="stock-row-meta">
                  {row.kind} · {row.qty ?? 1}
                </span>{" "}
                <span data-testid="stock-row-weight">{row.weight.value} wt</span>{" "}
                <span data-testid="stock-row-state" data-state={row.state}>
                  {row.state}
                  {copy ? ` — ${copy}` : ""}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div data-testid="cargo-action-row">
        <div>
          <label>
            Kind{" "}
            <select
              aria-label="Load kind"
              value={loadKind}
              onChange={(e) => setLoadKind(e.target.value === "stack" ? "stack" : "instance")}
            >
              <option value="instance">instance</option>
              <option value="stack">stack</option>
            </select>
          </label>{" "}
          <label>
            Ref{" "}
            <input
              aria-label="Load reference"
              value={loadRef}
              onChange={(e) => setLoadRef(e.target.value)}
              placeholder={loadKind === "instance" ? "instance id" : "container id"}
            />
          </label>{" "}
          {loadKind === "stack" ? (
            <label>
              Qty{" "}
              <input
                aria-label="Load quantity"
                value={loadQty}
                inputMode="numeric"
                onChange={(e) => setLoadQty(e.target.value)}
              />
            </label>
          ) : null}{" "}
          <button
            type="button"
            data-testid="cargo-action-load"
            onClick={() =>
              props.onAction(
                loadKind === "instance"
                  ? { type: "cargo.load", entityId: fold.entityId, cargoKind: "instance", instanceId: loadRef }
                  : {
                      type: "cargo.load",
                      entityId: fold.entityId,
                      cargoKind: "stack",
                      containerId: loadRef,
                      qty: Number(loadQty) || 0
                    }
              )
            }
          >
            Load
          </button>
        </div>
        <div>
          <button
            type="button"
            data-testid="cargo-action-unload"
            onClick={() =>
              props.selectedSeq == null
                ? props.onAction({ type: "cargo.unload", entityId: fold.entityId, seq: -1 })
                : props.onAction({ type: "cargo.unload", entityId: fold.entityId, seq: props.selectedSeq })
            }
          >
            Unload
          </button>{" "}
          <label>
            To band{" "}
            <input
              aria-label="Hand target band"
              value={handTarget}
              onChange={(e) => setHandTarget(e.target.value)}
              placeholder="target band id"
            />
          </label>{" "}
          <button
            type="button"
            data-testid="cargo-action-hand-to-band"
            onClick={() =>
              props.selectedSeq == null
                ? props.onAction({
                    type: "cargo.hand-to-band",
                    entityId: fold.entityId,
                    targetEntityId: handTarget,
                    seq: -1
                  })
                : props.onAction({
                    type: "cargo.hand-to-band",
                    entityId: fold.entityId,
                    targetEntityId: handTarget,
                    seq: props.selectedSeq
                  })
            }
          >
            Hand to band
          </button>
        </div>
      </div>

      {props.fileNote ? <p data-testid="cargo-file-note">{props.fileNote}</p> : null}
      <p data-testid="cargo-report-note">
        As of turn {fold.asOfTurn} — re-read after every commit before acting.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Container (the one-scope read + the filing wire).
// ---------------------------------------------------------------------------

export function CargoTab(props: {
  worldId: string | null;
  entityId: string | null;
  turn: number;
  commanderId?: string;
  displayName: string | null;
  ownerFactionId: string | null;
  legion: LegionView | null;
}) {
  const { worldId, entityId, turn } = props;
  const cargoQuery = useLegionCargo(worldId, entityId);
  const file = useFileCargoAction(worldId);
  const [query, setQuery] = useState("");
  const [selectedSeq, setSelectedSeq] = useState<number | null>(null);
  const [fileNote, setFileNote] = useState<string | null>(null);

  // `asOfTurn` is a staleness marker, not a cache: re-read after every commit.
  useEffect(() => {
    setSelectedSeq(null);
  }, [entityId]);
  useEffect(() => {
    if (entityId) void cargoQuery.refetch();
    // Refetch on turn advance only — the query key itself is (world, legion).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn]);

  const fold = useMemo(() => {
    if (!cargoQuery.data) return null;
    return foldLegionCargoSheet(cargoQuery.data, { ownerFactionId: props.ownerFactionId });
  }, [cargoQuery.data, props.ownerFactionId]);

  if (!entityId) return null;
  if (cargoQuery.isLoading) return <div data-testid="cargo-loading">Reading packs…</div>;
  if (cargoQuery.isError || !fold) {
    return (
      <div data-testid="cargo-error">
        No such band.{" "}
        <button type="button" onClick={() => void cargoQuery.refetch()}>
          Retry
        </button>
      </div>
    );
  }

  const describeResult = (ok: boolean, reason: string, replayed: boolean): string => {
    if (!ok) {
      const key = legionSheetReasonKey(reason);
      if (key) {
        const sentence = legionSheetCopy(key, { holder: props.ownerFactionId });
        if (sentence) return `${replayed ? "Already filed — " : ""}${sentence}`;
      }
      if (reason === "correlation.missing" || reason.length === 0) {
        return "Couldn't file that order — nothing was moved.";
      }
      return `Couldn't file that order (${reason}) — nothing was moved.`;
    }
    return replayed ? "Already filed — showing the recorded answer." : "Filed — resolution arrives with the turn report, not this button.";
  };

  const handleAction = (action: LegionCargoBusAction) => {
    // GG-55: a known-unfilable action stays enabled and answers visibly.
    if ((action.type === "cargo.unload" || action.type === "cargo.hand-to-band") && action.seq < 0) {
      setFileNote("Pick a row first — nothing was filed.");
      return;
    }
    if (action.type === "cargo.load") {
      const ref = action.cargoKind === "instance" ? action.instanceId : action.containerId;
      if (!ref || ref.trim().length === 0) {
        setFileNote("Name a stash row first — nothing was filed.");
        return;
      }
      if (action.cargoKind === "stack" && !(action.qty != null && action.qty > 0)) {
        setFileNote("Name an amount greater than zero — nothing was filed.");
        return;
      }
    }
    if (action.type === "cargo.hand-to-band" && action.targetEntityId.trim().length === 0) {
      setFileNote("Name the receiving band first — nothing was filed.");
      return;
    }
    setFileNote("Filing…");
    void file.mutateAsync({ action, turn, commanderId: props.commanderId }).then(
      (result) => {
        const r = result as unknown as { ok: boolean; reason: string; replayed: boolean };
        setFileNote(describeResult(r.ok, r.reason, r.replayed));
      },
      () => setFileNote("Couldn't file that order — nothing was moved.")
    );
  };

  // Deposit / withdraw / pick-up ride the same bus shape for
  // `storage-cache-ui` (see `cargoActions.ts`); this tab binds only the
  // three actions above.
  return (
    <CargoTabContent
      fold={fold}
      displayName={props.displayName}
      query={query}
      onQueryChange={setQuery}
      selectedSeq={selectedSeq}
      onSelectSeq={setSelectedSeq}
      fileNote={fileNote}
      onAction={handleAction}
    />
  );
}

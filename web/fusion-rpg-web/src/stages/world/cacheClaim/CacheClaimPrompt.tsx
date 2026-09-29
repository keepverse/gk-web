import { useEffect, useMemo, useRef, useState } from "react";
import { PanelShell } from "@/shell/PanelShell";
import {
  adaptClaimableCaches,
  claimApSlot,
  foldCacheClaim,
  legionSheetReasonKey
} from "@/contract/adapt";
import type {
  CacheClaimApSlot,
  CacheClaimFold,
  CachePinListView,
  CachePinView
} from "@/contract/types";
import { useClaimableCaches, useFileClaimCache, useWorldTurnReport } from "@/lib/bus/world";
import { buildClaimBody, cargoCommandId } from "../legionSheet/cargoActions";
import { legionSheetCopy } from "../legionSheet/copyCatalog";
import { CachePin } from "../render/CachePin";
import { captureLoserToast } from "./captureNotice";
import type { RailItem } from "@/shell/notify/rail/railStore";

/**
 * empire-inventory-surfaces `storage-cache-ui` §§Design 2–4 (plan Task 4D.2b):
 * pin → prompt → fits/left-behind → pick-up, plus the capture-loss toast wire.
 *
 * - One legion's `GET .../claimable-caches` per selection (re-read per
 *   selection; `asOfTurn` is a staleness marker — the layer never subscribes,
 *   never caches across turns). No empire-wide fetch (Diablo-memory precedent).
 * - Pin presence == response presence: the layer maps `pins` 1:1, no filter,
 *   no position compare, no `visible` handling (see `CachePin`).
 * - Pick-up files ONE `claim-cache` through the claims filer
 *   (`useFileClaimCache` over `POST .../claims` — the same filer 4D.1's bus
 *   routes `cache.pick-up` through, same `{ commandId, cacheId }` body via
 *   the shared `buildClaimBody`; filed here rather than through
 *   `useFileCargoAction` because one band may pick up two caches in one turn
 *   and the queue's per-(turn, kind, band) key would replay the second as
 *   the first — the key stays the ONE `CommandId` wire field, suffixed
 *   per cache, `correlationId := CommandId` end to end). Double-submit of the
 *   same cache replays on `CommandId`.
 * - The answer is folded off the event feed (the last finished turn's report:
 *   the entry whose subject is the filed `CommandId` carries the verb's own
 *   detail verbatim). The filer's `ok` answers filing only (GG-15).
 * - Capture header is the vault block's live read (shared, never duplicated
 *   here); the loser toast edge-triggers here off the same live read and is
 *   handed to the existing `NotifyRail` via `onNotify` — no second feed.
 */

// ---------------------------------------------------------------------------
// Pure view (landmark-tested without react-query).
// ---------------------------------------------------------------------------

export function CachePinLayer(props: {
  pins: CachePinView[];
  entityId: string;
  asOfTurn: number;
  selectedCacheId: string | null;
  onPick: (cacheId: string) => void;
}) {
  return (
    <svg
      data-testid="cache-claim-layer"
      data-entity={props.entityId}
      data-as-of-turn={props.asOfTurn}
      role="group"
      aria-label="Fallen caches within reach"
    >
      {props.pins.map((pin) => (
        <CachePin
          key={pin.cacheId}
          pin={pin}
          selected={props.selectedCacheId === pin.cacheId}
          onPick={props.onPick}
        />
      ))}
    </svg>
  );
}

export function CacheClaimPromptContent(props: {
  entityId: string;
  asOfTurn: number;
  pins: CachePinView[];
  apSlot: CacheClaimApSlot | null;
  selectedCacheId: string | null;
  onSelectCache: (cacheId: string | null) => void;
  outcome: CacheClaimFold | null;
  fileNote: string | null;
  actionPending: boolean;
  onPickUp: (cacheId: string) => void;
}) {
  const { outcome } = props;
  const outcomeCopy = outcome?.copyKey ? legionSheetCopy(outcome.copyKey) : null;
  const selected =
    props.selectedCacheId != null
      ? (props.pins.find((p) => p.cacheId === props.selectedCacheId) ?? null)
      : null;

  return (
    <PanelShell
      open={selected != null}
      onOpenChange={(next) => {
        if (!next) props.onSelectCache(null);
      }}
      title="Fallen cache"
      headerMode="none"
      testId="cache-claim-prompt"
    >
      {selected == null ? null : (
        <div data-testid="cache-claim-body" data-cache={selected.cacheId}>
          <h4 data-testid="cache-claim-title">Fallen cache</h4>
          <p data-testid="cache-claim-count">
            {selected.itemCount.value} {selected.itemCount.value === 1 ? "pack" : "packs"} within
            reach · as of turn {props.asOfTurn}
          </p>

          <input
            data-testid="cache-claim-search"
            type="search"
            aria-label="Filter packs"
            placeholder="Filter packs"
          />

          {outcome == null || outcome.verdict === "unreadable" ? (
            <p data-testid="cache-claim-report-note">
              As of turn {props.asOfTurn} — re-read after every commit before acting.
            </p>
          ) : (
            <ul data-testid="cache-claim-rows">
              <li data-testid={`cache-claim-outcome-${selected.cacheId}-fits`}>
                {outcome.claimed} aboard{outcomeCopy ? ` — ${outcomeCopy}` : ""}
              </li>
              {outcome.verdict === "partial" ? (
                <li data-testid={`cache-claim-outcome-${selected.cacheId}-left-behind`}>
                  {outcome.skipped} waits where {outcome.skipped === 1 ? "it lies" : "they lie"}
                </li>
              ) : null}
              {outcome.verdict === "stale-pin" ? (
                <li data-testid={`cache-claim-outcome-${selected.cacheId}-stale`}>
                  {outcomeCopy ?? "No longer within reach."}
                </li>
              ) : null}
            </ul>
          )}

          <div data-testid="cache-claim-actions">
            <button
              type="button"
              data-testid="cache-claim-pickup"
              disabled={props.actionPending}
              aria-label="Pick up the fallen cache"
              onClick={() => props.onPickUp(selected.cacheId)}
            >
              {props.apSlot ? (
                <>{props.apSlot.label.split("(")[0]?.trim() ?? "pick up"}{" "}
                <span data-testid="cache-claim-ap">({props.apSlot.costMilli} AP)</span></>
              ) : (
                <span data-testid="cache-claim-ap-pending">…</span>
              )}
            </button>
          </div>

          {props.fileNote ? <p data-testid="cache-claim-file-note">{props.fileNote}</p> : null}
        </div>
      )}
    </PanelShell>
  );
}

// ---------------------------------------------------------------------------
// Container (the one-scope read + the filing wire + the feed fold).
// ---------------------------------------------------------------------------

/**
 * The idempotency key for one pick-up filing. The queue's own
 * `cargoCommandId(turn, "claim-cache", entityId)` shape, suffixed with the
 * cache so two different caches filed by one band in one turn are two
 * filings, not a replay of each other. Still the ONE `CommandId` wire field
 * (`correlationId := CommandId` end to end) — never a second key. Over-long
 * ids refuse loud at submit (`command.id-too-long`, zero writes), never
 * truncated silently.
 */
export function claimCommandId(turn: number, entityId: string, cacheId: string): string {
  return `${cargoCommandId(turn, "claim-cache", entityId)}~${cacheId}`;
}

/** Latest feed detail for one filed command (subject IS the CommandId — 4A.1's pass). */
export function detailForCommand(
  entries: readonly { subject: string; detail: string }[] | undefined,
  commandId: string
): string | null {
  if (!entries) return null;
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (entry && entry.subject === commandId) return entry.detail;
  }
  return null;
}

export function CacheClaimPrompt(props: {
  worldId: string | null;
  entityId: string | null;
  /** Current turn: the feed read is `turn - 1` (the last turn that finished). */
  turn: number;
  commanderId?: string;
  /** Sector scope for the capture-loss toast (vault header's own live read). */
  sectorId?: string | null;
  ownerFactionId?: string | null;
  viewerFactionId?: string | null;
  onNotify?: (item: RailItem) => void;
}) {
  const { worldId, entityId, turn } = props;
  const listQuery = useClaimableCaches(worldId, entityId);
  const reportQuery = useWorldTurnReport(worldId, turn > 0 ? turn - 1 : null);
  const claim = useFileClaimCache(worldId);

  const [selectedCacheId, setSelectedCacheId] = useState<string | null>(null);
  const [fileNote, setFileNote] = useState<string | null>(null);
  const [filed, setFiled] = useState<Record<string, string>>({});

  // Per-legion reset: the player asked about THIS band's reach, not its packs.
  useEffect(() => {
    setSelectedCacheId(null);
    setFileNote(null);
    setFiled({});
  }, [entityId]);

  const pinsView: CachePinListView | null = useMemo(
    () => (listQuery.data ? adaptClaimableCaches(listQuery.data) : null),
    [listQuery.data]
  );

  const apSlot: CacheClaimApSlot | null = useMemo(
    () => (pinsView ? claimApSlot(pinsView.claimCostMilli) : null),
    [pinsView]
  );

  const outcome: CacheClaimFold | null = useMemo(() => {
    if (entityId == null || selectedCacheId == null) return null;
    const commandId = Object.keys(filed).find((key) => filed[key] === selectedCacheId);
    if (!commandId) return foldCacheClaim(entityId, selectedCacheId, null);
    return foldCacheClaim(
      entityId,
      selectedCacheId,
      detailForCommand(reportQuery.data?.entries, commandId)
    );
  }, [entityId, selectedCacheId, filed, reportQuery.data]);

  // Capture-loss toast: edge-trigger off the live header read. Exactly-once
  // per (sector, owner) — the ref is a fired-set, never displayed history.
  const firedToastIds = useRef<Set<string>>(new Set());
  const previousOwner = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (props.sectorId == null || props.onNotify == null) return;
    const toast = captureLoserToast({
      sectorId: props.sectorId,
      ownerFactionId: props.ownerFactionId ?? null,
      viewerFactionId: props.viewerFactionId ?? null,
      previousOwnerFactionId: previousOwner.current
    });
    previousOwner.current = props.ownerFactionId ?? null;
    if (toast && !firedToastIds.current.has(toast.id)) {
      firedToastIds.current.add(toast.id);
      props.onNotify(toast);
    }
  }, [props.sectorId, props.ownerFactionId, props.viewerFactionId, props.onNotify]);

  if (entityId == null) return null;

  if (listQuery.isLoading) {
    return <div data-testid="cache-claim-loading">Reading the ground…</div>;
  }
  if (listQuery.isError || !pinsView) {
    return (
      <div data-testid="cache-claim-error">
        The ground could not be read.{" "}
        <button type="button" onClick={() => void listQuery.refetch()}>
          Retry
        </button>
      </div>
    );
  }

  const describeResult = (ok: boolean, reason: string, replayed: boolean): string => {
    if (!ok) {
      const key = legionSheetReasonKey(reason);
      if (key) {
        const sentence = legionSheetCopy(key, { holder: props.viewerFactionId });
        if (sentence) return `${replayed ? "Already filed — " : ""}${sentence}`;
      }
      return `Couldn't file that order (${reason}) — nothing was moved.`;
    }
    return replayed
      ? "Already filed — showing the recorded answer."
      : "Filed — resolution arrives with the turn report, not this button.";
  };

  const handlePickUp = (cacheId: string) => {
    const commandId = claimCommandId(turn, entityId, cacheId);
    setFiled((prev) => ({ ...prev, [commandId]: cacheId }));
    setFileNote("Filing…");
    void claim
      .mutateAsync({
        entityId,
        body: {
          ...(props.commanderId ? { commanderId: props.commanderId } : {}),
          ...buildClaimBody(commandId, cacheId)
        }
      })
      .then(
        (result) => {
          const r = result as unknown as { ok: boolean; reason: string; replayed: boolean };
          setFileNote(describeResult(r.ok, r.reason, r.replayed));
        },
        () => setFileNote("Couldn't file that order — nothing was moved.")
      );
  };

  return (
    <>
      <CachePinLayer
        pins={pinsView.pins}
        entityId={pinsView.entityId}
        asOfTurn={pinsView.asOfTurn}
        selectedCacheId={selectedCacheId}
        onPick={setSelectedCacheId}
      />
      <CacheClaimPromptContent
        entityId={pinsView.entityId}
        asOfTurn={pinsView.asOfTurn}
        pins={pinsView.pins}
        apSlot={apSlot}
        selectedCacheId={selectedCacheId}
        onSelectCache={setSelectedCacheId}
        outcome={outcome}
        fileNote={fileNote}
        actionPending={claim.isPending}
        onPickUp={handlePickUp}
      />
    </>
  );
}

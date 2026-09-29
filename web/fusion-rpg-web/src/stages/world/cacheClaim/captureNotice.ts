import type { RailItem } from "@/shell/notify/rail/railStore";

export type CaptureLossInput = {
  /** The sector whose vault header re-read. */
  sectorId: string;
  /** Live `SectorStorageDto.OwnerFactionId` — the capture-header input, current fact only. */
  ownerFactionId: string | null;
  /** The viewer's own faction (the `asFaction` the reads went out with). */
  viewerFactionId: string | null;
  /**
   * The owner this viewer last saw for the sector (the previous read's
   * `OwnerFactionId`). Edge-trigger only — never displayed (spec §Design 4:
   * no "previous owner" state, no history line; the header is the current
   * fact). `null` on first sight: a header with no past answers nothing.
   */
  previousOwnerFactionId: string | null | undefined;
};

/**
 * empire-inventory-surfaces `storage-cache-ui` §Design 4 (plan Task 4D.2b) —
 * capture-notice binding off the event feed.
 *
 * Backend transfer is silent by construction (reachability derived live,
 * `RpgStore.SectorStorage.cs` — consumed): the header is the live read, and
 * the toast edge-triggers when the live read stops naming the viewer.
 *
 * - Header: always `held by X` from the live `OwnerFactionId` (the vault
 *   block renders it every paint; this function formats it, never caches it).
 * - Loser toast: exactly one `RailItem` draft when the viewer held the
 *   sector on the previous read and someone else holds it now. Fired through
 *   the existing `NotifyRail` (the caller appends the draft to its items —
 *   no second feed table, no parallel notification pipeline).
 * - Winner: no toast. Their vault header already says "held by" them
 *   (Owner resolution, ideal §10 Q4) — a toast there would be noise, and a
 *   test below proves its absence.
 * - Stranger (viewer held nothing): no toast. Silence for the uninvolved is
 *   not an outcome (GG-16 binds the loser only).
 *
 * Category: `territory.lost` — the catalogue's own row for ground changing hands (`command.dropped`
 * was the wrong bucket: nothing was dropped). This notice is the NAMED DEBT ADAPTER for the missing
 * `claim.lost:` producer (world-notify-source §Debt, ask A3 declined): it renders in the world rail
 * through `legacyCaptureLoss.ts`, never enters the feed, and is never durable. The day a real
 * producer line lands, this file's toast half and that adapter are deleted (NS7.3).
 */
export function captureHeader(ownerFactionId: string | null): string {
  return `held by ${ownerFactionId ?? "—"}`;
}

export function captureLoserToast(input: CaptureLossInput): RailItem | null {
  const { sectorId, ownerFactionId, viewerFactionId, previousOwnerFactionId } = input;
  if (viewerFactionId == null || viewerFactionId.length === 0) return null;
  if (previousOwnerFactionId == null || previousOwnerFactionId.length === 0) return null;
  if (previousOwnerFactionId !== viewerFactionId) return null;
  if (ownerFactionId === viewerFactionId) return null;
  return {
    id: `capture-loss-${sectorId}`,
    dedupKey: `capture-loss-${sectorId}`,
    // Local by construction: this notice is never durable and never enters the feed
    // (world-notify-source §Debt), so it has no server seq and no turn.
    seq: null,
    category: "territory.lost",
    severity: "important",
    title: `Vault at ${sectorId} changed hands`,
    body: `Held by ${ownerFactionId ?? "another band"} now — what was stored there answers to them.`,
    state: "unread",
    worldId: null,
    worldTurn: null,
    blocking: false
  };
}

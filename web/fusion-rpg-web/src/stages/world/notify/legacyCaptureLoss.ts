import { create } from "zustand";
import { dismiss as dismissRow, open as openRow, type RailItem } from "@/shell/notify/rail/railStore";

/**
 * world-notify-source §Debt, step 1 — the capture-loss notice kept alive as **named debt** until the
 * world map ships a real `claim.lost:{sectorId}` producer line (cross-program ask A3, declined).
 *
 * <p>Three properties this module exists to hold, each one a boundary the program drew: it renders
 * **in the world rail** (the player still learns their vault changed hands), it is **never injected
 * into the feed** (the feed is the server's own rows, and a local push into it is a forbidden
 * boundary), and it is **never durable** (no `seq`, no turn, nothing to catch up on). The server
 * remains the one source for the feed; this is a screen row and nothing more.</p>
 *
 * <p>It adopts the row its producer already built (`cacheClaim`'s own edge-triggered
 * `captureLoserToast`, which decides whether this is a loser's story at all) rather than rebuilding
 * it, so the debt has exactly one definition and this module only owns where it may live. Its
 * transitions are `railStore`'s own pure ones over a local list, so opening and dismissing a debt row
 * behave exactly like a server row's — the difference is only that they go nowhere.</p>
 */
type LegacyCaptureLossState = {
  items: RailItem[];
  /** Deduped by id: the same sector changing hands twice in one session is one notice. */
  adopt: (item: RailItem) => void;
  open: (id: string) => void;
  dismiss: (id: string) => void;
  clear: () => void;
};

export const useLegacyCaptureLoss = create<LegacyCaptureLossState>((set) => ({
  items: [],
  adopt: (item) => set((s) => (s.items.some((i) => i.id === item.id) ? s : { items: [...s.items, item] })),
  open: (id) => set((s) => ({ items: openRow(s.items, id) })),
  dismiss: (id) => set((s) => ({ items: dismissRow(s.items, id) })),
  clear: () => set({ items: [] })
}));

/**
 * The rail's rows: the feed's own selection for this mount, then these local notices. One function
 * so "the debt adapter appends to what is rendered, never to what is stored" is a single readable
 * line rather than a convention a later edit can quietly break.
 */
export function worldRailRows(feedItems: readonly RailItem[], legacyItems: readonly RailItem[]): RailItem[] {
  return [...feedItems, ...legacyItems];
}

/** Test isolation — not for production. */
export function resetLegacyCaptureLossForTests(): void {
  useLegacyCaptureLoss.setState({ items: [] });
}

import { useEffect, useRef } from "react";
import { recordFirstOpen, usePlayers } from "@/lib/bus";

/**
 * rift-gate first-open-signal: records the durable once-per-player fact that the FE has been opened.
 *
 * Fired once on load, keyed on the FE being opened — not on the tombstone, the embed marker, or the
 * route, so it is correct however the player arrived (menu tombstone, host hotkey, the launcher's
 * "Open RPG UI", or a plain browser visit).
 *
 * Best-effort by design: a failed write is retried on the next load and never blocks the shell. The
 * server owns idempotency (INSERT OR IGNORE on player_id), so a repeat is a no-op.
 *
 * Trigger only — the capture program that consumes the fact is separate and is not started here.
 */
export function FirstOpenSignal() {
  const players = usePlayers();
  const playerId = players.data?.currentPlayerId;
  const sentFor = useRef<number | null>(null);

  useEffect(() => {
    if (typeof playerId !== "number") return;
    if (sentFor.current === playerId) return; // once per player per session
    sentFor.current = playerId;
    void recordFirstOpen(playerId).catch(() => {
      // Never surface: the fact is retried on the next load, and the FE keeps working without it.
      sentFor.current = null;
    });
  }, [playerId]);

  return null;
}

import { HubConnectionState, type HubConnection } from "@microsoft/signalr";
import { getJson } from "./rest";
import type { PlayersListDto } from "./types";

// player-routing spec §2 - one local signal, `notify-client` starts its catch-up on it, never
// before. Same module-level Set<listener> shape as `icon-epoch.ts`'s own local-signal precedent.
const listeners = new Set<(playerId: number) => void>();

export function subscribePlayerJoined(listener: (playerId: number) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emitPlayerJoined(playerId: number): void {
  for (const l of listeners) l(playerId);
}

/**
 * player-routing spec §2 Code style - one function, called from every path that joins "web".
 * Emits `player-joined` only when the server actually joined the group (T5: a refused id logs
 * once and joins nothing, notify-client shows its designed error state, never a blank feed).
 *
 * Never rejects: a connection that is not `Connected` (still starting, mid-reconnect, or a test's
 * bare singleton with no live socket) cannot invoke at all, and `HubConnection.invoke` throws
 * synchronously for that case rather than queuing the call. Every caller here fires this
 * fire-and-forget (`void joinCurrentPlayer(...)`), so this function - not each call site - is
 * where "a join attempt is best-effort and never crashes the caller" lives.
 */
export async function joinCurrentPlayer(c: HubConnection, playerId: number): Promise<boolean> {
  if (c.state !== HubConnectionState.Connected) {
    console.warn(`[playerRouting] JoinPlayer skipped for id ${playerId}: connection state is ${c.state}`);
    return false;
  }
  let ok: boolean;
  try {
    ok = await c.invoke<boolean>("JoinPlayer", playerId);
  } catch (err) {
    console.warn(`[playerRouting] JoinPlayer failed for id ${playerId}`, err);
    return false;
  }
  if (ok) emitPlayerJoined(playerId);
  else console.warn(`[playerRouting] JoinPlayer refused for id ${playerId}`);
  return ok;
}

/**
 * T1 (connection start) / T2 (reconnect) - joins the save the web is showing right now (spec: "the
 * save the web is showing, today /api/players currentPlayerId"). A fresh REST read rather than the
 * TanStack cache, so a connection start or reconnect never races the players query's own fetch.
 */
export async function joinShownPlayer(c: HubConnection): Promise<boolean> {
  const list = await getJson<PlayersListDto>("/api/players");
  return joinCurrentPlayer(c, list.currentPlayerId);
}

/** Test isolation - not for production. */
export function resetPlayerRoutingForTests(): void {
  listeners.clear();
}

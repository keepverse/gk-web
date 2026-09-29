import type { EventEnvelope } from "./types";

const CAP = 800;
const HIT_KINDS = new Set(["combat.hit", "combat.hitland"]);

type Listener = () => void;

export type LawnRecoveryState =
  | { kind: "loading"; reason: "entry" | "reconnect" }
  | { kind: "stale"; reason: "reconnect" | "recovery"; matchKey?: string }
  | { kind: "ready"; matchKey?: string; snapshotId?: number }
  | { kind: "empty"; matchKey?: string; snapshotId?: number }
  | { kind: "error"; message: string; matchKey?: string };

export type LawnRecoveryStatus = {
  state: "loading" | "stale" | "ready" | "empty" | "error";
  matchKey?: string | null;
  snapshotId?: number | null;
  message?: string | null;
};

let events: EventEnvelope[] = [];
let scopedEvents: EventEnvelope[] = [];
let lawnMatchKey: string | undefined;
let lawnMatchEventId = 0;
let lawnScopeClosed = false;
let membership: EventEnvelope[] = [];
let membershipSig = "";
let lastHitEvent: EventEnvelope | null = null;
let recoveryState: LawnRecoveryState = { kind: "loading", reason: "entry" };

const listeners = new Set<Listener>();
const lastHitListeners = new Set<Listener>();
const recoveryListeners = new Set<Listener>();

function isHit(kind: string | undefined): boolean {
  return HIT_KINDS.has(kind ?? "");
}

/**
 * The live log + lawn rings are CAPTURE surfaces. Web-mode battles (game `webrpg-1`) resolve in
 * milliseconds and would render as a capture burst — they stay on their own runs/battle surfaces
 * (spec-match-source-core precondition 8). Unstamped events are legacy capture traffic.
 */
export function isCaptureGame(game: string | undefined | null): boolean {
  return game == null || game === "" || game.startsWith("pvzrh");
}

function eventMatchKey(event: EventEnvelope): string | undefined {
  const direct = typeof event.matchKey === "string" ? event.matchKey.trim() : "";
  if (direct) return direct;
  if (!event.payload || typeof event.payload !== "object" || Array.isArray(event.payload)) {
    return undefined;
  }
  const payload = event.payload as Record<string, unknown>;
  const match =
    payload.match && typeof payload.match === "object" && !Array.isArray(payload.match)
      ? (payload.match as Record<string, unknown>)
      : {};
  const nested = typeof match.matchKey === "string" ? match.matchKey.trim() : "";
  if (nested) return nested;
  const flat = typeof payload.matchKey === "string" ? payload.matchKey.trim() : "";
  return flat || undefined;
}

function isTerminalForLawn(item: EventEnvelope): boolean {
  if (
    item.kind === "board.end" ||
    item.kind === "match.result" ||
    item.kind === "match.win" ||
    item.kind === "match.lose"
  ) {
    return true;
  }
  if (item.kind !== "debug.snapshot") return false;
  const payload =
    item.payload && typeof item.payload === "object" && !Array.isArray(item.payload)
      ? (item.payload as Record<string, unknown>)
      : {};
  const match =
    payload.match && typeof payload.match === "object" && !Array.isArray(payload.match)
      ? (payload.match as Record<string, unknown>)
      : {};
  const phase =
    typeof match.phase === "string"
      ? match.phase
      : typeof payload.matchPhase === "string"
        ? payload.matchPhase
        : "";
  const normalized = phase.trim().toLowerCase();
  return normalized === "idle" || normalized === "ending";
}

function emit() {
  for (const l of listeners) l();
}

function emitLastHit() {
  for (const l of lastHitListeners) l();
}

function emitRecovery() {
  for (const l of recoveryListeners) l();
}

function membershipSignature(list: readonly EventEnvelope[]): string {
  return list.map((e) => `${e.id ?? ""}:${e.kind}:${eventMatchKey(e) ?? ""}`).join("\n");
}

function rebuildMembership(): void {
  const next = scopedEvents.filter((event) => !isHit(event.kind));
  const sig = membershipSignature(next);
  if (sig === membershipSig) return;
  membershipSig = sig;
  membership = next;
}

function noteHits(newestFirst: readonly EventEnvelope[]): boolean {
  for (const e of newestFirst) {
    if (!isHit(e.kind)) continue;
    lastHitEvent = e;
    return true;
  }
  return false;
}

function setRecovery(next: LawnRecoveryState): void {
  recoveryState = next;
  emitRecovery();
}

function resetScope(): void {
  lawnMatchKey = undefined;
  lawnMatchEventId = 0;
  lawnScopeClosed = false;
  scopedEvents = [];
  membershipSig = "";
}

/**
 * A web client follows one live match. The first identified lifecycle/snapshot row opens the
 * scope; later rows from another match are isolated. A new board.start is the only ordinary event
 * that can intentionally open the next scope.
 */
function acceptForLawn(item: EventEnvelope): boolean {
  const key = eventMatchKey(item);
  if (!key) return !lawnMatchKey;
  if (!lawnMatchKey) {
    if (item.kind !== "board.start" && item.kind !== "debug.snapshot") return false;
    lawnMatchKey = key;
    lawnMatchEventId = item.id ?? 0;
    lawnScopeClosed = isTerminalForLawn(item);
    scopedEvents = [];
    return true;
  }
  if (key === lawnMatchKey) {
    if (item.id != null && item.id > lawnMatchEventId) lawnMatchEventId = item.id;
    if (item.kind === "board.start") lawnScopeClosed = false;
    else if (isTerminalForLawn(item)) lawnScopeClosed = true;
    return true;
  }
  if (item.kind !== "board.start" || !lawnScopeClosed) return false;
  const eventId = item.id ?? 0;
  if (eventId > 0 && lawnMatchEventId > 0 && eventId <= lawnMatchEventId) return false;
  lawnMatchKey = key;
  lawnMatchEventId = eventId;
  lawnScopeClosed = false;
  scopedEvents = [];
  membershipSig = "";
  return true;
}

function appendScoped(item: EventEnvelope): void {
  scopedEvents = [item, ...scopedEvents].slice(0, CAP);
}

export function getLogEvents(): EventEnvelope[] {
  return events;
}

/** Hub ring for the currently isolated match — never a foreign match's membership. */
export function getLawnMembershipRing(): EventEnvelope[] {
  return membership;
}

export function getLawnMatchKey(): string | undefined {
  return lawnMatchKey;
}

export function isLawnEventInScope(item: EventEnvelope): boolean {
  const key = eventMatchKey(item);
  return lawnMatchKey ? key === lawnMatchKey : !key;
}

export function getLastHitEvent(): EventEnvelope | null {
  return lastHitEvent;
}

export function appendLogEvents(items: EventEnvelope[]): void {
  const capture = items.filter((e) => isCaptureGame(e.game));
  if (!capture.length) return;
  const accepted = capture.filter((item) => {
    const keep = acceptForLawn(item);
    if (keep) appendScoped(item);
    return keep;
  });
  const newestFirst = [...capture].reverse();
  events = newestFirst.concat(events).slice(0, CAP);
  const hitChanged = noteHits([...accepted].reverse());
  rebuildMembership();
  emit();
  if (hitChanged) emitLastHit();
}

export function appendLogEvent(item: EventEnvelope): void {
  if (!isCaptureGame(item.game)) return;
  const accepted = acceptForLawn(item);
  if (accepted) appendScoped(item);
  events = [item, ...events].slice(0, CAP);
  const hitChanged = accepted && noteHits([item]);
  rebuildMembership();
  emit();
  if (hitChanged) emitLastHit();
}

export function clearLogEvents(): void {
  events = [];
  resetScope();
  membership = [];
  membershipSig = "";
  const hadHit = lastHitEvent != null;
  lastHitEvent = null;
  setRecovery({ kind: "loading", reason: "entry" });
  emit();
  if (hadHit) emitLastHit();
}

export function getLawnRecoveryState(): LawnRecoveryState {
  return recoveryState;
}

export function subscribeLawnRecovery(listener: Listener): () => void {
  recoveryListeners.add(listener);
  return () => {
    recoveryListeners.delete(listener);
  };
}

export function beginLawnRecovery(reason: "entry" | "reconnect"): void {
  const hadState =
    recoveryState.kind === "ready" ||
    recoveryState.kind === "empty" ||
    recoveryState.kind === "stale" ||
    scopedEvents.length > 0;
  setRecovery(
    hadState && reason === "reconnect"
      ? { kind: "stale", reason: "reconnect", matchKey: lawnMatchKey }
      : { kind: "loading", reason }
  );
}

export function markLawnRecoveryStatus(status: LawnRecoveryStatus | null | undefined): void {
  if (!status) return;
  const statusMatchKey = status.matchKey?.trim();
  if (statusMatchKey && lawnMatchKey && statusMatchKey !== lawnMatchKey) return;
  if (!statusMatchKey && lawnMatchKey && (status.state === "ready" || status.state === "empty")) return;
  const matchKey = statusMatchKey || lawnMatchKey;
  switch (status.state) {
    case "loading":
      setRecovery(
        recoveryState.kind === "stale"
          ? { kind: "stale", reason: "recovery", matchKey }
          : { kind: "loading", reason: "reconnect" }
      );
      return;
    case "stale":
      setRecovery({ kind: "stale", reason: "recovery", matchKey });
      return;
    case "ready":
      if (
        recoveryState.kind === "empty" &&
        status.snapshotId != null &&
        recoveryState.snapshotId === status.snapshotId &&
        recoveryState.matchKey === matchKey
      ) {
        return;
      }
      setRecovery({ kind: "ready", matchKey, snapshotId: status.snapshotId ?? undefined });
      return;
    case "empty":
      setRecovery({ kind: "empty", matchKey, snapshotId: status.snapshotId ?? undefined });
      return;
    case "error":
      setRecovery({ kind: "error", message: status.message?.trim() || "Lawn recovery failed.", matchKey });
      return;
  }
}

export function markLawnRecoverySnapshot(item: EventEnvelope): void {
  if (item.kind !== "debug.snapshot" || !isCaptureGame(item.game) || !isLawnEventInScope(item)) {
    return;
  }
  const payload =
    item.payload && typeof item.payload === "object" && !Array.isArray(item.payload)
      ? (item.payload as Record<string, unknown>)
      : {};
  const match =
    payload.match && typeof payload.match === "object" && !Array.isArray(payload.match)
      ? (payload.match as Record<string, unknown>)
      : {};
  const phase = typeof match.phase === "string" ? match.phase.trim().toLowerCase() : "";
  const matchKey = eventMatchKey(item);
  setRecovery({
    kind: phase === "idle" || phase === "ending" ? "empty" : "ready",
    matchKey,
    snapshotId: item.id ?? undefined
  });
}

export function subscribeLog(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function subscribeLastHit(listener: Listener): () => void {
  lastHitListeners.add(listener);
  return () => {
    lastHitListeners.delete(listener);
  };
}

declare global {
  interface Window {
    /** Playwright e2e — append capture events without a live hub. */
    __fusionRpgAppendLogEvent?: typeof appendLogEvent;
  }
}

if (typeof window !== "undefined") {
  window.__fusionRpgAppendLogEvent = appendLogEvent;
}

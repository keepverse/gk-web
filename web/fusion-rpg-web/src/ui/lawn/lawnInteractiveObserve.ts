type LawnInteractiveEvent =
  | "collection.select"
  | "dock.open"
  | "dock.select"
  | "sheet.push"
  | "spawn.enter"
  | "spawn.intent"
  | "spawn.reject"
  | "order.arm"
  | "order.intent"
  | "order.cancel"
  | "hud.field"
  | "hud.click_dock"
  | "tile.dock"
  | "mode.change";

const RING_MAX = 64;
const ring: { t: number; event: LawnInteractiveEvent; detail?: Record<string, unknown> }[] = [];

/** Structured lawn-interactive observability — exercised by unit/E2E. */
export function logLawnInteractive(
  event: LawnInteractiveEvent,
  detail?: Record<string, unknown>
): void {
  const entry = { t: Date.now(), event, detail };
  ring.push(entry);
  if (ring.length > RING_MAX) ring.shift();
  if (typeof console !== "undefined" && console.debug) {
    console.debug("[lawn-interactive]", event, detail ?? {});
  }
  if (typeof window !== "undefined") {
    (window as unknown as { __fusionRpgLawnInteractive?: typeof ring }).__fusionRpgLawnInteractive =
      ring;
  }
}

export function peekLawnInteractiveLog(): readonly {
  t: number;
  event: LawnInteractiveEvent;
  detail?: Record<string, unknown>;
}[] {
  return ring;
}

export function clearLawnInteractiveLog(): void {
  ring.length = 0;
}

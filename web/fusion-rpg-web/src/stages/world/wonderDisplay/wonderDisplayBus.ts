/**
 * empire-wonder-surfaces `wonder-display` (plan Task 4D.4, spec §Design 1) — the closed bus.
 * All card actions travel this bus; pieces never fetch. Refusal toasts ride the same catalog
 * through the composer's own toast host (4D.3) — this bus carries display actions only.
 */

export const WONDER_DISPLAY_BUS = "wonder-display" as const;

export const WONDER_DISPLAY_EVENTS = [
  "wonder-display.card.expand",
  "wonder-display.reading.open",
  "wonder-display.teaser.explain",
  "wonder-display.retry"
] as const;

export type WonderDisplayEvent = (typeof WONDER_DISPLAY_EVENTS)[number];

export type WonderDisplayAction = {
  event: WonderDisplayEvent;
  structureId: string | null;
};

export function isWonderDisplayEvent(value: string): value is WonderDisplayEvent {
  return (WONDER_DISPLAY_EVENTS as readonly string[]).includes(value);
}

/**
 * The one constructor for bus actions. Loud on an unmapped event (the `worldEnums` precedent):
 * a second, silently-diverging event vocabulary is the failure mode this closed bus exists to
 * prevent — the composer (4D.3) consumes these names, never re-declares them.
 */
export function wonderDisplayAction(event: string, structureId: string | null): WonderDisplayAction {
  if (!isWonderDisplayEvent(event)) {
    throw new Error(`wonderDisplay: unmapped bus event ${JSON.stringify(event)}`);
  }
  return { event, structureId };
}

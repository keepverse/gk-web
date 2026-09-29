import { createSurfaceBus } from "./createSurfaceBus";

/**
 * empire-wonder-surfaces `wonder-composer` (plan Task 4D.3,
 * spec-wonder-composer.md §Design 3) — the closed `wonder-composer.*` bus.
 *
 * One closed vocabulary, six events. No other module emits these events;
 * no handler outside the composer recipe consumes them. Filing
 * acknowledgement is instant (within a frame); slot, stocks and relics
 * change only when the turn commit confirms (GG-15/GG-54). A reversal
 * (filed, then refused at commit) is shown and explained in player words
 * via the refusal fold, never silently snapped back.
 */
export type WonderComposerEvent =
  | "wonder-composer.search.set"
  | "wonder-composer.wonder.select"
  | "wonder-composer.relic.toggle"
  | "wonder-composer.slot.select"
  | "wonder-composer.confirm"
  | "wonder-composer.retry";

export function createWonderComposerBus() {
  return createSurfaceBus<WonderComposerEvent>();
}

export const WONDER_COMPOSER_EVENTS: readonly WonderComposerEvent[] = [
  "wonder-composer.search.set",
  "wonder-composer.wonder.select",
  "wonder-composer.relic.toggle",
  "wonder-composer.slot.select",
  "wonder-composer.confirm",
  "wonder-composer.retry"
] as const;

/** Payloads, one shape per event — named here so producers and handlers agree. */
export type WonderComposerPayloads = {
  "wonder-composer.search.set": { text: string };
  /** Locked-teaser ids refuse with reason (no select) — enforced by the fold, not the bus. */
  "wonder-composer.wonder.select": { structureId: string };
  /** Over-N picks refuse with the count line (never silently dropped) — enforced by the fold. */
  "wonder-composer.relic.toggle": { instanceId: string };
  /** Incompatible slots are unpickable-with-reason, never silently hidden — enforced by the fold. */
  "wonder-composer.slot.select": { slotIndex: number };
  "wonder-composer.confirm": Record<string, never>;
  "wonder-composer.retry": Record<string, never>;
};

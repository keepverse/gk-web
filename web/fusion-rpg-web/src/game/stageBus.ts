/**
 * Generic generation-scoped stage bus factory (phaser-kernel `stage-bus`).
 * Phaser-free — no React / lib/bus. Select payload shapes live in board-contract.
 */

export type StageBus<E extends string> = {
  on: (event: E, handler: (payload: unknown) => void) => () => void;
  emit: (event: E, payload: unknown) => void;
  clearAll: () => void;
};

type Handler = (payload: unknown) => void;

/** Required stems every canvas stage bus must expose (payloads carry `generation`). */
export const STAGE_BUS_REQUIRED_STEMS = [
  "model",
  "select",
  "interaction",
  "ready",
  "resized",
  "destroyed"
] as const;

export type StageBusRequiredStem = (typeof STAGE_BUS_REQUIRED_STEMS)[number];

export function createStageBus<E extends string>(): StageBus<E> {
  const listeners = new Map<E, Set<Handler>>();

  return {
    on(event, handler) {
      let set = listeners.get(event);
      if (!set) {
        set = new Set();
        listeners.set(event, set);
      }
      set.add(handler);
      return () => {
        set!.delete(handler);
      };
    },
    emit(event, payload) {
      const set = listeners.get(event);
      if (!set) return;
      for (const h of [...set]) h(payload);
    },
    clearAll() {
      listeners.clear();
    }
  };
}

/** Prefix a stem set into fully-qualified event names (`lawn:model`, …). */
export function stageEventNames<P extends string>(
  prefix: P,
  stems: readonly StageBusRequiredStem[] = STAGE_BUS_REQUIRED_STEMS
): Array<`${P}:${StageBusRequiredStem}`> {
  return stems.map((s) => `${prefix}:${s}` as `${P}:${StageBusRequiredStem}`);
}

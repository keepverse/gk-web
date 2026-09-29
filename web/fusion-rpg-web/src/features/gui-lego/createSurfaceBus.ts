/**
 * Generic typed surface bus. Derived wires a closed event union separately.
 */

export type BusHandler<E extends string> = (event: E, payload: unknown) => void;

export type SurfaceBus<E extends string> = {
  emit: (event: E, payload?: unknown) => void;
  on: (event: E, handler: (payload: unknown) => void) => () => void;
  onAny: (handler: BusHandler<E>) => () => void;
};

export function createSurfaceBus<E extends string>(): SurfaceBus<E> {
  const perEvent = new Map<E, Set<(payload: unknown) => void>>();
  const anyHandlers = new Set<BusHandler<E>>();

  return {
    emit(event, payload) {
      const set = perEvent.get(event);
      if (set) for (const h of set) h(payload);
      for (const h of anyHandlers) h(event, payload);
    },
    on(event, handler) {
      let set = perEvent.get(event);
      if (!set) {
        set = new Set();
        perEvent.set(event, set);
      }
      set.add(handler);
      return () => {
        set!.delete(handler);
      };
    },
    onAny(handler) {
      anyHandlers.add(handler);
      return () => {
        anyHandlers.delete(handler);
      };
    }
  };
}

/** Widen typed bus for RecipeMount / piece factories (emit accepts string). */
export function asSurfaceBusLike<E extends string>(bus: SurfaceBus<E>): import("./types").SurfaceBusLike {
  return {
    emit: (event, payload) => bus.emit(event as E, payload),
    on: (event, handler) => bus.on(event as E, handler)
  };
}

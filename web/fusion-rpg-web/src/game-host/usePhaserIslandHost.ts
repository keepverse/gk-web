import {
  useEffect,
  useRef,
  type MutableRefObject,
  type RefObject
} from "react";
import { allocGameGeneration } from "@/game/EventBus";
import {
  awaitDestroySettled,
  destroyMutexPending
} from "@/game/destroyGame";
import { emitKernelObs } from "@/game/kernelObs";

export type UsePhaserIslandHostArgs = {
  parentRef: RefObject<HTMLElement | null>;
  create: (opts: { parent: HTMLElement; generation: number }) => Phaser.Game;
  destroy: (
    game: Phaser.Game | null,
    generation: number
  ) => void | Promise<void>;
  /** Called when the facade marks this generation ready (stage bus :ready). */
  onReady?: (generation: number) => void;
  /**
   * Shared resize plumbing — facades emit stage-specific `*:resized` here.
   * Not island content (lens/viewMode stay off the hook).
   */
  onResized?: (generation: number, width: number, height: number) => void;
};

export type PhaserIslandHostApi = {
  generationRef: MutableRefObject<number>;
  readyRef: MutableRefObject<boolean>;
  gameRef: MutableRefObject<Phaser.Game | null>;
  /** Facade calls this from stage bus `:ready` when generation matches. */
  notifyReady: (generation: number) => void;
};

/**
 * Shared Phaser island mount skeleton (lock 3a).
 * Owns generation alloc, ResizeObserver, DESTROY wait via destroy-game mutex.
 * Island-specific props / bus buffering stay on LawnGameHost / WorldGameHost.
 */
export function usePhaserIslandHost({
  parentRef,
  create,
  destroy,
  onReady,
  onResized
}: UsePhaserIslandHostArgs): PhaserIslandHostApi {
  const generationRef = useRef(0);
  const readyRef = useRef(false);
  const gameRef = useRef<Phaser.Game | null>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const onResizedRef = useRef(onResized);
  onResizedRef.current = onResized;
  const createRef = useRef(create);
  createRef.current = create;
  const destroyRef = useRef(destroy);
  destroyRef.current = destroy;

  const notifyReady = (generation: number) => {
    if (generation !== generationRef.current) return;
    if (readyRef.current) return;
    readyRef.current = true;
    emitKernelObs("phaser-island-host", {
      event: "ready",
      generation
    });
    onReadyRef.current?.(generation);
  };

  useEffect(() => {
    const parent = parentRef.current;
    if (!parent) return;

    let cancelled = false;
    let ro: ResizeObserver | null = null;
    let generation = 0;

    const start = (el: HTMLElement) => {
      generation = allocGameGeneration();
      generationRef.current = generation;
      readyRef.current = false;

      emitKernelObs("phaser-island-host", {
        event: "create",
        generation
      });

      const game = createRef.current({
        parent: el,
        generation
      });
      if (cancelled) {
        void Promise.resolve(destroyRef.current(game, generation));
        return;
      }
      gameRef.current = game;

      const resizeToParent = () => {
        const node = parentRef.current;
        if (!node || !gameRef.current) return;
        const w = Math.floor(node.clientWidth);
        const h = Math.floor(node.clientHeight);
        if (w < 2 || h < 2) return;
        gameRef.current.scale.resize(w, h);
        onResizedRef.current?.(generation, w, h);
      };

      ro = new ResizeObserver(() => resizeToParent());
      ro.observe(el);
      resizeToParent();
      // Mobile/tablet: first layout may report 0×0; re-fit after paint.
      requestAnimationFrame(() => resizeToParent());
      setTimeout(resizeToParent, 50);
    };

    const boot = () => {
      const el = parentRef.current;
      if (cancelled || !el) return;
      start(el);
    };

    // Sync create when mutex is free (keeps GG-11 / host unit tests deterministic).
    // Only defer when a prior destroy is in flight.
    if (destroyMutexPending()) {
      void awaitDestroySettled().then(() => {
        if (!cancelled) boot();
      });
    } else {
      boot();
    }

    return () => {
      cancelled = true;
      ro?.disconnect();
      const gen = generation || generationRef.current;
      const game = gameRef.current;
      emitKernelObs("phaser-island-host", {
        event: "destroy",
        generation: gen
      });
      gameRef.current = null;
      readyRef.current = false;
      // Mutex + awaitDestroySettled serialize the next create (no second mutex).
      void Promise.resolve(destroyRef.current(game, gen));
      generationRef.current = 0;
    };
    // Mount-once island (GG-11): empty deps intentional.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { generationRef, readyRef, gameRef, notifyReady };
}

import { type ReactNode, useEffect, useRef } from "react";

const mountCounts = new Map<string, number>();

/**
 * GG-11's regression guard, shared by every stage. A stage's component
 * instance must never be recreated by a layer opening or closing over it —
 * if this counter moves past 1 during a run, the stage was unmounted rather
 * than layered over, and everything GG-11 promises (Phaser survives, scroll
 * and selection survive) is broken for it.
 */
export function useStageMountGuard(stageName: string): void {
  const countedRef = useRef(false);
  useEffect(() => {
    if (countedRef.current) return;
    countedRef.current = true;
    mountCounts.set(stageName, (mountCounts.get(stageName) ?? 0) + 1);
  }, [stageName]);
}

export function getStageMountCount(stageName: string): number {
  return mountCounts.get(stageName) ?? 0;
}

export function resetStageMountCounts(): void {
  mountCounts.clear();
}

/**
 * Band-0 wrapper (GG-5): the persistent base every layer opens over.
 */
export function StageHost({ children }: { children: ReactNode }) {
  return (
    <div data-testid="stage-host" className="band-stage relative h-full w-full">
      {children}
    </div>
  );
}

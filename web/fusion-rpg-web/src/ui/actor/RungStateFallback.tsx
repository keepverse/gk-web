import { cn } from "@/lib/cn";
import type { ActorRungState } from "./actorRungState";

/**
 * The three non-ready, non-empty-string states every rung shares — built
 * once so five rungs don't each invent their own loading/empty/error/locked
 * markup. Sized to roughly match the rung calling it; callers pass Tailwind
 * dimension classes.
 */
export function RungStateFallback({
  state,
  dimensionClass,
  label
}: {
  state: Exclude<ActorRungState, { kind: "ready" }>;
  dimensionClass: string;
  label?: string;
}) {
  const base = "flex items-center justify-center rounded-md border text-xs";
  switch (state.kind) {
    case "loading":
      return (
        <span
          data-testid={`actor-${label ?? "rung"}-loading`}
          aria-busy="true"
          className={cn(base, "animate-pulse border-transparent bg-panel-raised", dimensionClass)}
        />
      );
    case "empty":
      return (
        <span
          data-testid={`actor-${label ?? "rung"}-empty`}
          className={cn(base, "border-dashed border-border text-faint", dimensionClass)}
        >
          —
        </span>
      );
    case "error":
      return (
        <span
          data-testid={`actor-${label ?? "rung"}-error`}
          title={state.message}
          className={cn(base, "border-bad text-bad", dimensionClass)}
        >
          !
        </span>
      );
    case "locked":
      return (
        <span
          data-testid={`actor-${label ?? "rung"}-locked`}
          title={state.reason}
          className={cn(base, "border-border bg-panel-inset text-faint", dimensionClass)}
        >
          🔒
        </span>
      );
  }
}

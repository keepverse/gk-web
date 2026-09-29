import { cn } from "@/lib/cn";
import type { ActorRungState } from "./actorRungState";
import { RungStateFallback } from "./RungStateFallback";
import { ActorFrame, formatActorPhase, LevelTag, SideBadge, displayInitial } from "./shared";

/** Rung 3 — icon + name/side + level, one list row (roster, deploy pickers). */
export function ActorRow({ state }: { state: ActorRungState }) {
  if (state.kind !== "ready") {
    return <RungStateFallback state={state} dimensionClass="h-10 w-full rounded-md" label="row" />;
  }
  const { data } = state;
  const name = data.displayName.state === "known" ? data.displayName.value : `#${data.instanceId.slice(0, 6)}`;
  return (
    <div
      data-testid="actor-row"
      className={cn("flex min-w-0 items-center gap-3 border-b border-border px-3 py-2 last:border-b-0")}
    >
      <ActorFrame side={data.side} initial={displayInitial(data.displayName, data.side)} size="row" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-text" data-testid="actor-name">
          {name}
        </p>
        <p className="flex items-center gap-2 text-xs text-muted">
          <SideBadge side={data.side} />
          <span>{formatActorPhase(data.phase)}</span>
        </p>
      </div>
      <LevelTag level={data.level} />
    </div>
  );
}

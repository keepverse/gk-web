import { cn } from "@/lib/cn";
import type { ActorRungState } from "./actorRungState";
import { RungStateFallback } from "./RungStateFallback";
import { ActorFrame, LevelTag, displayInitial } from "./shared";

/** Rung 2 — icon + name + level, one line. */
export function ActorChip({ state }: { state: ActorRungState }) {
  if (state.kind !== "ready") {
    return <RungStateFallback state={state} dimensionClass="h-6 w-40 rounded-md" label="chip" />;
  }
  const { data } = state;
  const name = data.displayName.state === "known" ? data.displayName.value : `#${data.instanceId.slice(0, 6)}`;
  return (
    <span
      data-testid="actor-chip"
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-border bg-panel py-1 pl-1 pr-2 text-sm text-text"
      )}
    >
      <ActorFrame side={data.side} initial={displayInitial(data.displayName, data.side)} size="chip" />
      <span className="max-w-[16rem] truncate" data-testid="actor-name">
        {name}
      </span>
      <LevelTag level={data.level} />
    </span>
  );
}

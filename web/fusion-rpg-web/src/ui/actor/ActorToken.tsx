import type { ActorRungState } from "./actorRungState";
import { RungStateFallback } from "./RungStateFallback";
import { ActorFrame, displayInitial } from "./shared";

/** Rung 1 — smallest identity: an icon, nothing else. */
export function ActorToken({ state }: { state: ActorRungState }) {
  if (state.kind !== "ready") {
    return <RungStateFallback state={state} dimensionClass="h-5 w-5 rounded-full" label="token" />;
  }
  return (
    <ActorFrame
      testId="actor-token"
      side={state.data.side}
      initial={displayInitial(state.data.displayName, state.data.side)}
      size="token"
    />
  );
}

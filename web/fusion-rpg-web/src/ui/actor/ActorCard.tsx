import { Button } from "@/ui/Button";
import type { ActorRungState } from "./actorRungState";
import { RungStateFallback } from "./RungStateFallback";
import { ActorFrame, formatActorPhase, LevelTag, PendingNote, SideBadge, displayInitial } from "./shared";

/** Rung 4 — the lawn inspector / roster grid card: identity, standing, one primary action. */
export function ActorCard({
  state,
  onDeploy,
  onInspect
}: {
  state: ActorRungState;
  onDeploy?: () => void;
  onInspect?: () => void;
}) {
  if (state.kind !== "ready") {
    return <RungStateFallback state={state} dimensionClass="h-40 w-64 rounded-md" label="card" />;
  }
  const { data } = state;
  const name = data.displayName.state === "known" ? data.displayName.value : `#${data.instanceId.slice(0, 6)}`;
  return (
    <div
      data-testid="actor-card"
      className="flex w-64 flex-col gap-3 rounded-md border border-border bg-panel p-3 shadow-panel"
    >
      <div className="flex items-start gap-3">
        <ActorFrame side={data.side} initial={displayInitial(data.displayName, data.side)} size="card" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg text-text" data-testid="actor-name">
            {name}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
            <SideBadge side={data.side} />
            <LevelTag level={data.level} />
          </div>
        </div>
      </div>
      <div>
        <p className="text-2xs font-bold uppercase tracking-wide text-muted">Standing</p>
        <PendingNote pending={data.channelSummary} testId="actor-standing-pending" />
      </div>
      <div className="mt-auto flex items-center gap-2 border-t border-border pt-2">
        <span className="text-xs text-muted" data-testid="actor-phase">
          {formatActorPhase(data.phase)}
        </span>
        <span className="flex-1" />
        {onInspect ? (
          <Button size="sm" variant="ghost" onClick={onInspect} data-testid="actor-card-inspect">
            Inspect
          </Button>
        ) : null}
        {onDeploy ? (
          <Button size="sm" onClick={onDeploy} data-testid="actor-card-deploy">
            Deploy
          </Button>
        ) : null}
      </div>
    </div>
  );
}

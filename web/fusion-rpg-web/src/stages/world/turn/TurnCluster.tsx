import { useEffect, useState } from "react";
import type { LegionView } from "@/contract/types";
import { toRequests, type PendingOrder } from "@/stages/world/worldSelection";
import { useCommitWorldTurn, useSubmitWorldCommands } from "@/lib/bus/world";
import { unresolvedLegions } from "./unresolvedLegions";
import { FORCE_END_KEYBOARD_BLOCKED_REASON } from "./forceEnd";

export type TurnClusterProps = {
  worldId: string;
  currentTurn: number;
  commanderId: string;
  legions: readonly LegionView[];
  pending: readonly PendingOrder[];
  onOrdersFiled: () => void;
  /** Named blockers for the day `HARD_BLOCKING_EVENTS` (W81) actually produces one. Always empty
   * in shipped play today — the prop exists so this component's hard-blocked state is real,
   * testable code rather than a branch nothing ever proves. */
  blockers?: readonly { sentence: string; navigate: () => void }[];
};

/**
 * world-stage W79 (spec-world-turn.md §1) — End Turn in its four states, plus §5's file-orders as
 * the fifth cluster member. Mounts at `world-hud`'s bottom-right anchor.
 *
 * GG-15 end to end: acknowledge instantly, paint authority never. Filing orders shows an
 * acknowledged-but-not-filed state until the server accepts them; ending the turn stays in
 * "Committed — waiting" until the response actually reports `advanced` — never a local timer,
 * never an optimistic advance.
 */
export function TurnCluster({
  worldId,
  currentTurn,
  commanderId,
  legions,
  pending,
  onOrdersFiled,
  blockers = []
}: TurnClusterProps) {
  const [endTurnAnyway, setEndTurnAnyway] = useState(false);

  // The nag is scoped to the turn it appeared in — pushing through it once must not silence every
  // later turn's own nag, so a fresh `currentTurn` clears it.
  useEffect(() => setEndTurnAnyway(false), [currentTurn]);

  const submit = useSubmitWorldCommands(worldId);
  const commit = useCommitWorldTurn(worldId);

  const unresolved = unresolvedLegions(legions, pending);

  async function fileOrders() {
    if (pending.length === 0) return;
    await submit.mutateAsync({ commanderId, commands: toRequests([...pending]) });
    onOrdersFiled();
  }

  function endTurn() {
    commit.mutate({ turn: currentTurn, commanderId });
  }

  let body: React.ReactNode;

  if (commit.isPending || (commit.isSuccess && !commit.data.advanced)) {
    body = (
      <p data-testid="turn-cluster-state" data-turn-state="committed">
        Waiting on other commanders · no deadline · the map stays live
      </p>
    );
  } else if (blockers.length > 0) {
    const blocker = blockers[0]!;
    body = (
      <div data-testid="turn-cluster-state" data-turn-state="hard-blocked">
        <p>{blocker.sentence}</p>
        <button type="button" onClick={blocker.navigate}>
          Take me there
        </button>
        {/* world-stage W83: the force-end hatch — reachable by pointer only. No keyboard binding is
            registered here on purpose; see forceEnd.ts's own FORCE_END_KEYBOARD_BLOCKED_REASON
            (useGlobalKeys.ts:25 carries no modifier state, so Shift+Enter is not yet expressible). */}
        <button type="button" data-testid="turn-cluster-force-end" title={FORCE_END_KEYBOARD_BLOCKED_REASON} onClick={endTurn}>
          End anyway
        </button>
      </div>
    );
  } else if (unresolved.length > 0 && !endTurnAnyway) {
    body = (
      <div data-testid="turn-cluster-state" data-turn-state="nag">
        <p>
          {unresolved.length} legion{unresolved.length === 1 ? "" : "s"} with moves left and no orders
        </p>
        <button
          type="button"
          onClick={() => {
            setEndTurnAnyway(true);
            endTurn();
          }}
        >
          End turn anyway
        </button>
      </div>
    );
  } else {
    body = (
      <div data-testid="turn-cluster-state" data-turn-state="ready">
        <p>0 legions waiting on you</p>
        <button type="button" onClick={endTurn}>
          End turn
        </button>
      </div>
    );
  }

  return (
    <div data-testid="turn-cluster" className="pointer-events-auto">
      {pending.length > 0 ? (
        submit.isPending ? (
          // GG-15: acknowledge instantly, paint authority never — this reads as "sent," never as
          // "filed," until the server actually accepts it (`onOrdersFiled`, on success, is what
          // clears `pending` and makes this whole block disappear).
          <p data-testid="turn-cluster-file-orders-acknowledged">
            Filing {pending.length} order{pending.length === 1 ? "" : "s"}…
          </p>
        ) : (
          <button type="button" data-testid="turn-cluster-file-orders" onClick={() => void fileOrders()}>
            File {pending.length} order{pending.length === 1 ? "" : "s"}
          </button>
        )
      ) : null}
      {body}
    </div>
  );
}

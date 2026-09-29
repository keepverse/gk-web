import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useUniqueActors } from "@/lib/bus";
import { adaptActor } from "@/contract/adapt";
import { Page } from "@/layouts/Page";
import mockActorFixture from "../../../e2e/fixtures/unique-actor.json";
import { ActorCard, ActorChip, ActorPanel, ActorRow, ActorToken, type ActorRungState } from "./index";

/**
 * Derived from `adaptActor`'s own parameter rather than importing
 * `UniqueActorDto` here — `ui/` binds to the contract, never to a REST DTO
 * type (T4's guard), and this page is the one place a raw fixture needs the
 * shape at all.
 */
type ActorDtoShape = Parameters<typeof adaptActor>[0];

/**
 * Temporary proof surface for the Actor ladder (T8) — the same role
 * `LawnStage`'s "Board panel" button played for T2. Not a designed player
 * surface; T9/T10 give the ladder its real home (Sanctum rail, Creatures
 * layer) and this page is swept into or replaced by that work.
 */
export function ActorLadderDemoPage() {
  const [searchParams] = useSearchParams();
  const query = useUniqueActors(1);
  const [panelOpen, setPanelOpen] = useState(false);

  // ?mock=1 renders against the shared server fixture (T5) instead of a live query — for
  // visual/E2E verification without a running server. Not a shipped feature.
  const useMock = searchParams.get("mock") === "1";
  const sel = searchParams.get("sel");

  const state: ActorRungState = useMock
    ? { kind: "ready", data: adaptActor(mockActorFixture as ActorDtoShape) }
    : query.isLoading
      ? { kind: "loading" }
      : query.isError
        ? { kind: "error", message: "Could not load actors" }
        : !query.data || query.data.items.length === 0
          ? { kind: "empty" }
          : (() => {
              const items = query.data.items;
              const picked = sel
                ? items.find((a) => a.instanceId === sel) ?? items[0]!
                : items[0]!;
              return { kind: "ready" as const, data: adaptActor(picked) };
            })();

  return (
    <Page title="Actor ladder" description="Five presentation sizes, one creature contract." testId="page-actor-ladder-demo">
      <div className="flex flex-col gap-6">
        <section>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-faint">Rung 1 — token</p>
          <ActorToken state={state} />
        </section>
        <section>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-faint">Rung 2 — chip</p>
          <ActorChip state={state} />
        </section>
        <section>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-faint">Rung 3 — row</p>
          <div className="max-w-sm rounded-md border border-border">
            <ActorRow state={state} />
          </div>
        </section>
        <section>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-faint">Rung 4 — card</p>
          <ActorCard state={state} onInspect={() => setPanelOpen(true)} onDeploy={() => {}} />
        </section>
        <section>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-faint">Rung 5 — panel</p>
          <button
            type="button"
            className="rounded-sm border border-border-control px-3 py-1 text-sm text-text"
            data-testid="actor-ladder-open-panel"
            onClick={() => setPanelOpen(true)}
          >
            Open panel
          </button>
          <ActorPanel state={state} open={panelOpen} onOpenChange={setPanelOpen} />
        </section>
      </div>
    </Page>
  );
}

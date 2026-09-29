import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTypes, useUniqueActors } from "@/lib/bus";
import { adaptActor } from "@/contract/adapt";
import { Page } from "@/layouts/Page";
import { JsonBlock } from "@/ui";
import type { ActorRungState } from "@/ui/actor";
import mockActorFixture from "../../../e2e/fixtures/unique-actor.json";
import {
  ActorMenuScopePicker,
  type ScopePickerValue,
  type ScopeTargetCandidate
} from "./ActorMenuScopePicker";

type ActorDtoShape = Parameters<typeof adaptActor>[0];

/**
 * Proof surface for the actor-menu scope picker (fe-essentials T6) — the same role
 * `ActorLadderDemoPage.tsx` played for the Actor ladder itself. Not a designed player surface: the
 * commander/aura-skill feature that will actually consume this picker is still explicitly deferred
 * (buff-debuff-scope-ideal.md §5), so this page exists to prove the component works end to end ahead
 * of that feature, the same way the Actor ladder shipped ahead of Creatures/Sanctum.
 *
 * UniqueCreature candidates come from the roster (instanceId). Target candidates must carry an
 * explicit board/world targetPtr — demo uses a synthetic ptr, never the specimen instanceId.
 */
export function ActorMenuScopePickerDemoPage() {
  const [searchParams] = useSearchParams();
  const useMock = searchParams.get("mock") === "1";

  const actorsQuery = useUniqueActors(1);
  const typesQuery = useTypes();
  const [value, setValue] = useState<ScopePickerValue | null>(null);

  const uniqueCandidates: ActorRungState[] = useMock
    ? [{ kind: "ready", data: adaptActor(mockActorFixture as ActorDtoShape) }]
    : actorsQuery.isLoading
      ? [{ kind: "loading" }]
      : actorsQuery.isError
        ? [{ kind: "error", message: "Could not load actors" }]
        : !actorsQuery.data || actorsQuery.data.items.length === 0
          ? [{ kind: "empty" }]
          : actorsQuery.data.items.map((item) => ({ kind: "ready" as const, data: adaptActor(item) }));

  const targetCandidates: ScopeTargetCandidate[] = [];
  for (const c of uniqueCandidates) {
    switch (c.kind) {
      case "ready":
        // Explicit ptr — never reuse instanceId as targetPtr.
        targetCandidates.push({
          kind: "ready",
          targetPtr: `P:${c.data.typeId}:0,0`,
          rungState: c
        });
        break;
      case "loading":
      case "empty":
        targetCandidates.push({ kind: c.kind });
        break;
      case "error":
        targetCandidates.push({ kind: "error", message: c.message });
        break;
      case "locked":
        targetCandidates.push({ kind: "error", message: c.reason });
        break;
    }
  }

  const typeOptions = (typesQuery.data ?? []).map((t) => ({
    typeId: t.type,
    label: t.displayName ?? t.typeName ?? `Type #${t.type}`
  }));

  return (
    <Page
      title="Actor menu — scope picker"
      description="Pick a target by side, type, or named creature."
      testId="page-actor-menu-scope-picker-demo"
    >
      <div className="flex flex-col gap-4">
        <ActorMenuScopePicker
          value={value}
          onChange={setValue}
          targetCandidates={targetCandidates}
          uniqueCreatureCandidates={uniqueCandidates}
          typeOptions={typeOptions}
        />
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-faint">Current value</p>
          <div data-testid="scope-picker-demo-value">
            <JsonBlock value={value} />
          </div>
        </div>
      </div>
    </Page>
  );
}

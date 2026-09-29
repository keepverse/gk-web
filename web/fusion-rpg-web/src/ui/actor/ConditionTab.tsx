import { useEffect, useMemo, useRef, useState } from "react";
import type { ActorView } from "@/contract/types";
import type { ActorSurfaceCatalog, ActorSheetDto } from "@/contract/actorSurface";
import { bindSurface } from "@/features/gui-lego/bindSurface";
import { createConditionSurfaceBus } from "@/features/gui-lego/conditionSurfaceBus";
import { asSurfaceBusLike } from "@/features/gui-lego/createSurfaceBus";
import { foldConditionSurfaceVm } from "@/features/gui-lego/foldConditionSurfaceVm";
import { getRecipe } from "@/features/gui-lego/recipeRegistry";
import { RecipeMount } from "@/ui/gui-lego/RecipeMount";
import { ensureConditionGuiLegoRegistered } from "@/ui/gui-lego/registerCondition";
import "@/ui/gui-lego/conditionConsole.css";

/**
 * Condition glance — GUI Lego host. Identity stays in the shell summarize.
 * Progressive enrichment: ActorView fills the glance while /sheet loads; sheet error keeps the glance
 * and shows a compact retry strip (never a full-surface swap).
 * Glance body is RecipeMount-only (CG-D2) — no hand-built twin path.
 */
export function ConditionTab({
  data,
  surface,
  sheet,
  sheetError = false,
  onRetry,
  onOpenStatusTab
}: {
  data: ActorView;
  surface: ActorSurfaceCatalog;
  sheet?: ActorSheetDto | null;
  sheetError?: boolean;
  onRetry?: () => void;
  onOpenStatusTab?: () => void;
}) {
  ensureConditionGuiLegoRegistered();
  const [selectedPoolId, setSelectedPoolId] = useState<string | null>("hp");
  const revisionRef = useRef(0);
  const typedBus = useMemo(() => createConditionSurfaceBus(), []);
  const bus = useMemo(() => asSurfaceBusLike(typedBus), [typedBus]);

  useEffect(() => {
    const offs = [
      typedBus.on("condition.pool.select", (p) => {
        const id = (p as { poolId?: string })?.poolId;
        if (typeof id === "string") setSelectedPoolId(id);
      }),
      typedBus.on("condition.status.open", () => onOpenStatusTab?.()),
      typedBus.on("condition.retry", () => onRetry?.())
    ];
    return () => offs.forEach((off) => off());
  }, [typedBus, onOpenStatusTab, onRetry]);

  // Q5 — host bumps revision when sheet/selection changes; pieces animate on stamp.
  const revision = useMemo(() => {
    revisionRef.current += 1;
    return revisionRef.current;
  }, [data, sheet, surface, selectedPoolId]);

  const vm = useMemo(
    () =>
      foldConditionSurfaceVm({
        data,
        sheet,
        surface,
        selectedPoolId,
        availability: "ready",
        revision
      }),
    [data, sheet, surface, selectedPoolId, revision]
  );
  const recipe = getRecipe("condition-console");
  const plan = useMemo(
    () => (recipe ? bindSurface(recipe, vm, { preferOverlay: false }) : null),
    [recipe, vm]
  );
  if (!plan) return <p className="rd">Condition recipe not registered.</p>;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col" data-testid="condition-tab-host">
      {sheetError ? (
        <div className="condition-sheet-retry" data-testid="condition-sheet-retry">
          <span>Sheet enrichment failed — glance still shows ActorView data.</span>
          <button type="button" data-testid="condition-sheet-retry-button" onClick={() => typedBus.emit("condition.retry", {})}>
            Retry
          </button>
        </div>
      ) : null}
      <RecipeMount plan={plan} bus={bus} />
    </div>
  );
}

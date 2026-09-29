import { useEffect, useMemo, useRef, useState } from "react";
import type { ActorView } from "@/contract/types";
import { actorSurfaceCatalogNow } from "@/lib/bus/actorSurface";
import type { ActorSheetDto } from "@/contract/actorSurface";
import { bindSurface } from "@/features/gui-lego/bindSurface";
import { asSurfaceBusLike } from "@/features/gui-lego/createSurfaceBus";
import { foldShieldSurfaceVm } from "@/features/gui-lego/foldShieldSurfaceVm";
import { getRecipe } from "@/features/gui-lego/recipeRegistry";
import { createShieldSurfaceBus } from "@/features/gui-lego/shieldSurfaceBus";
import { RecipeMount } from "@/ui/gui-lego/RecipeMount";
import { ensureShieldGuiLegoRegistered } from "@/ui/gui-lego/registerShield";
import "@/ui/gui-lego/shieldConsole.css";
import "@/ui/gui-lego/derivedConsole.css";

/**
 * Shield tab — thin GUI Lego host. Layers from sheet.shieldLayers (S1).
 * No permanent “Empty layer” wells; noun is Shield only.
 */
export function ShieldTab({
  data,
  sheet,
  sheetError = false,
  onRetry
}: {
  data: ActorView;
  sheet?: ActorSheetDto | null;
  sheetError?: boolean;
  onRetry?: () => void;
}) {
  ensureShieldGuiLegoRegistered();
  const surface = actorSurfaceCatalogNow();
  const [selectedShieldId, setSelectedShieldId] = useState<string | null>(null);
  const revisionRef = useRef(0);
  const typedBus = useMemo(() => createShieldSurfaceBus(), []);
  const bus = useMemo(() => asSurfaceBusLike(typedBus), [typedBus]);

  useEffect(() => {
    const offs = [
      typedBus.on("shield.layer.select", (p) => {
        const id = (p as { shieldId?: string })?.shieldId;
        if (typeof id === "string") setSelectedShieldId(id);
      }),
      typedBus.on("shield.retry", () => onRetry?.())
    ];
    return () => offs.forEach((off) => off());
  }, [typedBus, onRetry]);

  // Missing sheet → Pending (not three Empty wells). Hot empty is sheet with [].
  const availability = sheet != null ? "ready" : "pending";

  const vm = useMemo(() => {
    revisionRef.current += 1;
    return foldShieldSurfaceVm({
      layers: sheet?.shieldLayers ?? [],
      summary: sheet?.shieldSummary ?? null,
      omniChannels: sheet?.derived ?? [],
      families: surface.families,
      availability,
      selectedShieldId,
      revision: revisionRef.current
    });
  }, [sheet, surface.families, availability, selectedShieldId]);

  const recipe = getRecipe("shield-console");
  const plan = useMemo(
    () => (recipe ? bindSurface(recipe, vm, { preferOverlay: false }) : null),
    [recipe, vm]
  );

  if (!plan) {
    return (
      <div className="mt-4" data-testid="shield-tab">
        <p className="rd">Shield recipe not registered.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col" data-testid="shield-tab">
      {sheetError ? (
        <div className="mb-2 flex items-center gap-2 text-xs text-muted" data-testid="shield-sheet-retry">
          <span>Sheet enrichment failed — shield stack still pending.</span>
          <button
            type="button"
            data-testid="shield-sheet-retry-button"
            onClick={() => typedBus.emit("shield.retry", {})}
          >
            Retry
          </button>
        </div>
      ) : null}
      <RecipeMount plan={plan} bus={bus} />
      <span className="sr-only">{data.instanceId}</span>
    </div>
  );
}

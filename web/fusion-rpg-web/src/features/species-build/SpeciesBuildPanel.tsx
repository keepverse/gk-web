import { useEffect, useMemo, useRef, useState } from "react";
import { actorSurfaceFixture } from "@/lib/bus/actorSurface";
import { probeAptitudePresetsApi, useAptitudePresetActive } from "@/lib/bus/aptitudePresets";
import { useAllocationDraft } from "@/hooks/useAllocationDraft";
import { bindSurface } from "@/features/gui-lego/bindSurface";
import { asSurfaceBusLike } from "@/features/gui-lego/createSurfaceBus";
import { createAptitudesSurfaceBus } from "@/features/gui-lego/aptitudesSurfaceBus";
import { foldAptitudesSurfaceVm } from "@/features/gui-lego/foldAptitudesSurfaceVm";
import { getRecipe } from "@/features/gui-lego/recipeRegistry";
import { runAutoAssign } from "@/features/aptitudes/runAutoAssign";
import { AptitudePresetConsoleHost } from "@/features/aptitudes/AptitudePresetConsoleHost";
import { Banner, Button, EmptyState } from "@/ui";
import { RecipeMount } from "@/ui/gui-lego/RecipeMount";
import { ensureAptitudesGuiLegoRegistered } from "@/ui/gui-lego/registerAptitudes";
import { useToastStack } from "@/shell/toastStack";
import { emitAptitudeObs } from "@/ui/actor/aptitudeObs";
import { useSpeciesBuild } from "./useSpeciesBuild";

/**
 * Mode B species host — aptitudes-console. ConfirmDialog retired (S2);
 * price on species-build-chrome + decision strip; Confirm commits draft.
 */
export function SpeciesBuildPanel({ playerId, speciesId }: { playerId: number; speciesId: string }) {
  ensureAptitudesGuiLegoRegistered();
  const surface = actorSurfaceFixture();
  const pushToast = useToastStack((s) => s.push);
  const { state, price, respec, save } = useSpeciesBuild(playerId, speciesId);
  // respec-free-counter EP4.12: the payment choice, UNDEFINED until the player makes it. There is no
  // default on purpose — the two options are not interchangeable, and the server refuses an ambiguous
  // request while a free respec is available.
  const [payWith, setPayWith] = useState<"souls" | "freeRespec" | undefined>(undefined);
  const freeAvailable = Boolean(price.data?.freeAvailable);
  const freeRespecStock = price.data?.freeRespecStock ?? 0;

  const [serverShares, setServerShares] = useState<Record<string, number> | undefined>(undefined);
  const [hasOverride, setHasOverride] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(surface.aptitudes[0]?.id ?? null);
  const [presetOpen, setPresetOpen] = useState(false);
  const revisionRef = useRef(0);
  const typedBus = useMemo(() => createAptitudesSurfaceBus(), []);
  const bus = useMemo(() => asSurfaceBusLike(typedBus), [typedBus]);
  const activePreset = useAptitudePresetActive(playerId, "species", speciesId);
  const activePresetName = activePreset.data?.presetId
    ? activePreset.data.presetId.slice(0, 8)
    : null;

  useEffect(() => {
    setServerShares(undefined);
  }, [speciesId]);

  useEffect(() => {
    if (state.data && serverShares === undefined) {
      setServerShares(state.data.shares);
      setHasOverride(state.data.hasOverride);
    }
  }, [state.data, serverShares]);

  const budget = state.data?.budget ?? 0;
  const allocationRef = useRef<ReturnType<typeof useAllocationDraft> | null>(null);

  const allocation = useAllocationDraft({
    serverValues: serverShares,
    budget,
    isSaving: respec.isPending,
    onSave: async (draft) => {
      emitAptitudeObs("aptitude.confirm", { mode: "species", speciesId, playerId });
      const result = await save(draft, payWith);
      setServerShares(result.shares);
      // All-zero post is a revert (override cleared); non-zero shares become the empire override.
      setHasOverride(Object.values(draft).some((v) => (Number(v) || 0) !== 0));
      allocationRef.current?.acceptCommitted(result.shares);
    }
  });
  allocationRef.current = allocation;

  useEffect(() => {
    const offs = [
      typedBus.on("aptitude.select", (p) => {
        const id = (p as { aptitudeId?: string })?.aptitudeId;
        if (typeof id === "string") setSelectedId(id);
      }),
      typedBus.on("aptitude.step", (p) => {
        const id = (p as { aptitudeId?: string })?.aptitudeId;
        const delta = (p as { delta?: number })?.delta ?? 0;
        const alloc = allocationRef.current;
        if (typeof id !== "string" || !alloc?.draft) return;
        const cur = alloc.draft[id] ?? 0;
        alloc.setValue(id, cur + delta);
      }),
      typedBus.on("aptitude.set", (p) => {
        const id = (p as { aptitudeId?: string })?.aptitudeId;
        const value = (p as { value?: number })?.value;
        if (typeof id !== "string" || typeof value !== "number") return;
        allocationRef.current?.setValue(id, value);
      }),
      typedBus.on("aptitude.reset", () => {
        emitAptitudeObs("aptitude.reset", { mode: "species", speciesId });
        allocationRef.current?.revert();
      }),
      typedBus.on("aptitude.confirm", () => {
        void allocationRef.current?.save();
      }),
      typedBus.on("preset.open", () => {
        void (async () => {
          emitAptitudeObs("preset.open", { mode: "species", speciesId, playerId });
          const ok = await probeAptitudePresetsApi(playerId);
          if (!ok) {
            emitAptitudeObs("preset.open.unavailable", {
              mode: "species",
              reason: "presets.api.missing"
            });
            pushToast({
              tone: "warn",
              title: "Aptitude presets unavailable",
              message: "The presets API is not reachable — start the server or retry."
            });
            return;
          }
          emitAptitudeObs("preset.open.opened", { mode: "species" });
          setPresetOpen(true);
        })();
      }),
      typedBus.on("aptitude.autoAssign", (p) => {
        const rule = (p as { rule?: string })?.rule ?? "even";
        void (async () => {
          emitAptitudeObs("aptitude.autoAssign", { mode: "species", rule, speciesId });
          const alloc = allocationRef.current;
          if (!alloc?.draft) return;
          const result = await runAutoAssign({
            rule,
            budget,
            mode: "species",
            playerId,
            speciesId,
            scopeKey: speciesId,
            setValue: (id, next) => alloc.setValue(id, next)
          });
          if (!result.ok) {
            emitAptitudeObs("aptitude.autoAssign.refused", {
              mode: "species",
              rule,
              reason: result.reason
            });
            if (
              result.reason === "autoAssign.favour.empty" ||
              result.reason === "autoAssign.favour.incomplete"
            ) {
              pushToast({
                tone: "warn",
                title: "No species favour",
                message: "Favour seed is empty — try Even instead."
              });
            } else {
              pushToast({
                tone: "warn",
                title: "Auto-assign refused",
                message: result.reason
              });
            }
            return;
          }
          emitAptitudeObs("aptitude.autoAssign.applied", {
            mode: "species",
            rule,
            leftover: result.leftover
          });
        })();
      })
    ];
    return () => offs.forEach((off) => off());
  }, [typedBus, speciesId, playerId, budget, pushToast]);

  if (state.isError) {
    return (
      <Banner tone="error" data-testid="species-build-error">
        Couldn&apos;t load this species&apos; build.
        <Button size="sm" variant="ghost" className="ml-2" onClick={() => void state.refetch()}>
          Retry
        </Button>
      </Banner>
    );
  }

  if (state.isLoading || !state.data || allocation.draft === null || serverShares === undefined) {
    return <EmptyState title="Loading species build…" testId="species-build-loading" />;
  }

  const data = state.data;
  const noBudgetYet = data.budget === 0 && !hasOverride;
  const dirty = allocation.dirty;
  const isRevert = dirty && Object.values(allocation.draft).every((v) => v === 0);
  const isFree = isRevert || (price.data !== undefined && !price.data.everRespecced);
  // G7: pending/errored price must not look free — Confirm stays disabled until price resolves.
  const priceReady = isFree || price.data !== undefined;
  const choiceRequired = !isFree && freeAvailable && payWith === undefined;
  const confirmEnabled =
    dirty && allocation.withinBudget && !respec.isPending && priceReady && !(noBudgetYet && !dirty) && !choiceRequired;

  const statusMessage = noBudgetYet
    ? "This species hasn't grown a build yet — field it in a real match to earn aptitude points."
    : hasOverride
      ? "You've overridden the shipped build below."
      : "You're running the shipped build.";

  revisionRef.current += 1;
  const vm = foldAptitudesSurfaceVm({
    mode: "species",
    surface,
    draftShares: allocation.draft,
    budget,
    spent: allocation.spent,
    leftover: budget - allocation.spent,
    dirty,
    withinBudget: confirmEnabled,
    saving: respec.isPending,
    selectedAptitudeId: selectedId,
    theta: data.level,
    activePresetName,
    speciesChrome: {
      hasOverride,
      priceAmount: price.data?.priceAmount ?? 0,
      priceResource: price.data?.priceResource ?? "Soul",
      everRespecced: Boolean(price.data?.everRespecced)
    },
    availability: "ready",
    revision: revisionRef.current
  });

  if (vm.speciesChrome) {
    vm.speciesChrome.statusMessage = statusMessage;
    if (noBudgetYet) {
      vm.speciesChrome.priceAmount = null;
      vm.speciesChrome.priceResource = null;
    }
  }

  const recipe = getRecipe("aptitudes-console");
  const plan = recipe ? bindSurface(recipe, vm, { preferOverlay: false }) : null;

  if (!plan) {
    return <EmptyState title="Aptitudes recipe missing" testId="species-build-loading" />;
  }

  const activatePriceLabel =
    !isFree && price.data
      ? `Activate costs ${price.data.priceAmount} ${price.data.priceResource}`
      : isFree
        ? "First Activate / Confirm is free"
        : null;

  return (
    <div className="flex flex-col gap-3" data-testid="species-build-panel">
      {allocation.error ? <Banner tone="error">{allocation.error}</Banner> : null}
      {noBudgetYet && !dirty ? (
        <p className="text-xs text-muted" data-testid="species-build-save-reason">
          This species hasn&apos;t earned any aptitude points yet — nothing to save.
        </p>
      ) : null}
      {!isFree && price.data === undefined ? (
        <p className="text-xs text-muted" data-testid="species-build-save-reason">
          {price.isError
            ? "Couldn't load the respec price — try again shortly"
            : "Waiting for the respec price…"}
        </p>
      ) : null}
      {!isFree && freeAvailable && dirty ? (
        <div className="flex flex-col gap-1" data-testid="species-build-pay-with">
          <p className="text-xs text-muted">
            This change can be paid either way — spend one of your {freeRespecStock} free empire
            respec{freeRespecStock === 1 ? "" : "s"}, or pay souls.
          </p>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="radio"
              name="pay-with"
              data-testid="pay-with-free"
              checked={payWith === "freeRespec"}
              onChange={() => setPayWith("freeRespec")}
            />
            Spend a free respec ({freeRespecStock} left)
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="radio"
              name="pay-with"
              data-testid="pay-with-souls"
              checked={payWith === "souls"}
              onChange={() => setPayWith("souls")}
            />
            {price.data
              ? `Pay ${price.data.priceAmount} ${price.data.priceResource}`
              : "Pay souls"}
          </label>
        </div>
      ) : null}
      {!allocation.withinBudget && dirty ? (
        <p className="text-xs text-muted" data-testid="species-build-save-reason">
          Over this species&apos; budget — Confirm stays off until spent fits.
        </p>
      ) : null}
      <RecipeMount plan={plan} bus={bus} />
      {presetOpen ? (
        <AptitudePresetConsoleHost
          open={presetOpen}
          onOpenChange={setPresetOpen}
          mode="species"
          playerId={playerId}
          scopeKey={speciesId}
          speciesId={speciesId}
          budget={budget}
          surface={surface}
          activatePriceLabel={activatePriceLabel}
          onApplyDraft={(shares) => {
            const alloc = allocationRef.current;
            if (!alloc?.draft) return;
            for (const [id, v] of Object.entries(shares)) {
              alloc.setValue(id, v);
            }
          }}
          onActivated={(shares) => {
            setServerShares(shares);
            setHasOverride(Object.values(shares).some((v) => (Number(v) || 0) !== 0));
            allocationRef.current?.acceptCommitted(shares);
          }}
        />
      ) : null}
    </div>
  );
}

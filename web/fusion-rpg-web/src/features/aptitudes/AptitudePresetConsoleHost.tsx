import { useEffect, useMemo, useRef, useState } from "react";
import {
  evenPermilleRows,
  permilleMapToRows,
  sumTargetPermille
} from "@/features/aptitudes/evenPermille";
import { bindSurface } from "@/features/gui-lego/bindSurface";
import { asSurfaceBusLike } from "@/features/gui-lego/createSurfaceBus";
import { foldPresetConsoleVm } from "@/features/gui-lego/foldPresetConsoleVm";
import { createPresetConsoleBus } from "@/features/gui-lego/presetConsoleBus";
import { getRecipe } from "@/features/gui-lego/recipeRegistry";
import type { ActorSurfaceCatalog } from "@/lib/bus/actorSurface";
import {
  fetchAptitudePresetFavour,
  materializeAptitudePreset,
  useActivateAptitudePreset,
  useAptitudePresetActive,
  useAptitudePresets,
  useDeleteAptitudePreset,
  useSaveAptitudePreset,
  useUpdateAptitudePreset,
  type AptitudePresetRow
} from "@/lib/bus/aptitudePresets";
import { PanelShell } from "@/shell/PanelShell";
import { useToastStack } from "@/shell/toastStack";
import { Banner, EmptyState } from "@/ui";
import { emitAptitudeObs } from "@/ui/actor/aptitudeObs";
import { RecipeMount } from "@/ui/gui-lego/RecipeMount";
import { ensureAptitudesGuiLegoRegistered } from "@/ui/gui-lego/registerAptitudes";
import { presetActionStripFactory } from "@/ui/gui-lego/pieces/aptitude";

export type AptitudePresetConsoleMode = "unique" | "commander" | "species";

export type AptitudePresetConsoleHostProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: AptitudePresetConsoleMode;
  playerId: number;
  /** Unique instanceId or speciesId; empty for commander. */
  scopeKey: string;
  speciesId?: string | null;
  budget: number;
  surface: ActorSurfaceCatalog;
  /** Apply-to-draft — dirties parent allocate draft only. */
  onApplyDraft: (shares: Record<string, number>) => void;
  /** After Activate txn — parent should acceptCommitted / invalidate. */
  onActivated: (shares: Record<string, number>) => void;
  /** Mode B price line before Activate (S2/G13c). */
  activatePriceLabel?: string | null;
};

function cloneRows(rows: AptitudePresetRow[]): AptitudePresetRow[] {
  return rows.map((r) => ({ ...r }));
}

/**
 * Nested Aptitude presets console (AS-3.4). Depth: stage → sheet/layer → this PanelShell ≤ 3.
 * Renamed from "Build presets" (build-preset BP3.4, map X1) once that name was needed for the
 * new, broader build-preset console (patron + field + skills + gear + aptitudes) -- this console
 * only ever managed the aptitude-allocation library.
 * Pieces never fetch; host owns CRUD + Activate API (S3).
 */
export function AptitudePresetConsoleHost({
  open,
  onOpenChange,
  mode,
  playerId,
  scopeKey,
  speciesId,
  budget,
  surface,
  onApplyDraft,
  onActivated,
  activatePriceLabel
}: AptitudePresetConsoleHostProps) {
  ensureAptitudesGuiLegoRegistered();
  const pushToast = useToastStack((s) => s.push);
  const presetsQ = useAptitudePresets(open ? playerId : null);
  const scope = mode === "unique" ? "unique" : mode === "species" ? "species" : "commander";
  const activeQ = useAptitudePresetActive(open ? playerId : null, scope, scopeKey);
  const saveMut = useSaveAptitudePreset();
  const updateMut = useUpdateAptitudePreset();
  const deleteMut = useDeleteAptitudePreset();
  const activateMut = useActivateAptitudePreset();

  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [editorName, setEditorName] = useState("New preset");
  const [editorRows, setEditorRows] = useState<AptitudePresetRow[]>(() => evenPermilleRows());
  const [isNew, setIsNew] = useState(true);
  const revisionRef = useRef(0);
  const typedBus = useMemo(() => createPresetConsoleBus(), []);
  const bus = useMemo(() => asSurfaceBusLike(typedBus), [typedBus]);

  const displayNames = useMemo(() => {
    const m: Record<string, string> = {};
    for (const row of surface.aptitudes) m[row.id] = row.displayName ?? row.id;
    return m;
  }, [surface.aptitudes]);

  const preview = useMemo(() => {
    const shares: Record<string, number> = {};
    let spent = 0;
    for (const row of editorRows) {
      const pm = Math.trunc(Number(row.targetPermille) || 0);
      const share = Math.trunc((budget * pm) / 1000);
      shares[row.aptitudeId] = share;
      spent += share;
    }
    return { shares, leftover: budget - spent };
  }, [editorRows, budget]);

  function loadPreset(presetId: string) {
    const p = presetsQ.data?.find((x) => x.presetId === presetId);
    if (!p) return;
    setSelectedPresetId(presetId);
    setEditorName(p.name);
    setEditorRows(cloneRows(p.rows ?? evenPermilleRows()));
    setIsNew(false);
    emitAptitudeObs("preset.select", { mode, presetId });
  }

  async function seedNew() {
    setSelectedPresetId(null);
    setIsNew(true);
    setEditorName("New preset");
    emitAptitudeObs("preset.new", { mode, speciesId: speciesId ?? null });
    if ((mode === "unique" || mode === "species") && speciesId) {
      try {
        const favour = await fetchAptitudePresetFavour(speciesId);
        if (Object.keys(favour).length === 0) {
          emitAptitudeObs("preset.new.favour.empty", { mode, speciesId });
          pushToast({
            tone: "warn",
            title: "No species favour",
            message: "Favour seed is empty — using Even distribution."
          });
          setEditorRows(evenPermilleRows());
          return;
        }
        setEditorRows(permilleMapToRows(favour));
        setEditorName(`${speciesId} favour`);
        return;
      } catch (e) {
        emitAptitudeObs("preset.new.favour.error", {
          mode,
          reason: e instanceof Error ? e.message : "unknown"
        });
      }
    }
    setEditorRows(evenPermilleRows());
  }

  useEffect(() => {
    if (!open) return;
    void seedNew();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, speciesId]);

  useEffect(() => {
    const offs = [
      typedBus.on("preset.close", () => {
        emitAptitudeObs("preset.close", { mode });
        onOpenChange(false);
      }),
      typedBus.on("preset.select", (p) => {
        const id = (p as { presetId?: string })?.presetId;
        if (typeof id === "string") loadPreset(id);
      }),
      typedBus.on("preset.new", () => {
        void seedNew();
      }),
      typedBus.on("preset.name.set", (p) => {
        const name = (p as { name?: string })?.name;
        if (typeof name === "string") setEditorName(name);
      }),
      typedBus.on("preset.row.set", (p) => {
        const aptitudeId = (p as { aptitudeId?: string })?.aptitudeId;
        const field = (p as { field?: string })?.field;
        const value = (p as { value?: number | null })?.value;
        if (typeof aptitudeId !== "string" || typeof field !== "string") return;
        setEditorRows((prev) =>
          prev.map((row) => {
            if (row.aptitudeId !== aptitudeId) return row;
            const next = { ...row };
            if (field === "targetPermille") {
              next.targetPermille = value == null ? 0 : Math.trunc(value);
            } else if (
              field === "minAbs" ||
              field === "maxAbs" ||
              field === "minPermille" ||
              field === "maxPermille"
            ) {
              next[field] = value == null ? null : Math.trunc(value);
            }
            return next;
          })
        );
      }),
      typedBus.on("preset.save", () => {
        void (async () => {
          if (sumTargetPermille(editorRows) !== 1000) {
            emitAptitudeObs("preset.save.refused", { mode, reason: "presets.targetPermille.sum" });
            return;
          }
          emitAptitudeObs("preset.save", { mode, isNew, presetId: selectedPresetId });
          try {
            if (isNew || !selectedPresetId) {
              const saved = await saveMut.mutateAsync({
                playerId,
                name: editorName.trim() || "New preset",
                rows: editorRows
              });
              setSelectedPresetId(saved.presetId);
              setIsNew(false);
              pushToast({ tone: "ok", title: "Preset saved", message: saved.name });
            } else {
              const saved = await updateMut.mutateAsync({
                presetId: selectedPresetId,
                playerId,
                name: editorName.trim() || "Preset",
                rows: editorRows
              });
              pushToast({ tone: "ok", title: "Preset updated", message: saved.name });
            }
          } catch (e) {
            emitAptitudeObs("preset.save.failed", {
              mode,
              reason: e instanceof Error ? e.message : "unknown"
            });
            pushToast({
              tone: "bad",
              title: "Save failed",
              message: e instanceof Error ? e.message : "Unknown error"
            });
          }
        })();
      }),
      typedBus.on("preset.delete", () => {
        void (async () => {
          if (!selectedPresetId) return;
          emitAptitudeObs("preset.delete", { mode, presetId: selectedPresetId });
          try {
            await deleteMut.mutateAsync({ presetId: selectedPresetId, playerId });
            pushToast({ tone: "ok", title: "Preset deleted", message: selectedPresetId });
            await seedNew();
          } catch (e) {
            pushToast({
              tone: "bad",
              title: "Delete failed",
              message: e instanceof Error ? e.message : "Unknown error"
            });
          }
        })();
      }),
      typedBus.on("preset.applyDraft", () => {
        void (async () => {
          if (!selectedPresetId) {
            emitAptitudeObs("preset.applyDraft.refused", { mode, reason: "no-selection" });
            return;
          }
          emitAptitudeObs("preset.applyDraft", { mode, presetId: selectedPresetId, budget });
          try {
            // Ensure latest editor rows are persisted? Spec: Apply materializes selected preset.
            // If dirty unsaved new, save first is friendlier — but Accept says Apply uses materialize.
            const mat = await materializeAptitudePreset(selectedPresetId, budget, playerId);
            onApplyDraft(mat.shares);
            emitAptitudeObs("preset.applyDraft.done", {
              mode,
              leftover: mat.leftover
            });
            pushToast({
              tone: "ok",
              title: "Applied to draft",
              message: "Confirm on the aptitudes console to commit — or Activate to write now."
            });
            onOpenChange(false);
          } catch (e) {
            emitAptitudeObs("preset.applyDraft.failed", {
              mode,
              reason: e instanceof Error ? e.message : "unknown"
            });
            pushToast({
              tone: "bad",
              title: "Apply failed",
              message: e instanceof Error ? e.message : "Unknown error"
            });
          }
        })();
      }),
      typedBus.on("preset.activate", () => {
        void (async () => {
          if (!selectedPresetId) return;
          // Mode B: price is shown on strip; Activate still goes to activate API only (no ConfirmDialog).
          emitAptitudeObs("preset.activate", {
            mode,
            presetId: selectedPresetId,
            scope,
            scopeKey,
            priceLabel: activatePriceLabel ?? null
          });
          try {
            const result = await activateMut.mutateAsync({
              playerId,
              presetId: selectedPresetId,
              scope,
              scopeKey,
              correlationId:
                mode === "species" ? `preset-activate-${Date.now().toString(36)}` : undefined
            });
            onActivated(result.shares);
            emitAptitudeObs("preset.activate.done", {
              mode,
              presetId: selectedPresetId,
              leftover: result.leftover
            });
            pushToast({
              tone: "ok",
              title: "Preset activated",
              message: "Allocation committed via Activate — Confirm not required."
            });
            onOpenChange(false);
          } catch (e) {
            emitAptitudeObs("preset.activate.failed", {
              mode,
              reason: e instanceof Error ? e.message : "unknown"
            });
            pushToast({
              tone: "bad",
              title: "Activate failed",
              message: e instanceof Error ? e.message : "Unknown error"
            });
          }
        })();
      })
    ];
    return () => offs.forEach((off) => off());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    typedBus,
    mode,
    playerId,
    scopeKey,
    scope,
    budget,
    editorRows,
    editorName,
    selectedPresetId,
    isNew,
    activatePriceLabel,
    presetsQ.data,
    onApplyDraft,
    onActivated,
    onOpenChange,
    pushToast,
    saveMut,
    updateMut,
    deleteMut,
    activateMut
  ]);

  revisionRef.current += 1;
  const vm = foldPresetConsoleVm({
    presets: presetsQ.data ?? [],
    selectedPresetId,
    activePresetId: activeQ.data?.presetId ?? null,
    editorName,
    editorRows,
    displayNames,
    budget,
    previewShares: preview.shares,
    previewLeftover: preview.leftover,
    revision: revisionRef.current,
    mode,
    activatePriceLabel: activatePriceLabel ?? null,
    saving: saveMut.isPending || updateMut.isPending || deleteMut.isPending,
    activating: activateMut.isPending
  });

  // Chart leftover twin: fold already has leftover; append to chart payload via bind fields.
  const recipe = getRecipe("aptitude-preset-console");
  const plan = recipe ? bindSurface(recipe, vm, { preferOverlay: false }) : null;

  return (
    <PanelShell
      open={open}
      onOpenChange={onOpenChange}
      title="Aptitude presets"
      subtitle={
        mode === "species"
          ? "Species library — Activate charges the respec price shown below"
          : mode === "unique"
            ? "UniqueCreature library — Apply dirties draft; Activate commits"
            : "Commander library — Apply dirties draft; Activate commits"
      }
      testId="aptitude-preset-panel"
      size="default"
      footer={
        plan
          ? presetActionStripFactory({
              payload: {
                piece: "preset-action-strip",
                instanceId: "preset:actions",
                phase: "ready",
                ...vm.actions
              },
              bus,
              slots: {}
            })
          : undefined
      }
    >
      {presetsQ.isError ? (
        <Banner tone="error">Couldn&apos;t load presets.</Banner>
      ) : !plan ? (
        <EmptyState title="Preset recipe missing" testId="preset-console-missing-recipe" />
      ) : (
        <div className="flex min-h-0 flex-col gap-2">
          <p className="text-xs text-muted" data-testid="preset-budget-preview">
            Budget preview leftover {preview.leftover} (legal — not redistributed)
          </p>
          <RecipeMount plan={plan} bus={bus} />
        </div>
      )}
    </PanelShell>
  );
}


import { useEffect, useRef } from "react";
import {
  worldBusEmit,
  worldBusOn,
  type WorldIgnoreRect,
  type WorldModelPayload,
  type WorldSelectPayload
} from "@/game/EventBus";
import { createWorldGame, destroyWorldGame } from "@/game/createWorldGame";
import { usePhaserIslandHost } from "@/game-host/usePhaserIslandHost";
import type { AdaptedWorldState } from "@/contract/adapt";
import type { LegionView } from "@/contract/types";
import { cn } from "@/lib/cn";
import { worldModelProjection } from "./worldModelProjection";

export type WorldGameHostProps = {
  model: AdaptedWorldState;
  /** All adapted entities — not player-only (gaps D15/D26). */
  legions?: readonly LegionView[];
  playerFactionId?: string | null;
  /** Bumps when overlay inputs (lifelines/supply) change even if graph refs are equal. */
  overlayEpoch?: number;
  selectedSectorId?: string | null;
  /** Force / entity selection for map halo (followup F3). Wins over sector when set. */
  selectedEntityId?: string | null;
  ignoreRects?: WorldIgnoreRect[];
  /** Targeting overlay inputs (reachable / pending routes / blocked). */
  targeting?: unknown;
  /** Active map lens id — picker stays React; drawing is Phaser. */
  lens?: string;
  /** Host publishes generation to React — not window.__fusionRpgWorldGen (gaps D2). */
  onGeneration?: (generation: number) => void;
  onSelect: (payload: WorldSelectPayload) => void;
  className?: string;
};

/** Resolve interaction selection — force wins over sector (followup F3). */
export function interactionSelection(
  selectedSectorId: string | null | undefined,
  selectedEntityId: string | null | undefined
): { selectedId: string | null; selectedKind: "sector" | "force" | null } {
  if (selectedEntityId) return { selectedId: selectedEntityId, selectedKind: "force" };
  if (selectedSectorId) return { selectedId: selectedSectorId, selectedKind: "sector" };
  return { selectedId: null, selectedKind: null };
}

function hostLog(payload: Record<string, unknown>): void {
  if (import.meta.env.DEV) {
    console.info("[world-host]", payload);
  }
}

/**
 * Facade host — mount/destroy via usePhaserIslandHost (RT-02/07/11).
 * Buffers world:model / world:interaction / world:lens until world:ready; drops foreign generation.
 * Only this module may import createWorldGame (GG-38).
 */
export function WorldGameHost({
  model,
  legions = [],
  playerFactionId = null,
  overlayEpoch = 0,
  selectedSectorId = null,
  selectedEntityId = null,
  ignoreRects = [],
  targeting = null,
  lens = "ownership",
  onGeneration,
  onSelect,
  className
}: WorldGameHostProps) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const modelSeqRef = useRef(0);
  const lastFingerprintRef = useRef<string>("");
  const bufferedModelRef = useRef<{
    model: AdaptedWorldState;
    legions: readonly LegionView[];
    playerFactionId: string | null;
    overlayEpoch: number;
  } | null>(null);
  const bufferedLensRef = useRef<string | null>(null);
  const bufferedInteractionRef = useRef<{
    selectedId: string | null;
    selectedKind: "sector" | "force" | null;
    ignoreRects: WorldIgnoreRect[];
    targeting: unknown;
  } | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onGenerationRef = useRef(onGeneration);
  onGenerationRef.current = onGeneration;

  const emitModel = (
    generation: number,
    m: AdaptedWorldState,
    legs: readonly LegionView[],
    pf: string | null,
    epoch: number
  ) => {
    const fp = worldModelProjection({
      model: m,
      overlayEpoch: epoch,
      playerFactionId: pf,
      legions: legs
    });
    if (fp === lastFingerprintRef.current) return;
    lastFingerprintRef.current = fp;
    modelSeqRef.current += 1;
    const seq = modelSeqRef.current;
    hostLog({ event: "model", generation, modelSeq: seq, sectors: m.sectors.length });
    worldBusEmit("world:model", {
      generation,
      modelSeq: seq,
      model: { ...m, playerFactionId: pf, legions: legs }
    } satisfies WorldModelPayload);
  };

  const { generationRef, readyRef, notifyReady } = usePhaserIslandHost({
    parentRef,
    create: ({ parent, generation }) => {
      onGenerationRef.current?.(generation);
      return createWorldGame({ parent, generation });
    },
    destroy: async (game, generation) => {
      hostLog({ event: "destroy", generation });
      await destroyWorldGame(game, generation);
      onGenerationRef.current?.(0);
      if (typeof window !== "undefined") {
        const w = window as unknown as {
          __fusionRpgWorldGen?: number;
          __fusionRpgWorldProbe?: unknown;
        };
        delete w.__fusionRpgWorldGen;
        delete w.__fusionRpgWorldProbe;
      }
    },
    onResized: (generation, width, height) => {
      worldBusEmit("world:resized", { generation, width, height });
    },
    onReady: (generation) => {
      hostLog({ event: "ready", generation });
      if (bufferedModelRef.current) {
        const buf = bufferedModelRef.current;
        bufferedModelRef.current = null;
        emitModel(generation, buf.model, buf.legions, buf.playerFactionId, buf.overlayEpoch);
      }
      if (bufferedLensRef.current != null) {
        const l = bufferedLensRef.current;
        bufferedLensRef.current = null;
        hostLog({ event: "lens", generation, lens: l });
        worldBusEmit("world:lens", { generation, lens: l });
      }
      if (bufferedInteractionRef.current) {
        const i = bufferedInteractionRef.current;
        bufferedInteractionRef.current = null;
        worldBusEmit("world:interaction", {
          generation,
          selectedId: i.selectedId,
          selectedKind: i.selectedKind,
          ignoreRects: i.ignoreRects,
          targeting: i.targeting
        });
      }
      worldBusEmit("world:camera", {
        generation,
        op: "fit",
        padLeft: 100,
        padRight: 40,
        padTop: 56,
        padBottom: 80
      });
    }
  });

  useEffect(() => {
    bufferedModelRef.current = null;
    bufferedLensRef.current = null;
    bufferedInteractionRef.current = null;
    lastFingerprintRef.current = "";
    modelSeqRef.current = 0;

    const offReady = worldBusOn("world:ready", (raw) => {
      const p = raw as { generation?: number };
      if (p.generation == null) return;
      notifyReady(p.generation);
    });

    const offSelect = worldBusOn("world:select", (raw) => {
      const p = raw as WorldSelectPayload;
      if (p.generation !== generationRef.current) return;
      hostLog({ event: "select", generation: p.generation, kind: p.kind, id: p.id });
      onSelectRef.current(p);
    });

    return () => {
      offReady();
      offSelect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const generation = generationRef.current;
    if (!generation) return;
    if (!readyRef.current) {
      bufferedModelRef.current = { model, legions, playerFactionId, overlayEpoch };
      return;
    }
    emitModel(generation, model, legions, playerFactionId, overlayEpoch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, legions, playerFactionId, overlayEpoch]);

  useEffect(() => {
    const generation = generationRef.current;
    if (!generation) return;
    if (!readyRef.current) {
      bufferedLensRef.current = lens;
      return;
    }
    hostLog({ event: "lens", generation, lens });
    worldBusEmit("world:lens", { generation, lens });
  }, [lens, generationRef, readyRef]);

  useEffect(() => {
    const generation = generationRef.current;
    if (!generation) return;
    const sel = interactionSelection(selectedSectorId, selectedEntityId);
    if (!readyRef.current) {
      bufferedInteractionRef.current = {
        selectedId: sel.selectedId,
        selectedKind: sel.selectedKind,
        ignoreRects,
        targeting
      };
      return;
    }
    worldBusEmit("world:interaction", {
      generation,
      selectedId: sel.selectedId,
      selectedKind: sel.selectedKind,
      ignoreRects,
      targeting
    });
  }, [
    selectedSectorId,
    selectedEntityId,
    ignoreRects,
    targeting,
    generationRef,
    readyRef
  ]);

  return (
    <div
      ref={parentRef}
      data-testid="world-game-host"
      data-test-id="world-game-host"
      data-selected-sector={selectedSectorId ?? ""}
      className={cn("h-full w-full min-h-0 bg-soil", className)}
      role="img"
      aria-label="World map"
      onContextMenu={(e) => {
        // Phaser owns empty select via contextmenu; host only blocks the browser menu.
        e.preventDefault();
      }}
    >
      <div data-testid="world-game-canvas" data-test-id="world-game-canvas" className="contents" />
    </div>
  );
}

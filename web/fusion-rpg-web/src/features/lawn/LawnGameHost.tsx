import { useEffect, useRef } from "react";
import {
  lawnBusEmit,
  lawnBusOn,
  type LawnModelPayload,
  type LawnSelectPayload,
  type LawnViewModePayload
} from "@/game/EventBus";
import { createLawnGame, destroyLawnGame } from "@/game/createLawnGame";
import { setApiBaseMirror } from "@/game/apiBaseMirror";
import { setIconEpochMirror } from "@/game/iconEpochMirror";
import { lawnWorldSize } from "@/game/gridMath";
import { usePhaserIslandHost } from "@/game-host/usePhaserIslandHost";
import { apiBase } from "@/lib/bus/rest";
import { getIconEpoch, subscribeIconEpoch } from "@/lib/bus/icon-epoch";
import { cn } from "@/lib/cn";
import type { LawnViewMode } from "./lawnViewMode";
import { isLargeCanvas } from "./lawnViewMode";
import { DEFAULT_COLS, DEFAULT_ROWS, type LawnViewModel } from "./lawnViewModel";
import type { InteractionState } from "./interactionMode";
import {
  shouldBuffer,
  shouldEmitLawnModel,
  takeBuffered,
  toInteractionPayload
} from "./lawnHostBuffer";

/**
 * Facade host — mount/destroy via usePhaserIslandHost (RT-02/07/11).
 * Buffers lawn:model and lawn:interaction until lawn:ready; drops foreign generation.
 */
export function LawnGameHost({
  model,
  interaction,
  viewMode,
  onSelect
}: {
  model: LawnViewModel;
  interaction: InteractionState;
  viewMode: LawnViewMode;
  onSelect: (payload: LawnSelectPayload) => void;
}) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const bufferedModelRef = useRef<LawnViewModel | null>(null);
  const bufferedInteractionRef = useRef<InteractionState | null>(null);
  const bufferedViewRef = useRef<LawnViewMode | null>(null);
  const lastEmittedRev = useRef<number | undefined>(undefined);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const { generationRef, readyRef, notifyReady } = usePhaserIslandHost({
    parentRef,
    create: ({ parent, generation }) => createLawnGame({ parent, generation }),
    destroy: destroyLawnGame,
    onResized: (generation, width, height) => {
      lawnBusEmit("lawn:resized", { generation, width, height });
    },
    onReady: (generation) => {
      const bufModel = takeBuffered(bufferedModelRef);
      if (bufModel) {
        lastEmittedRev.current = bufModel.revision;
        lawnBusEmit("lawn:model", {
          generation,
          revision: bufModel.revision,
          model: bufModel
        } satisfies LawnModelPayload);
      }
      const bufIx = takeBuffered(bufferedInteractionRef);
      if (bufIx) {
        lawnBusEmit("lawn:interaction", toInteractionPayload(generation, bufIx));
      }
      const bufView = takeBuffered(bufferedViewRef);
      if (bufView) {
        lawnBusEmit("lawn:viewMode", {
          generation,
          viewMode: bufView
        } satisfies LawnViewModePayload);
      }
    }
  });

  useEffect(() => {
    bufferedModelRef.current = null;
    bufferedInteractionRef.current = null;
    bufferedViewRef.current = null;
    lastEmittedRev.current = undefined;

    // React owns HTTP / icon epoch — push mirrors into Phaser (lawn-plane).
    setApiBaseMirror(apiBase());
    const pushEpoch = () => {
      const epoch = getIconEpoch();
      setIconEpochMirror(epoch);
      const generation = generationRef.current;
      if (generation) {
        lawnBusEmit("lawn:iconEpoch", { generation, epoch });
      }
    };
    pushEpoch();
    const offEpoch = subscribeIconEpoch(pushEpoch);

    const offReady = lawnBusOn("lawn:ready", (raw) => {
      const p = raw as { generation?: number };
      if (p.generation == null) return;
      notifyReady(p.generation);
    });

    const offSelect = lawnBusOn("lawn:select", (raw) => {
      const p = raw as LawnSelectPayload;
      if (p.generation !== generationRef.current) return;
      onSelectRef.current(p);
    });

    return () => {
      offEpoch();
      offReady();
      offSelect();
    };
    // Mount-once listeners; generation filtered via refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const generation = generationRef.current;
    if (!generation) return;
    if (shouldBuffer(readyRef.current)) {
      bufferedModelRef.current = model;
      return;
    }
    if (!shouldEmitLawnModel(lastEmittedRev.current, model.revision)) return;
    lastEmittedRev.current = model.revision;
    lawnBusEmit("lawn:model", {
      generation,
      revision: model.revision,
      model
    } satisfies LawnModelPayload);
  }, [model, generationRef, readyRef]);

  useEffect(() => {
    const generation = generationRef.current;
    if (!generation) return;
    if (shouldBuffer(readyRef.current)) {
      bufferedInteractionRef.current = interaction;
      return;
    }
    lawnBusEmit("lawn:interaction", toInteractionPayload(generation, interaction));
  }, [interaction, generationRef, readyRef]);

  useEffect(() => {
    const generation = generationRef.current;
    if (!generation) return;
    if (shouldBuffer(readyRef.current)) {
      bufferedViewRef.current = viewMode;
      return;
    }
    lawnBusEmit("lawn:viewMode", {
      generation,
      viewMode
    } satisfies LawnViewModePayload);
  }, [viewMode, generationRef, readyRef]);

  const large = isLargeCanvas(viewMode);
  const world = lawnWorldSize(DEFAULT_ROWS, DEFAULT_COLS);

  return (
    <div
      ref={parentRef}
      data-testid="lawn-game-host"
      data-test-id="lawn-game-host"
      className={cn(
        "w-full overflow-hidden rounded-sm border border-border bg-soil",
        large
          ? // Keep Band-1 commander bar in the first viewport on phone/tablet (T13 / GG-36).
            "min-h-[36vh] h-[min(52vh,calc(100dvh-14rem))] md:min-h-[70vh] md:h-[calc(100vh-12rem)]"
          : "w-full min-h-[280px]"
      )}
      style={
        large
          ? undefined
          : { aspectRatio: `${world.width} / ${world.height}` }
      }
    />
  );
}

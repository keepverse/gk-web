/**
 * Generation-scoped Mediator between React host and Phaser scenes.
 * Foreign generation events are dropped by subscribers (RT-02 / RT-11).
 *
 * Lawn / world / siege / battle buses are separate `createStageBus` instances so
 * `*BusClearAll` never wipes another stage. They share `allocGameGeneration()`.
 */

import { createStageBus, type StageBus } from "./stageBus";

export type LawnBusEvent =
  | "lawn:model"
  | "lawn:select"
  | "lawn:interaction"
  | "lawn:viewMode"
  | "lawn:iconEpoch"
  | "lawn:resized"
  | "lawn:ready"
  | "lawn:destroyed";

export type LawnSelectPayload = {
  generation: number;
  kind: "tile" | "occupant";
  row?: number;
  col?: number;
  ptr?: string;
};

export type LawnInteractionPayload = {
  generation: number;
  mode: string;
  row?: number;
  col?: number;
  ptr?: string;
};

export type LawnModelPayload = {
  generation: number;
  revision: number;
  /** Opaque LawnViewModel from features/lawn — kept as unknown at bus edge. */
  model: unknown;
};

export type LawnViewModePayload = {
  generation: number;
  viewMode: string;
};

export type LawnIconEpochPayload = {
  generation: number;
  epoch: number;
};

export type LawnResizedPayload = {
  generation: number;
  width: number;
  height: number;
};

export type WorldBusEvent =
  | "world:model"
  | "world:select"
  | "world:camera"
  | "world:lens"
  | "world:interaction"
  | "world:ready"
  | "world:resized"
  | "world:destroyed";

export type WorldSelectPayload = {
  generation: number;
  kind: "sector" | "lane" | "force" | "empty";
  id?: string;
};

export type WorldCameraPayload = {
  generation: number;
  op: "pan" | "zoom" | "fit" | "centre";
  dx?: number;
  dy?: number;
  /** Absolute zoom target (HUD +/− may instead use `factor`). */
  scale?: number;
  /** Relative zoom multiplier about viewport centre (gaps D9). */
  factor?: number;
  /** World coords for `op: "centre"` (gaps D25). */
  x?: number;
  y?: number;
  /** Fit padding / safe insets in screen px. */
  padLeft?: number;
  padRight?: number;
  padTop?: number;
  padBottom?: number;
};

export type WorldLensPayload = {
  generation: number;
  lens: string;
};

export type WorldIgnoreRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type WorldInteractionPayload = {
  generation: number;
  selectedId?: string | null;
  selectedKind?: "sector" | "lane" | "force" | null;
  targeting?: unknown;
  ignoreRects?: WorldIgnoreRect[];
};

export type WorldModelPayload = {
  generation: number;
  /** Host monotonic dirty flag — not a wire DTO revision. */
  modelSeq: number;
  /** Adapted world view (+ overlay inputs) — opaque at the bus edge. */
  model: unknown;
};

export type WorldResizedPayload = {
  generation: number;
  width: number;
  height: number;
};

/** Frozen names (lock 5a) — stems required; payloads carry `generation`. */
export type SiegeBusEvent =
  | "siege:model"
  | "siege:select"
  | "siege:interaction"
  | "siege:ready"
  | "siege:resized"
  | "siege:destroyed";

export type BattleBusEvent =
  | "battle:model"
  | "battle:select"
  | "battle:interaction"
  | "battle:ready"
  | "battle:resized"
  | "battle:destroyed";

type Handler = (payload: unknown) => void;

const lawnBus: StageBus<LawnBusEvent> = createStageBus<LawnBusEvent>();
const worldBus: StageBus<WorldBusEvent> = createStageBus<WorldBusEvent>();
const siegeBus: StageBus<SiegeBusEvent> = createStageBus<SiegeBusEvent>();
const battleBus: StageBus<BattleBusEvent> = createStageBus<BattleBusEvent>();

export function lawnBusOn(event: LawnBusEvent, handler: Handler): () => void {
  return lawnBus.on(event, handler);
}

export function lawnBusEmit(event: LawnBusEvent, payload: unknown): void {
  lawnBus.emit(event, payload);
}

/** Test / destroy helper — clears lawn bus listeners only. */
export function lawnBusClearAll(): void {
  lawnBus.clearAll();
}

export function worldBusOn(event: WorldBusEvent, handler: Handler): () => void {
  return worldBus.on(event, handler);
}

export function worldBusEmit(event: WorldBusEvent, payload: unknown): void {
  worldBus.emit(event, payload);
}

/** Test / destroy helper — clears world bus listeners only (lawn untouched). */
export function worldBusClearAll(): void {
  worldBus.clearAll();
}

export function siegeBusOn(event: SiegeBusEvent, handler: Handler): () => void {
  return siegeBus.on(event, handler);
}

export function siegeBusEmit(event: SiegeBusEvent, payload: unknown): void {
  siegeBus.emit(event, payload);
}

export function siegeBusClearAll(): void {
  siegeBus.clearAll();
}

export function battleBusOn(event: BattleBusEvent, handler: Handler): () => void {
  return battleBus.on(event, handler);
}

export function battleBusEmit(event: BattleBusEvent, payload: unknown): void {
  battleBus.emit(event, payload);
}

export function battleBusClearAll(): void {
  battleBus.clearAll();
}

let nextGeneration = 1;

export function allocGameGeneration(): number {
  return nextGeneration++;
}

/** Test helper — reset generation counter. */
export function resetGameGenerationForTests(): void {
  nextGeneration = 1;
}

export type { StageBus };
export { createStageBus, STAGE_BUS_REQUIRED_STEMS, stageEventNames } from "./stageBus";

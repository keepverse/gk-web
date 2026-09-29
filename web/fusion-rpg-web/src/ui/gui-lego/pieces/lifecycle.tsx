import type { ReactNode } from "react";
import type { PieceFactory } from "@/features/gui-lego/types";

function phaseRoot(
  kind: "loading" | "empty" | "error" | "pending",
  message: string,
  extra?: ReactNode
) {
  // `data-phase` carries the state for CSS and tests; the human-readable text is `message`.
  // Rendering the class name (`phase-loading`) beside the message was scaffolding that leaked
  // engine vocabulary to the player (GG-23), so it is deliberately absent.
  return (
    <div className={`phase phase-${kind}`} data-phase={kind} role="status">
      <span>{message}</span>
      {extra}
    </div>
  );
}

export const phaseLoadingFactory: PieceFactory = ({ payload }) =>
  phaseRoot("loading", String(payload.message ?? "Loading…"));

export const phaseEmptyFactory: PieceFactory = ({ payload }) =>
  phaseRoot("empty", String(payload.message ?? "Nothing here."));

export const phaseErrorFactory: PieceFactory = ({ payload, bus }) => {
  const message = String(payload.message ?? "Unavailable");
  const retryLabel = String(payload.retryLabel ?? "Retry");
  const canRetry = payload.canRetry !== false;
  const retryEvent = String(payload.retryEvent ?? "derived.retry");
  return phaseRoot(
    "error",
    message,
    canRetry ? (
      <button type="button" onClick={() => bus.emit(retryEvent, {})}>
        {retryLabel}
      </button>
    ) : null
  );
};

export const phasePendingFactory: PieceFactory = ({ payload }) =>
  phaseRoot("pending", String(payload.message ?? "Not ready yet."));

export const LIFECYCLE_SLOT_MAP: Record<string, readonly string[]> = {
  "phase-loading": [],
  "phase-empty": [],
  "phase-error": [],
  "phase-pending": []
};

export const lifecycleFactories: Record<string, PieceFactory> = {
  "phase-loading": phaseLoadingFactory,
  "phase-empty": phaseEmptyFactory,
  "phase-error": phaseErrorFactory,
  "phase-pending": phasePendingFactory
};

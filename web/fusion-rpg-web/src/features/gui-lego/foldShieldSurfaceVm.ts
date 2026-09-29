/**
 * Pure fold → Shield surface VM. No React.
 * Spec: docs/architecture/shield-sheet/spec-shield-surface-vm.md
 */
import {
  contributionFictionLabel,
  type ActorSheetChannelDto,
  type ActorShieldLayerDto,
  type ActorShieldSummaryDto
} from "@/lib/bus/aura";
import type { DerivedFamilyCatalogRow } from "@/lib/bus/actorSurface";
import { joinShieldOmniRows } from "./joinShieldOmniRows";
import { MAX_SHIELD_LAYERS, shieldPriorityLabel } from "./shieldPriorityLabel";
import { resolveElementPaint } from "./themes/elementPaint";
import type { Phase, PiecePayload, ThemeRef } from "./types";

export type ShieldSurfaceAvailability = "ready" | "loading" | "error" | "pending";

export type ShieldSurfaceVmInput = {
  layers: readonly ActorShieldLayerDto[] | null | undefined;
  summary?: ActorShieldSummaryDto | null;
  omniChannels?: readonly ActorSheetChannelDto[] | null;
  families: readonly Pick<
    DerivedFamilyCatalogRow,
    "family" | "sheetGroup" | "expand" | "displayName" | "unitClass" | "reading" | "icon"
  >[];
  availability: ShieldSurfaceAvailability;
  selectedShieldId?: string | null;
  revision?: number;
};

export type ShieldSurfaceVm = {
  phase: Phase;
  revision: number;
  rootClass: string;
  testId: string;
  stack: PiecePayload;
  inspect: PiecePayload;
  omni: PiecePayload[];
  omniRegion: PiecePayload;
  phasePayload: PiecePayload;
};

function toSurfacePhase(availability: ShieldSurfaceAvailability): Phase {
  if (availability === "loading") return "loading";
  if (availability === "error") return "error";
  if (availability === "pending") return "pending";
  return "ready";
}

function formatLong(n: number): string {
  return Number.isFinite(n) ? n.toLocaleString() : "—";
}

function layerSourceLabel(sourceId: string): string {
  const fiction = contributionFictionLabel(sourceId);
  if (fiction !== sourceId) return fiction;
  if (sourceId.startsWith("aura")) return "From your pact";
  if (sourceId.startsWith("skill")) return "From a skill";
  if (sourceId.startsWith("innate")) return "Innate ward of the body";
  return fiction;
}

function buildSegment(layer: ActorShieldLayerDto, selected: boolean): Record<string, unknown> {
  const broken = Boolean(layer.broken) || layer.current <= 0;
  const elementId =
    layer.elementId != null && String(layer.elementId).length > 0 ? String(layer.elementId) : null;
  const paint = elementId ? resolveElementPaint(elementId) : null;
  const priorityLabel = shieldPriorityLabel(layer.priority, layer.isInnate);
  const themeRef: ThemeRef | undefined = elementId
    ? { kind: "element", id: elementId }
    : { kind: "neutral", id: "neutral" };
  const max = layer.max;
  const current = broken ? 0 : layer.current;
  const fillPct = max > 0 ? Math.max(0, Math.min(100, Math.round((current / max) * 100))) : 0;
  const regenText =
    layer.regenPerSecond != null && Number.isFinite(layer.regenPerSecond)
      ? `+${formatLong(layer.regenPerSecond)}/s`
      : undefined;

  return {
    shieldId: layer.shieldId,
    elementId,
    current: layer.current,
    max: layer.max,
    currentText: formatLong(layer.current),
    maxText: formatLong(layer.max),
    priorityLabel,
    broken,
    fillPct,
    selected,
    themeRef,
    paintAccent: paint?.paint.accent,
    dataEl: paint?.dataEl ?? "neutral",
    elementLabel: paint?.label ?? null,
    untyped: elementId == null,
    ...(regenText ? { regenText } : {})
  };
}

function buildStack(
  layers: readonly ActorShieldLayerDto[],
  phase: Phase,
  selectedShieldId: string | null
): PiecePayload {
  if (phase === "pending" || phase === "loading" || phase === "error") {
    return {
      piece: "shield-stack-bar",
      instanceId: "shield:stack",
      phase,
      segments: [],
      emptySlots: 0,
      message: phase === "pending" ? "Shield details aren't ready yet" : undefined
    };
  }

  const segments = layers.slice(0, MAX_SHIELD_LAYERS).map((layer) => {
    const selected =
      selectedShieldId != null
        ? layer.shieldId === selectedShieldId
        : layers[0]?.shieldId === layer.shieldId;
    return buildSegment(layer, selected);
  });

  // Width share ∝ max across the stack (design §3.1).
  const maxSum = segments.reduce((a, s) => a + Math.max(0, Number(s.max) || 0), 0) || 1;
  for (const seg of segments) {
    const max = Math.max(0, Number(seg.max) || 0);
    seg.widthPct = Math.max(8, Math.round((max / maxSum) * 100));
  }

  const emptySlots = Math.max(0, MAX_SHIELD_LAYERS - segments.length);

  return {
    piece: "shield-stack-bar",
    instanceId: "shield:stack",
    phase: "ready",
    segments,
    emptySlots
  };
}

function buildInspect(
  layers: readonly ActorShieldLayerDto[],
  phase: Phase,
  selectedShieldId: string | null
): PiecePayload {
  // Recipe binds piece `shield-layer-inspect` — keep piece id stable across phases.
  if (phase === "pending" || phase === "loading") {
    return {
      piece: "shield-layer-inspect",
      instanceId: "shield:inspect",
      phase: "pending",
      title: "Shield",
      currentText: "—",
      maxText: "—",
      priorityLabel: "—",
      sourceLabel: "—",
      message: "Shield details aren't ready yet"
    };
  }
  if (phase === "error") {
    return {
      piece: "shield-layer-inspect",
      instanceId: "shield:inspect",
      phase: "error",
      title: "Shield",
      currentText: "—",
      maxText: "—",
      priorityLabel: "—",
      sourceLabel: "—",
      message: "Shield sheet failed to load.",
      retryEvent: "shield.retry",
      canRetry: true
    };
  }

  if (layers.length === 0) {
    return {
      piece: "shield-layer-inspect",
      instanceId: "shield:inspect",
      phase: "empty",
      title: "Shield",
      currentText: "—",
      maxText: "—",
      priorityLabel: "—",
      sourceLabel: "—",
      message: "No shield layer selected"
    };
  }

  const selected =
    (selectedShieldId ? layers.find((l) => l.shieldId === selectedShieldId) : null) ?? layers[0]!;
  const priorityLabel = shieldPriorityLabel(selected.priority, selected.isInnate);
  const elementId =
    selected.elementId != null && String(selected.elementId).length > 0
      ? String(selected.elementId)
      : null;
  const paint = elementId ? resolveElementPaint(elementId) : null;
  const elementLabel = paint?.label ?? null;
  const titleParts = [
    elementLabel ?? (elementId ? elementId : "Untyped"),
    priorityLabel.toLowerCase(),
    "shield"
  ];
  const regenText =
    selected.regenPerSecond != null && Number.isFinite(selected.regenPerSecond)
      ? `+${formatLong(selected.regenPerSecond)}/s`
      : undefined;

  return {
    piece: "shield-layer-inspect",
    instanceId: `shield:inspect:${selected.shieldId}`,
    phase: "ready",
    title: titleParts.join(" "),
    currentText: formatLong(selected.current),
    maxText: formatLong(selected.max),
    priorityLabel,
    sourceLabel: layerSourceLabel(selected.sourceId),
    elementLabel,
    elementId,
    shieldId: selected.shieldId,
    broken: Boolean(selected.broken) || selected.current <= 0,
    themeRef: elementId ? { kind: "element", id: elementId } : { kind: "neutral", id: "neutral" },
    ...(regenText ? { regenText } : {})
  };
}

function parityOk(
  layers: readonly ActorShieldLayerDto[],
  summary: ActorShieldSummaryDto | null | undefined
): boolean {
  if (!summary || layers.length === 0) return true;
  const sumCurrent = layers.reduce((a, l) => a + (l.current ?? 0), 0);
  const sumMax = layers.reduce((a, l) => a + (l.max ?? 0), 0);
  const sc = summary.current ?? 0;
  const sm = summary.max ?? 0;
  return sumCurrent === sc && (summary.max == null || sumMax === sm);
}

export function foldShieldSurfaceVm(input: ShieldSurfaceVmInput): ShieldSurfaceVm {
  const phase = toSurfacePhase(input.availability);
  const layers = [...(input.layers ?? [])].slice(0, MAX_SHIELD_LAYERS);
  const selectedShieldId = input.selectedShieldId ?? null;
  const stack = buildStack(layers, phase, selectedShieldId);
  const inspect = buildInspect(layers, phase, selectedShieldId);

  const omni =
    phase === "ready"
      ? joinShieldOmniRows({ families: input.families, channels: input.omniChannels })
      : [];

  const omniRegion: PiecePayload = {
    piece: "shield-omni-region",
    instanceId: "shield:omni",
    phase: phase === "ready" ? "ready" : phase,
    title: "Shield stats",
    rows: omni,
    message: phase === "pending" ? "Shield details aren't ready yet" : undefined
  };

  const phasePayload: PiecePayload =
    phase === "error"
      ? {
          piece: "phase-error",
          instanceId: "shield:phase",
          phase: "error",
          message: "Shield sheet failed to load.",
          retryEvent: "shield.retry",
          canRetry: true
        }
      : phase === "loading"
        ? {
            piece: "phase-loading",
            instanceId: "shield:phase",
            phase: "loading",
            message: "Loading shield…"
          }
        : {
            piece: "phase-pending",
            instanceId: "shield:phase",
            phase: "pending",
            message: "Shield details aren't ready yet",
            testId: "actor-shield-pending"
          };

  // Parity is asserted in tests; fold never invents layers to "fix" mismatch.
  void parityOk(layers, input.summary);

  return {
    phase,
    revision: input.revision ?? 0,
    rootClass: "shield-console",
    testId: "shield-console",
    stack,
    inspect,
    omni,
    omniRegion,
    phasePayload
  };
}

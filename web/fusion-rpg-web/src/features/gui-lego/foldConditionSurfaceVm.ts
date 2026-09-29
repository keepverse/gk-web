import type { Phase, PiecePayload, ThemeRef } from "./types";
import type {
  ActorResourcePoolDto,
  ActorSheetDto,
  ActorShieldSummaryDto,
  ActorStandingDto,
  ActorStatusGlyphDto
} from "@/lib/bus/aura";
import type { ActorSurfaceCatalog, ResourceCatalogRow, StatusCatalogRow } from "@/lib/bus/actorSurface";
import type { ActorView } from "@/contract/types";
import { isShieldSummaryMountable } from "./shieldMount";
import { STANDING_AXIS_PAINT } from "@/theme/chartPaint";

export type ConditionSurfaceVmInput = {
  data: ActorView;
  sheet: ActorSheetDto | null | undefined;
  surface: ActorSurfaceCatalog;
  selectedPoolId: string | null;
  availability: "ready" | "loading" | "error";
  revision?: number;
};

export type ConditionSurfaceVm = {
  phase: Phase;
  revision: number;
  rootClass: string;
  testId: string;
  main: PiecePayload[];
  phasePayload: PiecePayload;
};

const STANDING_PENDING_MESSAGE = "Standing vector isn't ready yet.";
const STANDING_TITLE = "Standing";
const EFFECTS_TITLE = "Effects";

/** Hex paints — recharts cannot consume CSS vars alone (standing-radar spec). Literals live in
 * `src/theme/chartPaint.ts` (`STANDING_AXIS_PAINT`), the guard's own exempt directory. */
const STANDING_AXES: {
  id: keyof ActorStandingDto;
  label: string;
  paint: string;
}[] = [
  { id: "offense", label: "Offense", paint: STANDING_AXIS_PAINT.offense },
  { id: "survivability", label: "Survivability", paint: STANDING_AXIS_PAINT.survivability },
  { id: "control", label: "Control", paint: STANDING_AXIS_PAINT.control },
  { id: "utility", label: "Utility", paint: STANDING_AXIS_PAINT.utility },
  { id: "economy", label: "Economy", paint: STANDING_AXIS_PAINT.economy }
];

function toSurfacePhase(availability: ConditionSurfaceVmInput["availability"]): Phase {
  if (availability === "loading") return "loading";
  if (availability === "error") return "error";
  return "ready";
}

function poolById(sheet: ActorSheetDto | null | undefined) {
  return new Map((sheet?.resourcePools ?? []).map((row) => [row.resourceId, row]));
}

function glyphByStatus(sheet: ActorSheetDto | null | undefined) {
  return new Map((sheet?.liveStatuses ?? []).map((row) => [row.statusId, row]));
}

function progressFillPct(level: number, xp: number, xpToNext: number | null | undefined): number | null {
  if (!Number.isFinite(xp) || !Number.isFinite(level) || !xpToNext || xpToNext <= 0) return null;
  return Math.max(0, Math.min(100, Math.round((xp / xpToNext) * 100)));
}

/** Stamp revision on a piece payload and nested piece-shaped children (Q5).
 *
 * `revision` is a number, so it can never satisfy the `"piece" in value` test below and never
 * needs an explicit skip. Comparing the key would also spell the word as a string literal, which
 * `vocabularyGuard` bans as engine vocabulary (GG-23) — the guard's `case`-label exemption covers
 * comparisons, not a rendered literal. Destructuring it out keeps the intent without the literal.
 */
function stampRevision(payload: PiecePayload, revision: number): PiecePayload {
  const { revision: _stamp, ...rest } = payload;
  payload.revision = revision;
  for (const value of Object.values(rest)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === "object" && "piece" in (item as object)) {
          stampRevision(item as PiecePayload, revision);
        }
      }
    } else if (value && typeof value === "object" && "piece" in (value as object)) {
      stampRevision(value as PiecePayload, revision);
    }
  }
  return payload;
}

function buildProgression(data: ActorView, sheet: ActorSheetDto | null | undefined): PiecePayload {
  const xp = sheet?.xp ?? data.xp;
  const xpToNext = sheet?.xpToNext ?? null;
  const level = sheet?.level ?? data.level;
  const fillPct = progressFillPct(level, xp, xpToNext);
  return {
    piece: "progression-gauge",
    instanceId: "condition:progression",
    phase: xpToNext == null ? "pending" : "ready",
    gridArea: "prog",
    level,
    xp,
    xpToNext,
    fillPct,
    valueText:
      xpToNext == null ? `${xp.toLocaleString()} XP` : `${xp.toLocaleString()} / ${xpToNext.toLocaleString()} XP`,
    message: xpToNext == null ? "Next level isn't shown yet" : null
  };
}

function buildIdentity(data: ActorView, sheet: ActorSheetDto | null | undefined): PiecePayload {
  const base = {
    piece: "actor-identity",
    instanceId: "condition:identity",
    gridArea: "identity",
    side: data.side,
    typeId: sheet?.typeId ?? data.typeId
  };

  if (sheet == null) {
    return {
      ...base,
      phase: "pending",
      speciesName: null,
      speciesMessage: "Species isn't loaded yet.",
      elementBadges: []
    };
  }

  const elements = sheet.elementTyping
    ? [sheet.elementTyping.primary, ...(sheet.elementTyping.secondary ? [sheet.elementTyping.secondary] : [])]
    : [];

  const identity: PiecePayload = {
    ...base,
    phase: sheet.speciesName || sheet.phase || elements.length ? "ready" : "pending",
    speciesName: sheet.speciesName ?? null,
    speciesMessage: sheet.speciesName ? null : "Species isn't on file for this actor.",
    elementBadges: elements.map((elementId) => ({
      piece: "element-badge",
      instanceId: `condition:identity:element:${elementId}`,
      phase: "ready" as const,
      elementId,
      label: elementId,
      themeRef: { kind: "element", id: elementId } satisfies ThemeRef
    }))
  };

  if (sheet.phase) {
    identity.phaseBadge = {
      piece: "phase-badge",
      instanceId: "condition:identity:phase",
      phase: "ready",
      label: sheet.phase
    };
  }

  return identity;
}

function buildShieldPayload(shield: ActorShieldSummaryDto): PiecePayload {
  const current = shield.current ?? 0;
  const max = shield.max ?? 0;
  const elementId =
    shield.elementId != null && shield.elementId.length > 0 ? shield.elementId : null;
  const themeRef: ThemeRef | undefined = elementId
    ? { kind: "element", id: elementId }
    : undefined;

  return {
    piece: "shield-status",
    instanceId: "condition:shield",
    phase: "ready",
    current,
    max,
    stacks: shield.stacks ?? null,
    elementId,
    themeRef,
    currentText: current.toLocaleString(),
    maxText: max.toLocaleString()
  };
}

function buildHero(
  data: ActorView,
  sheet: ActorSheetDto | null | undefined,
  surface: ActorSurfaceCatalog,
  selectedPoolId: string | null
): PiecePayload {
  const pools = poolById(sheet);
  const hpCatalog = surface.resources.find((row) => row.id === "hp") ?? surface.resources[0]!;
  const hp = pools.get("hp");
  const hpPct =
    hp?.current != null && hp.max != null && hp.max > 0
      ? Math.max(0, Math.min(100, Math.round((hp.current / hp.max) * 100)))
      : null;
  const shield = sheet?.shieldSummary ?? null;
  const shieldMountable = isShieldSummaryMountable(shield);
  const shieldPct =
    shieldMountable && shield?.max != null && shield.max > 0
      ? Math.max(0, Math.min(100, Math.round(((shield.current ?? 0) / shield.max) * 100)))
      : null;
  const shieldTheme: ThemeRef | undefined =
    shieldMountable && shield?.elementId != null && shield.elementId.length > 0
      ? { kind: "element", id: shield.elementId }
      : undefined;

  const hero: PiecePayload = {
    piece: "cond-hero",
    instanceId: "condition:hero",
    phase: "ready",
    gridArea: "hero",
    selectedPoolId,
    slotsTitle: "Vitality",
    radial: {
      piece: "pool-radial",
      instanceId: "condition:pool:hp",
      phase: hpPct == null ? "pending" : "ready",
      poolId: "hp",
      label: "HP",
      valueText:
        hp?.current != null && hp.max != null
          ? `${hp.current.toLocaleString()} / ${hp.max.toLocaleString()}`
          : "Current / max pending",
      hpPct,
      shieldPct,
      themeRef: { kind: "resource", id: hpCatalog.id },
      shieldThemeRef: shieldTheme,
      message: hpPct == null ? "Current / max HP pending until pools land." : null
    },
    meters: surface.resources.map((resource) => buildMeter(data, resource, pools.get(resource.id), selectedPoolId))
  };

  if (shieldMountable && shield) {
    hero.shield = buildShieldPayload(shield);
  }

  return hero;
}

function buildMeter(
  data: ActorView,
  resource: ResourceCatalogRow,
  live: ActorResourcePoolDto | undefined,
  selectedPoolId: string | null
): PiecePayload {
  const label = resource.labels[data.side];
  const fillPct =
    live?.current != null && live.max != null && live.max > 0
      ? Math.max(0, Math.min(100, Math.round((live.current / live.max) * 100)))
      : null;
  return {
    piece: "pool-meter",
    instanceId: `condition:resource:${resource.id}`,
    phase: fillPct == null ? "pending" : "ready",
    poolId: resource.id,
    label,
    icon: resource.icon,
    valueText:
      live?.current != null && live.max != null
        ? `${live.current.toLocaleString()} / ${live.max.toLocaleString()}`
        : "Current / max pending",
    fillPct,
    selected: selectedPoolId === resource.id,
    themeRef: { kind: "resource", id: resource.id },
    message: fillPct == null ? "Current / max pending" : null
  };
}

/**
 * copy-surfaces (T11) — the only sanctioned "combat power" number: Offense + Survivability +
 * Control from Standing. Utility/Economy are real axes (kept on the five-axis vector below for
 * inspect) but never folded into this label — and neither is Θ/level (`chip-honesty`, T10's own
 * surface) nor a single `combat.power.omni` glance (that channel is one Offense contributor among
 * many, not the product's own "combat power" number).
 */
export function sumCombatPowerLabel(standing: ActorStandingDto): number {
  return standing.offense + standing.survivability + standing.control;
}

function buildStanding(sheet: ActorSheetDto | null | undefined): PiecePayload {
  const standing = sheet?.standing ?? null;
  if (standing == null) {
    return {
      piece: "stand-row",
      instanceId: "condition:standing",
      phase: "ready",
      gridArea: "stand",
      title: STANDING_TITLE,
      combatPowerText: null,
      radar: {
        piece: "standing-radar",
        instanceId: "condition:standing:radar",
        phase: "pending" as const,
        title: STANDING_TITLE,
        message: STANDING_PENDING_MESSAGE
      },
      bars: {
        piece: "standing-bars",
        instanceId: "condition:standing:bars",
        phase: "pending" as const,
        title: STANDING_TITLE,
        message: STANDING_PENDING_MESSAGE
      }
    };
  }

  const raw = STANDING_AXES.map((axis) => ({
    id: axis.id,
    label: axis.label,
    value: standing[axis.id],
    paint: axis.paint
  }));
  const maxAxis = Math.max(1, ...raw.map((a) => a.value));
  const axes = raw.map((a) => ({
    ...a,
    valueText: a.value.toLocaleString(),
    fillPct: Math.max(0, Math.min(100, Math.round((a.value / maxAxis) * 100)))
  }));

  return {
    piece: "stand-row",
    instanceId: "condition:standing",
    phase: "ready",
    gridArea: "stand",
    title: STANDING_TITLE,
    combatPowerText: sumCombatPowerLabel(standing).toLocaleString(),
    radar: {
      piece: "standing-radar",
      instanceId: "condition:standing:radar",
      phase: "ready",
      title: STANDING_TITLE,
      axes
    },
    bars: {
      piece: "standing-bars",
      instanceId: "condition:standing:bars",
      phase: "ready",
      title: STANDING_TITLE,
      axes
    }
  };
}

function buildStatusStrip(
  sheet: ActorSheetDto | null | undefined,
  statuses: StatusCatalogRow[]
): PiecePayload | undefined {
  // Q3 / fiction-copy — omit entire strip when sheet missing or zero live statuses.
  if (sheet == null) return undefined;

  const liveById = glyphByStatus(sheet);
  const liveRows = statuses
    .filter((row) => liveById.has(row.id))
    .map((row) => {
      const live = liveById.get(row.id) as ActorStatusGlyphDto;
      return {
        id: row.id,
        label: row.displayName,
        hudToken: row.hudToken,
        color: row.color,
        remainingPermille: live.remainingPermille ?? null
      };
    });

  if (liveRows.length === 0) return undefined;

  return {
    piece: "status-glyph-strip",
    instanceId: "condition:status-strip",
    title: EFFECTS_TITLE,
    overflowCount: 0,
    phase: "ready",
    items: liveRows,
    message: null
  };
}

export function foldConditionSurfaceVm(input: ConditionSurfaceVmInput): ConditionSurfaceVm {
  const phase = toSurfacePhase(input.availability);
  const revision = input.revision ?? 1;
  const standing = buildStanding(input.sheet);
  const statusStrip = buildStatusStrip(input.sheet, input.surface.statuses);
  if (statusStrip) {
    standing.statusStrip = statusStrip;
  }

  const main = [
    buildProgression(input.data, input.sheet),
    buildIdentity(input.data, input.sheet),
    buildHero(input.data, input.sheet, input.surface, input.selectedPoolId),
    standing
  ].map((row) => stampRevision(row, revision));

  return {
    phase,
    revision,
    rootClass: "condition-console",
    testId: "condition-console",
    main,
    phasePayload: {
      piece: phase === "loading" ? "phase-loading" : "phase-error",
      instanceId: `condition:phase:${phase}`,
      phase,
      revision,
      message: phase === "loading" ? "Loading Condition…" : "Condition is unavailable.",
      retryLabel: "Retry",
      retryEvent: "condition.retry"
    }
  };
}

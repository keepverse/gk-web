import type {
  CargoRowDto,
  SectorStorageRowDto,
  WorldRelicReachabilityDto,
  WorldStructureDto
} from "@/lib/bus/world";
import type { Magnitude } from "@/contract/types";

/**
 * empire-wonder-surfaces `wonder-composer` (plan Task 4D.3,
 * spec-wonder-composer.md §Design 2 + §Design 5) — the composer fold:
 * reachable-first join, live counts, affordability. Pure data, no paint,
 * no copy.
 *
 * Inputs are world/Game state and catalogs only — never lawn, Unity, or
 * injector fields. Outputs are payloads with `themeRef` slot strings and
 * display-catalog copy keys; pieces declare slots only.
 *
 * Pack contract (owned by 4D.4 — `spec-wonder-display.md` §Design 2):
 * this fold emits `themeRef` slot strings (`wonder-scope.Sector`,
 * `wonder-rarity.Unique`, … incl. the `World`/`Multiverse` "not yet" slot)
 * and never a paint value, never a pack file.
 *
 * Copy contract (GG-62): this fold emits copy KEYS only (the
 * `WonderComposerCopyKey` union below); sentences live in the display
 * catalog (`stages/world/wonderComposer/copyCatalog.ts`, provisional
 * DRAFT until owner amends). The fold never composes a sentence, never
 * renders a raw id or wire token as player text (GG-23).
 *
 * Shelf-consume by name: candidate rows arrive as 4D.1/4D.2a DTO rows
 * (`CargoRowDto` from the sheet tab, `SectorStorageDto` rows from the
 * vault) — where-it-sits truth stays the sibling overlay's; this fold
 * only joins them against the 4A.4 reachability read.
 */

// ---------------------------------------------------------------------------
// Closed vocabularies (validation-ssot: literals pinned ONLY for closed
// code-owned sets, with this reason stated).
// ---------------------------------------------------------------------------

/** The four refusal wire tokens this fold translates (backend-owned). */
export const WONDER_REFUSAL_REASONS = [
  "wonder.cap-reached",
  "relic.count-mismatch",
  "relic.not-reachable",
  "build.cannot-afford-materials"
] as const;

export type WonderRefusalReason = (typeof WONDER_REFUSAL_REASONS)[number];

/**
 * `relic.duplicate` is admission's second spelling of the same
 * foundation-asks-N rule (`WorldCommandAdmission.cs:117-118`) — it maps to
 * the count-mismatch family, never a fifth copy row, never silent.
 */
export const WONDER_DUPLICATE_REASON = "relic.duplicate" as const;

/** Reserved scope/kind members — closed per `WonderCatalog.cs:8-60`, consumed. */
export const WONDER_RESERVED_SCOPES = ["World", "Multiverse"] as const;
export const WONDER_RESERVED_KINDS = ["DefensePower", "AuraGrant", "EmpireBuff"] as const;

/** Copy keys the fold emits — sentences live in the display catalog. */
export type WonderComposerCopyKey =
  | "wonder.effect.sector"
  | "wonder.effect.empire"
  | "wonder.cap-line"
  | "wonder.uncapped"
  | "wonder.locked.world"
  | "wonder.locked.multiverse"
  | "wonder.locked.defense"
  | "wonder.locked.aura"
  | "wonder.locked.empire-buff"
  | "wonder.placeholder.unknown"
  | "wonder.refused.cap-reached"
  | "wonder.refused.count-mismatch"
  | "wonder.refused.not-reachable"
  | "wonder.refused.cannot-afford"
  | "wonder.next.other-row"
  | "wonder.next.relay"
  | "wonder.next.fetch"
  | "wonder.next.gather"
  | "wonder.confirm.spend"
  | "wonder.filed.pending"
  | "wonder.empty.shelf"
  | "wonder.error.read"
  | "wonder.loading";

/** Next action per refusal — one home, beside its copy key. */
export const WONDER_REFUSAL_NEXT: Record<WonderRefusalReason, Extract<WonderComposerCopyKey, `wonder.next.${string}`>> = {
  "wonder.cap-reached": "wonder.next.other-row",
  "relic.count-mismatch": "wonder.next.relay",
  "relic.not-reachable": "wonder.next.fetch",
  "build.cannot-afford-materials": "wonder.next.gather"
};

/** Refusal copy key per wire token. */
export const WONDER_REFUSAL_COPY: Record<WonderRefusalReason, WonderComposerCopyKey> = {
  "wonder.cap-reached": "wonder.refused.cap-reached",
  "relic.count-mismatch": "wonder.refused.count-mismatch",
  "relic.not-reachable": "wonder.refused.not-reachable",
  "build.cannot-afford-materials": "wonder.refused.cannot-afford"
};

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export type WonderComposerSectorInput = {
  sectorId: string;
  /** Straight off `SectorView` — Magnitudes, never bare numbers (GG-46). */
  wonderLiveCountSector: Magnitude;
  wonderLiveCountEmpire: Magnitude;
  /**
   * This sector's Wonder upkeep operand (`UpkeepBreakdownView.wonderUpkeep`,
   * 4A.4 wire) — `null` while the ledger wire is unbound: the upkeep line
   * renders the designed pending state, never a guessed number.
   */
  wonderUpkeep: Magnitude | null;
};

export type WonderComposerMaterialsInput = {
  /** `StructureDef.ConstructRubbleCost` / `ConstructIronworkCost` for the row. */
  needRubble: number;
  needIronwork: number;
  /** This sector's `RubbleStock` / `IronworkStock`. */
  haveRubble: number;
  haveIronwork: number;
};

export type WonderComposerUi = {
  searchText: string;
  selectedStructureId: string | null;
  /** Order-preserved — list order is what the filed `relicInstanceIds` carries. */
  pickedInstanceIds: string[];
  selectedSlotIndex: number | null;
  /** GG-15: order filed, awaiting End Turn commit. */
  filedPending: boolean;
};

export type WonderComposerFoldInput = {
  structures: WorldStructureDto[];
  slots: {
    slotIndex: number;
    slotTypeId: string;
    state: string;
    guardState: string;
    structureId: string | null;
  }[];
  sector: WonderComposerSectorInput;
  /** `null` while the reachability read has not answered. */
  reachability: WorldRelicReachabilityDto | null;
  cargoRows: CargoRowDto[];
  storageRows: SectorStorageRowDto[];
  /**
   * Stone-and-ironwork need-vs-have — `null` while no wire carries either
   * side (no catalog/sector wire projects rubble/ironwork today): the
   * materials line renders pending, never guessed, never hidden.
   */
  materials: WonderComposerMaterialsInput | null;
  ui: WonderComposerUi;
};

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

export type WonderCatalogRowVm = {
  structureId: string;
  /** Provisional identity from the catalog wire (seed `name`) — pass-through, never invented. */
  name: string;
  /** Closed: `Sector` | `Empire` (reserved scopes never appear — `Validate` refuses them). */
  scope: string;
  /** Closed: `Common` | `Unique`. */
  rarity: string;
  relicCost: number;
  buildTurns: number;
  requiredSlotKind: string;
  /** Live numerator for the cap line (`Unique` only; `Common` renders uncapped). */
  liveCount: number;
  existenceCap: number;
  /** `false` for `Common` by construction — the fold MUST NOT paint a cap gauge on it (GG-64). */
  capped: boolean;
  /** Unpickable-with-reason when the cap is reached (GG-55), never silently hidden. */
  buildable: boolean;
  blockerCopyKey: WonderComposerCopyKey | null;
  themeRefs: { scope: string; rarity: string };
  blessingCopyKey: Extract<WonderComposerCopyKey, "wonder.effect.sector" | "wonder.effect.empire">;
};

export type WonderLockedTeaserVm = {
  id: string;
  themeRef: string;
  copyKey: WonderComposerCopyKey;
};

export type WonderShelfCandidateVm = {
  instanceId: string;
  /** Shelf-consume by name: which sibling surface owns this row's truth. */
  where: "legion-cargo" | "sector-store";
  reachable: boolean;
  picked: boolean;
  /** Remote rows name the move that would bring them in reach (GG-55). */
  remoteCopyKey: WonderComposerCopyKey | null;
};

export type WonderSlotOptionVm = {
  slotIndex: number;
  slotTypeId: string;
  compatible: boolean;
  occupied: boolean;
  /** Incompatible slots name why (GG-55), never silently hidden. */
  reason: "occupied" | "wrong-kind" | "guarded" | "terminal" | null;
  selected: boolean;
};

export type WonderCostPlateVm = {
  structureId: string | null;
  picked: number;
  needed: number;
  nights: number | null;
  blessingCopyKey: WonderComposerCopyKey | null;
  materialsState: "ok" | "short" | "pending";
  upkeepState: "known" | "pending";
  /** Confirm disabled-with-reason until affordable AND `k == N` AND slot picked. */
  affordable: boolean;
  confirmBlockedReason:
    | "no-wonder"
    | "relic.shortfall"
    | "relic.over"
    | "materials.short"
    | "materials.pending"
    | "no-slot"
    | null;
};

export type WonderRefusalVm = {
  reason: string;
  copyKey: WonderComposerCopyKey;
  nextAction: WonderComposerCopyKey;
  /** Nothing consumed on any refusal — the player sentence, carried as data. */
  consumed: false;
};

export type WonderComposerVm = {
  catalogRows: WonderCatalogRowVm[];
  lockedTeasers: WonderLockedTeaserVm[];
  /** Structure ids on slots/catalog the fold cannot resolve — placeholder rule, never id-words. */
  unknownIds: string[];
  candidates: WonderShelfCandidateVm[];
  /** Full shelf behind one disclosure — the count the disclosure labels. */
  remoteCount: number;
  slots: WonderSlotOptionVm[];
  costPlate: WonderCostPlateVm;
  /** Last toggle refusal (over-N or remote pick) — count line, never a silent drop. */
  toggleRefusal: WonderRefusalVm | null;
  phase: "loading" | "error" | "empty" | "ready";
  filedPending: boolean;
};

// ---------------------------------------------------------------------------
// Fold
// ---------------------------------------------------------------------------

function matchesQuery(hay: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return true;
  return hay.toLowerCase().includes(q);
}

function blessingFor(scope: string): WonderCatalogRowVm["blessingCopyKey"] {
  return scope === "Empire" ? "wonder.effect.empire" : "wonder.effect.sector";
}

function lockedTeasers(): WonderLockedTeaserVm[] {
  return [
    { id: "locked:World", themeRef: "wonder-scope.World", copyKey: "wonder.locked.world" },
    { id: "locked:Multiverse", themeRef: "wonder-scope.Multiverse", copyKey: "wonder.locked.multiverse" },
    { id: "locked:DefensePower", themeRef: "wonder-scope.World", copyKey: "wonder.locked.defense" },
    { id: "locked:AuraGrant", themeRef: "wonder-scope.World", copyKey: "wonder.locked.aura" },
    { id: "locked:EmpireBuff", themeRef: "wonder-scope.World", copyKey: "wonder.locked.empire-buff" }
  ];
}

/**
 * Translate one wire token to authored-copy keys. Raw tokens never render
 * (GG-23). Unknown tokens map to `null` — the fold never invents copy.
 * `relic.duplicate` folds into the count-mismatch family (same
 * foundation-asks-N rule, admission-time shape).
 */
export function wonderRefusalVm(
  reason: string,
  ctx: { needed: number; picked: number; live?: number; cap?: number }
): WonderRefusalVm | null {
  const token: string = reason === WONDER_DUPLICATE_REASON ? "relic.count-mismatch" : reason;
  if (!(WONDER_REFUSAL_REASONS as readonly string[]).includes(token)) return null;
  const closed = token as WonderRefusalReason;
  void ctx;
  return {
    reason,
    copyKey: WONDER_REFUSAL_COPY[closed],
    nextAction: WONDER_REFUSAL_NEXT[closed],
    consumed: false
  };
}

export function foldWonderComposerVm(input: WonderComposerFoldInput): WonderComposerVm {
  const { structures, slots, sector, reachability, cargoRows, storageRows, materials, ui } = input;

  // — Catalog rows: Wonder rows only (wonderScope != null), search-filtered. —
  const wonderRows = structures.filter((s) => s.wonderScope != null);
  const catalogRows: WonderCatalogRowVm[] = wonderRows
    .filter((s) => matchesQuery(`${s.structureId} ${s.name}`, ui.searchText))
    .map((s) => {
      const scope = s.wonderScope ?? "";
      const rarity = s.wonderRarity ?? "";
      const capped = rarity === "Unique";
      const liveCount = scope === "Empire" ? sector.wonderLiveCountEmpire.value : sector.wonderLiveCountSector.value;
      const buildable = !capped || liveCount < s.existenceCap;
      return {
        structureId: s.structureId,
        name: s.name,
        scope,
        rarity,
        relicCost: s.relicCost,
        buildTurns: s.buildTurns,
        requiredSlotKind: s.requiredSlotKind,
        liveCount,
        existenceCap: s.existenceCap,
        capped,
        buildable,
        blockerCopyKey: buildable ? null : ("wonder.refused.cap-reached" as WonderComposerCopyKey),
        themeRefs: { scope: `wonder-scope.${scope}`, rarity: `wonder-rarity.${rarity}` },
        blessingCopyKey: blessingFor(scope)
      };
    });

  const knownIds = new Set(structures.map((s) => s.structureId));
  const unknownIds = slots
    .map((sl) => sl.structureId)
    .filter((id): id is string => id != null && !knownIds.has(id));

  // — Reachable-first join: cargo-tab + sector-store rows above the fold. —
  const reachableSet = new Set(reachability?.reachableInstanceIds ?? []);
  const shelfOrder: { instanceId: string; where: "legion-cargo" | "sector-store" }[] = [
    ...cargoRows
      .filter((r) => r.instanceId != null && r.instanceId.length > 0)
      .map((r) => ({ instanceId: r.instanceId as string, where: "legion-cargo" as const })),
    ...storageRows
      .filter((r) => r.instanceId != null && r.instanceId.length > 0)
      .map((r) => ({ instanceId: r.instanceId as string, where: "sector-store" as const }))
  ];
  // De-duplicate by instance id, first sighting wins (cargo before storage).
  const seen = new Set<string>();
  const deduped = shelfOrder.filter((c) => {
    if (seen.has(c.instanceId)) return false;
    seen.add(c.instanceId);
    return true;
  });
  const pickedSet = new Set(ui.pickedInstanceIds);
  const query = ui.searchText.trim().toLowerCase();
  const candidates: WonderShelfCandidateVm[] = deduped
    .filter((c) => query.length === 0 || c.instanceId.toLowerCase().includes(query))
    .map((c) => {
      const reachable = reachability == null ? false : reachableSet.has(c.instanceId);
      return {
        instanceId: c.instanceId,
        where: c.where,
        reachable,
        picked: pickedSet.has(c.instanceId),
        remoteCopyKey: reachable ? null : ("wonder.refused.not-reachable" as WonderComposerCopyKey)
      };
    })
    .sort((a, b) => Number(b.reachable) - Number(a.reachable));
  const remoteCount = candidates.filter((c) => !c.reachable).length;

  // — Slot compatibility: open plots of the held sector, legal pairs only. —
  const selected = catalogRows.find((r) => r.structureId === ui.selectedStructureId) ?? null;
  const slotOptions: WonderSlotOptionVm[] = slots.map((sl) => {
    const terminal = sl.state === "Ruined" || sl.state === "Depleted";
    const guarded = sl.guardState === "Intact";
    const occupied = sl.structureId != null;
    const open = !terminal && !guarded && !occupied;
    const compatible = open && selected != null && sl.slotTypeId === selected.requiredSlotKind;
    const reason: WonderSlotOptionVm["reason"] = terminal
      ? "terminal"
      : guarded
        ? "guarded"
        : occupied
          ? "occupied"
          : selected != null && sl.slotTypeId !== selected.requiredSlotKind
            ? "wrong-kind"
            : null;
    return {
      slotIndex: sl.slotIndex,
      slotTypeId: sl.slotTypeId,
      compatible,
      occupied,
      reason: compatible ? null : reason,
      selected: ui.selectedSlotIndex === sl.slotIndex && compatible
    };
  });

  // — Cost-plate + affordability gate. —
  const needed = selected?.relicCost ?? 0;
  const picked = ui.pickedInstanceIds.length;
  const pickedReachable = ui.pickedInstanceIds.filter((id) => reachableSet.has(id)).length;
  const materialsState: WonderCostPlateVm["materialsState"] =
    materials == null ? "pending" : materials.haveRubble >= materials.needRubble && materials.haveIronwork >= materials.needIronwork ? "ok" : "short";
  const upkeepState: WonderCostPlateVm["upkeepState"] = sector.wonderUpkeep == null ? "pending" : "known";
  let confirmBlockedReason: WonderCostPlateVm["confirmBlockedReason"] = null;
  if (selected == null) confirmBlockedReason = "no-wonder";
  else if (picked !== needed) confirmBlockedReason = picked < needed ? "relic.shortfall" : "relic.over";
  else if (pickedReachable !== needed) confirmBlockedReason = "relic.shortfall";
  else if (materialsState === "pending") confirmBlockedReason = "materials.pending";
  else if (materialsState === "short") confirmBlockedReason = "materials.short";
  else if (!slotOptions.some((o) => o.selected)) confirmBlockedReason = "no-slot";
  const costPlate: WonderCostPlateVm = {
    structureId: selected?.structureId ?? null,
    picked,
    needed,
    nights: selected?.buildTurns ?? null,
    blessingCopyKey: selected?.blessingCopyKey ?? null,
    materialsState,
    upkeepState,
    affordable: confirmBlockedReason == null,
    confirmBlockedReason
  };

  // — Last toggle refusal is derived by the caller via `toggleWonderRelic`
  // (pure helper below); the fold itself reports no stored refusal. —
  const hasFailedRead = reachability == null;
  const phase: WonderComposerVm["phase"] = hasFailedRead
    ? "error"
    : candidates.length === 0
      ? "empty"
      : "ready";

  return {
    catalogRows,
    lockedTeasers: lockedTeasers(),
    unknownIds,
    candidates,
    remoteCount,
    slots: slotOptions,
    costPlate,
    toggleRefusal: null,
    phase,
    filedPending: ui.filedPending
  };
}

/**
 * Pure toggle step: returns the next picked list (order-preserved) plus the
 * refusal when the toggle cannot land. Over-N picks and remote picks refuse
 * with the count line — never silently dropped.
 */
export function toggleWonderRelic(
  picked: string[],
  instanceId: string,
  needed: number,
  reachableSet: Set<string>
): { picked: string[]; refusal: WonderRefusalVm | null } {
  if (picked.includes(instanceId)) {
    return { picked: picked.filter((id) => id !== instanceId), refusal: null };
  }
  if (!reachableSet.has(instanceId)) {
    return {
      picked,
      refusal: wonderRefusalVm("relic.not-reachable", { needed, picked: picked.length })!
    };
  }
  if (picked.length >= needed) {
    return {
      picked,
      refusal: wonderRefusalVm("relic.count-mismatch", { needed, picked: picked.length })!
    };
  }
  return { picked: [...picked, instanceId], refusal: null };
}

/**
 * File the accepted pick through `wonder-rest`'s locked shape
 * (`PendingOrder.relicInstanceIds` → `WorldCommandRequest.relicInstanceIds`,
 * order-preserved). Blank/whitespace ids are mismatch, never cleaned —
 * the caller filters nothing; admission owns the refusal.
 */
export function wonderComposerToOrder(args: {
  commandId: string;
  entityId: string;
  sectorId: string;
  structureId: string;
  slotIndex: number;
  relicInstanceIds: string[];
  label: string;
}): {
  commandId: string;
  kind: "build";
  entityId: string;
  sectorId: string;
  slotIndex: number;
  structureId: string;
  relicInstanceIds: string[];
  label: string;
} {
  return {
    commandId: args.commandId,
    kind: "build",
    entityId: args.entityId,
    sectorId: args.sectorId,
    slotIndex: args.slotIndex,
    structureId: args.structureId,
    relicInstanceIds: [...args.relicInstanceIds],
    label: args.label
  };
}

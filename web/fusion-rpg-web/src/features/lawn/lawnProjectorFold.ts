/**
 * Pure projector fold: events / Snapshot observe → LawnViewModel.
 *
 * Living membership NEVER comes from PvzActivity rollups (W6-D / RT ban).
 * place ≠ living; place may only hint cell for an existing or later spawn.
 * FE `revision` is local-monotonic — never copied from MatchRuntime.revision.
 */

import type { EventEnvelope } from "@/lib/bus/types";
import {
  fitLawnExtent,
  floorLawnGrid,
  lawnGridFromPayload,
  readLawnCol
} from "./lawnGridExtent";
import {
  cellKey,
  emptyLawnViewModel,
  findOccupant,
  listOccupants,
  normalizePtr,
  type LawnEconomy,
  type LawnLastEvent,
  type LawnMarker,
  type LawnPhase,
  type LawnSide,
  type LawnTile,
  type LawnViewModel,
  type Occupant
} from "./lawnViewModel";
import { foldHudFromPayload, hudSnapshotsEqual } from "./foldActorHud";

type Payload = Record<string, unknown>;

type BindingIndex = {
  byPtr: Map<string, string>;
  byInstance: Map<string, string>;
};

type ProjectionModel = LawnViewModel & {
  [BINDINGS]?: BindingIndex;
  [LAST_EVENT_ID]?: number;
};

// The view-model type is shared with the Phaser surface. Keep recovery-only binding state on
// the fold's own model instead of widening that public type: this is observe state, not a second
// entity store, and the symbol survives the replace-by-spread rules used throughout this file.
const BINDINGS = Symbol("lawn-bindings");
const LAST_EVENT_ID = Symbol("lawn-last-event-id");
const EMPTY_BINDINGS: BindingIndex = {
  byPtr: new Map(),
  byInstance: new Map()
};

function cloneBindingIndex(index: BindingIndex | undefined): BindingIndex {
  if (!index) return { byPtr: new Map(), byInstance: new Map() };
  return { byPtr: new Map(index.byPtr), byInstance: new Map(index.byInstance) };
}

function bindingIndex(m: LawnViewModel): BindingIndex {
  return (m as ProjectionModel)[BINDINGS] ?? EMPTY_BINDINGS;
}

function lastEventId(m: LawnViewModel): number {
  return (m as ProjectionModel)[LAST_EVENT_ID] ?? 0;
}

function attachProjectionState<T extends LawnViewModel>(
  model: T,
  index: BindingIndex,
  eventId?: number
): T {
  const next = model as ProjectionModel;
  next[BINDINGS] = index;
  if (eventId != null) next[LAST_EVENT_ID] = eventId;
  return next as T;
}

function eventMatchKey(event: EventEnvelope): string | undefined {
  const direct = typeof event.matchKey === "string" ? event.matchKey.trim() : "";
  if (direct) return direct;
  const payload = asObj(event.payload);
  const match = asObj(payload.match);
  const nested = typeof match.matchKey === "string" ? match.matchKey.trim() : "";
  if (nested) return nested;
  const flat = typeof payload.matchKey === "string" ? payload.matchKey.trim() : "";
  return flat || undefined;
}

function bindingIdFor(m: LawnViewModel, ptr: string, payload: Payload): string | undefined {
  const explicit = str(payload.instanceId);
  if (explicit) return explicit;
  const index = bindingIndex(m);
  return index.byPtr.get(normalizePtr(ptr)) ?? index.byInstance.get(explicit ?? "");
}

function applyBindingIndexToOccupants(m: LawnViewModel): LawnViewModel {
  const index = bindingIndex(m);
  let changed = false;
  const apply = (occupant: Occupant): Occupant => {
    const nextId = index.byPtr.get(normalizePtr(occupant.ptr));
    if (occupant.instanceId === nextId) return occupant;
    changed = true;
    return { ...cloneOccupant(occupant), instanceId: nextId };
  };
  const cells = new Map<string, Occupant[]>();
  for (const [key, list] of m.cells) cells.set(key, list.map(apply));
  const orphans = m.orphans.map(apply);
  return changed ? { ...m, cells, orphans } : m;
}

const OBSERVE_CHIPS = new Set([
  "butter",
  "freeze",
  "cold",
  "poison",
  "hypno",
  "wither",
  "blight",
  "rot",
  "spark",
  "spore",
  "pact_mark",
  "leech",
  "expose",
  "shatter",
  "bond",
  "rally",
  "command",
  "charm_pulse"
]);
const CC_CHIPS = ["butter", "freeze", "cold", "poison"] as const;

function asObj(payload: unknown): Payload {
  return payload && typeof payload === "object" && !Array.isArray(payload)
    ? (payload as Payload)
    : {};
}

function str(v: unknown): string | undefined {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return undefined;
}

function num(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return undefined;
}

function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function bool(v: unknown): boolean | undefined {
  if (typeof v === "boolean") return v;
  return undefined;
}

function foldAtk(p: Payload, fallback?: number): number | undefined {
  return (
    num(p.attack) ??
    num(p.attackDamage) ??
    num(p.theAttackDamage) ??
    num(p.attackAfter) ??
    fallback
  );
}

/** Unity armor/shield only — never overlay defensePercent. */
function foldArmor(p: Payload, fallback?: number): number | undefined {
  return (
    num(p.armor) ??
    num(p.theFirstArmorHealth) ??
    num(p.theShieldHealth) ??
    fallback
  );
}

function foldArmorMax(p: Payload, fallback?: number): number | undefined {
  return (
    num(p.armorMax) ??
    num(p.theFirstArmorMaxHealth) ??
    num(p.theShieldMaxHealth) ??
    fallback
  );
}

/**
 * RPG shield resource (shield-system-spec.md §2.6) — rpgShield* keys ONLY, never the vanilla
 * theShieldHealth keys (those belong to armor). An explicit rpgShieldMax <= 0 CLEARS the bar
 * (the injector emits 0/0 after a break); absent keys keep the previous value.
 */
function foldRpgShield(p: Payload, fallback?: number): number | undefined {
  const max = num(p.rpgShieldMax);
  if (max != null) return max > 0 ? num(p.rpgShieldHp) : undefined;
  return num(p.rpgShieldHp) ?? fallback;
}

function foldRpgShieldMax(p: Payload, fallback?: number): number | undefined {
  const max = num(p.rpgShieldMax);
  if (max != null) return max > 0 ? max : undefined;
  return fallback;
}

function foldArmor2(p: Payload, fallback?: number): number | undefined {
  return num(p.armor2) ?? num(p.theSecondArmorHealth) ?? fallback;
}

function foldArmor2Max(p: Payload, fallback?: number): number | undefined {
  return num(p.armor2Max) ?? num(p.theSecondArmorMaxHealth) ?? fallback;
}

function foldSpeed(p: Payload, fallback?: number): number | undefined {
  return num(p.speed) ?? num(p.theSpeed) ?? fallback;
}

function foldInterval(p: Payload, fallback?: number): number | undefined {
  return num(p.interval) ?? num(p.thePlantAttackInterval) ?? fallback;
}

function cloneOccupant(o: Occupant): Occupant {
  return {
    ...o,
    statusChips: [...o.statusChips],
    flags: { ...o.flags },
    hud: o.hud
      ? {
          ...o.hud,
          identity: { ...o.hud.identity, flags: [...o.hud.identity.flags] },
          resources: o.hud.resources
            ? {
                ...o.hud.resources,
                shield: o.hud.resources.shield
                  ? {
                      ...o.hud.resources.shield,
                      stacks: o.hud.resources.shield.stacks.map((s) => ({ ...s }))
                    }
                  : undefined,
                meters: o.hud.resources.meters?.map((m) => ({ ...m }))
              }
            : undefined,
          statuses: o.hud.statuses.map((s) => ({ ...s })),
          overflow: { ...o.hud.overflow }
        }
      : undefined
  };
}

function cloneTiles(tiles: Map<string, LawnTile>): Map<string, LawnTile> {
  const next = new Map<string, LawnTile>();
  for (const [k, t] of tiles) next.set(k, { ...t });
  return next;
}

function cloneMarkers(markers: Map<string, LawnMarker>): Map<string, LawnMarker> {
  const next = new Map<string, LawnMarker>();
  for (const [k, t] of markers) next.set(k, { ...t });
  return next;
}

function cloneModel(m: LawnViewModel): LawnViewModel {
  const cells = new Map<string, Occupant[]>();
  for (const [k, list] of m.cells) {
    cells.set(k, list.map(cloneOccupant));
  }
  return attachProjectionState(
    {
      matchKey: m.matchKey,
      phase: m.phase,
      revision: m.revision,
      rows: m.rows,
      cols: m.cols,
      cells,
      orphans: m.orphans.map(cloneOccupant),
      tiles: cloneTiles(m.tiles),
      mowers: cloneMarkers(m.mowers),
      pets: cloneMarkers(m.pets),
      hand: [...m.hand],
      travelBuffs: [...m.travelBuffs],
      levelName: m.levelName,
      result: m.result,
      lastInvade: m.lastInvade ? { ...m.lastInvade } : undefined,
      lastAction: m.lastAction ? { ...m.lastAction } : undefined,
      lastHit: m.lastHit ? { ...m.lastHit } : undefined,
      economy: m.economy ? { ...m.economy } : undefined,
      matchCommander: m.matchCommander ? { ...m.matchCommander } : undefined,
      pendingLawnDeploy: m.pendingLawnDeploy
        ? {
            caseId: m.pendingLawnDeploy.caseId,
            eligibleInstanceIds: [...m.pendingLawnDeploy.eligibleInstanceIds]
          }
        : m.pendingLawnDeploy
    },
    cloneBindingIndex((m as ProjectionModel)[BINDINGS]),
    (m as ProjectionModel)[LAST_EVENT_ID]
  );
}

function bump(m: LawnViewModel): LawnViewModel {
  return { ...m, revision: m.revision + 1 };
}

/** Bump only when `after` is a different object than `before`. */
function maybeBump(before: LawnViewModel, after: LawnViewModel): LawnViewModel {
  return after === before ? before : bump(after);
}

function clearLiving(m: LawnViewModel): LawnViewModel {
  return attachProjectionState(
    {
      ...m,
      cells: new Map(),
      orphans: [],
      tiles: new Map(),
      mowers: new Map(),
      pets: new Map(),
      hand: [],
      matchCommander: undefined,
      pendingLawnDeploy: null
    },
    { byPtr: new Map(), byInstance: new Map() },
    lastEventId(m)
  );
}

function removeByPtr(m: LawnViewModel, ptr: string): { model: LawnViewModel; removed: boolean } {
  const want = normalizePtr(ptr);
  let removed = false;
  const cells = new Map<string, Occupant[]>();
  for (const [k, list] of m.cells) {
    const next = list.filter((o) => {
      if (normalizePtr(o.ptr) === want) {
        removed = true;
        return false;
      }
      return true;
    });
    if (next.length) cells.set(k, next);
  }
  const orphans = m.orphans.filter((o) => {
    if (normalizePtr(o.ptr) === want) {
      removed = true;
      return false;
    }
    return true;
  });
  return { model: { ...m, cells, orphans }, removed };
}

function placeOccupant(m: LawnViewModel, occ: Occupant): LawnViewModel {
  const without = removeByPtr(m, occ.ptr).model;
  const row = occ.row;
  const col = occ.col;
  if (row == null || col == null || col < 0) {
    return { ...without, orphans: [...without.orphans, occ] };
  }
  const key = cellKey(row, col);
  const prev = without.cells.get(key) ?? [];
  const cells = new Map(without.cells);
  cells.set(key, [...prev, occ]);
  const extent = fitLawnExtent(without.rows, without.cols, row, col);
  return { ...without, cells, rows: extent.rows, cols: extent.cols };
}

function upsertLiving(
  m: LawnViewModel,
  side: LawnSide,
  p: Payload,
  extras?: Partial<Occupant>
): LawnViewModel {
  const ptr = str(p.ptr);
  if (!ptr) return m;
  const existing = listOccupants(m).find((o) => normalizePtr(o.ptr) === normalizePtr(ptr));
  const typeId = num(p.type) ?? num(p.typeId) ?? existing?.typeId ?? -1;
  const row = num(p.row) ?? extras?.row ?? existing?.row;
  const col = readLawnCol(side, p) ?? extras?.col ?? existing?.col;
  const occ: Occupant = {
    ptr,
    side,
    typeId,
    typeName: str(p.typeName) ?? str(p.displayName) ?? existing?.typeName,
    row,
    col,
    hp: num(p.hp) ?? num(p.hpAfter) ?? num(p.thePlantHealth) ?? num(p.theHealth) ?? existing?.hp,
    maxHp:
      num(p.maxHp) ??
      num(p.maxAfter) ??
      num(p.thePlantMaxHealth) ??
      num(p.theMaxHealth) ??
      existing?.maxHp,
    atk: foldAtk(p, extras?.atk ?? existing?.atk),
    armor: foldArmor(p, extras?.armor ?? existing?.armor),
    armorMax: foldArmorMax(p, extras?.armorMax ?? existing?.armorMax),
    armor2: foldArmor2(p, extras?.armor2 ?? existing?.armor2),
    armor2Max: foldArmor2Max(p, extras?.armor2Max ?? existing?.armor2Max),
    rpgShield: foldRpgShield(p, existing?.rpgShield),
    rpgShieldMax: foldRpgShieldMax(p, existing?.rpgShieldMax),
    speed: foldSpeed(p, extras?.speed ?? existing?.speed),
    interval: foldInterval(p, extras?.interval ?? existing?.interval),
    statusChips: extras?.statusChips ?? existing?.statusChips ?? [],
    flags: {
      hypnotized: extras?.flags?.hypnotized ?? existing?.flags.hypnotized,
      ...extras?.flags
    },
    instanceId: extras?.instanceId ?? existing?.instanceId ?? bindingIdFor(m, ptr, p),
    hud: foldHudFromPayload(p, extras?.hud ?? existing?.hud)
  };
  return placeOccupant(m, occ);
}

/** Update stats on an existing living occupant only — never create membership. */
function updateExistingStats(m: LawnViewModel, p: Payload): LawnViewModel {
  const ptr = str(p.ptr);
  if (!ptr) return m;
  const existing = listOccupants(m).find((o) => normalizePtr(o.ptr) === normalizePtr(ptr));
  if (!existing) return m;
  const sideHint = str(p.side)?.toLowerCase();
  const side: LawnSide =
    sideHint === "zombie" || sideHint === "plant" ? sideHint : existing.side;
  return upsertLiving(m, side, p);
}

/** place may hint cell only — never creates living membership. */
function hintPlace(m: LawnViewModel, side: LawnSide, p: Payload): LawnViewModel {
  const ptr = str(p.ptr);
  const row = num(p.row);
  const col = readLawnCol(side, p);
  if (!ptr || row == null || col == null || col < 0) return m;
  const existing = listOccupants(m).find((o) => normalizePtr(o.ptr) === normalizePtr(ptr));
  if (!existing) return m;
  return placeOccupant(m, { ...cloneOccupant(existing), row, col, side: existing.side || side });
}

function applyHypno(m: LawnViewModel, p: Payload): LawnViewModel {
  const ptr = str(p.ptr) ?? str(p.zombiePtr);
  if (!ptr) return m;
  const existing = listOccupants(m).find((o) => normalizePtr(o.ptr) === normalizePtr(ptr));
  if (!existing) return m;
  const mind = bool(p.isMindControlled) ?? true;
  const nextChips = mind
    ? Array.from(new Set([...existing.statusChips, "hypno"]))
    : existing.statusChips.filter((c) => c !== "hypno");
  if (existing.flags.hypnotized === mind && nextChips.join() === existing.statusChips.join()) {
    return m;
  }
  return placeOccupant(m, {
    ...cloneOccupant(existing),
    flags: { ...existing.flags, hypnotized: mind },
    statusChips: nextChips
  });
}

function ptrsFrom(p: Payload): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (raw: unknown) => {
    const s = str(raw);
    if (!s) return;
    const key = normalizePtr(s);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(s);
  };
  if (Array.isArray(p.ptrs)) {
    for (const x of p.ptrs) push(x);
  }
  push(p.ptr);
  push(p.targetPtr);
  push(p.plantPtr);
  push(p.zombiePtr);
  return out;
}

/** Overlay all-zombie apply/clear emits empty targetPtr — chip every living zombie. */
function withAllZombiePtrsIfEmpty(m: LawnViewModel, p: Payload): Payload {
  if (ptrsFrom(p).length) return p;
  const ptrs = listOccupants(m)
    .filter((o) => o.side === "zombie")
    .map((o) => o.ptr);
  if (!ptrs.length) return p;
  return { ...p, ptrs };
}

function applyDebugStatusSnapshot(m: LawnViewModel, p: Payload): LawnViewModel {
  const instances = p.instances;
  if (!Array.isArray(instances)) return m;
  let next = m;
  let changed = false;
  for (const inst of instances) {
    if (!inst || typeof inst !== "object") continue;
    const rec = inst as Record<string, unknown>;
    const status = str(rec.statusId)?.toLowerCase();
    const ptr = str(rec.hostPtr);
    if (!status || !ptr || !OBSERVE_CHIPS.has(status)) continue;
    const after = applyStatusApplied(next, { ptr, status });
    if (after !== next) {
      next = after;
      changed = true;
    }
  }
  return changed ? next : m;
}

function applyStatusApplied(m: LawnViewModel, p: Payload): LawnViewModel {
  const status = str(p.status)?.toLowerCase();
  if (!status || !OBSERVE_CHIPS.has(status)) return m;
  const ptrs = ptrsFrom(p);
  if (!ptrs.length) return m;
  let next = m;
  let changed = false;
  for (const ptr of ptrs) {
    const existing = findOccupant(next, ptr);
    if (!existing) continue;
    if (status === "hypno") {
      const after = applyHypno(next, { ptr, isMindControlled: true });
      if (after !== next) {
        next = after;
        changed = true;
      }
      continue;
    }
    if (existing.statusChips.includes(status)) continue;
    next = placeOccupant(next, {
      ...cloneOccupant(existing),
      statusChips: [...existing.statusChips, status]
    });
    changed = true;
  }
  return changed ? next : m;
}

function applyStatusCleared(m: LawnViewModel, p: Payload): LawnViewModel {
  const status = str(p.status)?.toLowerCase();
  const ptrs = ptrsFrom(p);
  if (!ptrs.length) return m;
  let next = m;
  let changed = false;
  for (const ptr of ptrs) {
    const existing = findOccupant(next, ptr);
    if (!existing) continue;
    if (status === "hypno") {
      const after = applyHypno(next, { ptr, isMindControlled: false });
      if (after !== next) {
        next = after;
        changed = true;
      }
      continue;
    }
    const drop = new Set<string>(
      status && OBSERVE_CHIPS.has(status) ? [status] : CC_CHIPS
    );
    const nextChips = existing.statusChips.filter((c) => !drop.has(c));
    if (nextChips.join() === existing.statusChips.join()) continue;
    next = placeOccupant(next, {
      ...cloneOccupant(existing),
      statusChips: nextChips
    });
    changed = true;
  }
  return changed ? next : m;
}

function spawnZombieExtras(p: Payload): Partial<Occupant> | undefined {
  const mind = bool(p.isMindControlled);
  if (mind === true) {
    return { flags: { hypnotized: true }, statusChips: ["hypno"] };
  }
  if (mind === false) {
    return { flags: { hypnotized: false } };
  }
  return undefined;
}

function placeTile(m: LawnViewModel, tile: LawnTile): LawnViewModel {
  const tiles = cloneTiles(m.tiles);
  tiles.delete(normalizePtr(tile.ptr));
  tiles.set(normalizePtr(tile.ptr), tile);
  return { ...m, tiles };
}

function removeTile(m: LawnViewModel, ptr: string): { model: LawnViewModel; removed: boolean } {
  const want = normalizePtr(ptr);
  if (!m.tiles.has(want)) return { model: m, removed: false };
  const tiles = cloneTiles(m.tiles);
  tiles.delete(want);
  return { model: { ...m, tiles }, removed: true };
}

function applyGridPlace(m: LawnViewModel, p: Payload): LawnViewModel {
  const ptr = str(p.ptr);
  const row = num(p.row);
  const col = num(p.col);
  if (!ptr || row == null || col == null) return m;
  const typeId = num(p.type) ?? num(p.typeId) ?? -1;
  return placeTile(m, {
    ptr,
    typeId,
    typeName: str(p.typeName) ?? str(p.displayName),
    row,
    col
  });
}

function placeMarker(
  m: LawnViewModel,
  kind: LawnMarker["kind"],
  marker: LawnMarker
): LawnViewModel {
  const key = kind === "mower" ? "mowers" : "pets";
  const next = cloneMarkers(m[key]);
  next.delete(normalizePtr(marker.ptr));
  next.set(normalizePtr(marker.ptr), marker);
  return { ...m, [key]: next };
}

function removeMarker(
  m: LawnViewModel,
  kind: LawnMarker["kind"],
  ptr: string
): { model: LawnViewModel; removed: boolean } {
  const key = kind === "mower" ? "mowers" : "pets";
  const want = normalizePtr(ptr);
  if (!m[key].has(want)) return { model: m, removed: false };
  const next = cloneMarkers(m[key]);
  next.delete(want);
  return { model: { ...m, [key]: next }, removed: true };
}

function applyZombieStatus(m: LawnViewModel, p: Payload): LawnViewModel {
  const on = bool(p.on);
  const status = str(p.status)?.toLowerCase();
  if (on === false) {
    if (status === "warm") {
      const a = applyStatusCleared(m, { ...p, status: "freeze" });
      return applyStatusCleared(a, { ...p, status: "cold" });
    }
    return applyStatusCleared(m, p);
  }
  return applyStatusApplied(m, p);
}

function setFlag(
  m: LawnViewModel,
  ptr: string | undefined,
  flag: keyof Occupant["flags"]
): LawnViewModel {
  if (!ptr) return m;
  const existing = findOccupant(m, ptr);
  if (!existing) return m;
  if (existing.flags[flag]) return m;
  return placeOccupant(m, {
    ...cloneOccupant(existing),
    flags: { ...existing.flags, [flag]: true }
  });
}

function noteAction(m: LawnViewModel, kind: string, summary: string): LawnViewModel {
  const action: LawnLastEvent = { kind, summary };
  if (m.lastAction?.kind === action.kind && m.lastAction.summary === action.summary) return m;
  return { ...m, lastAction: action };
}

function copyChrome(src: LawnViewModel, dest: LawnViewModel): LawnViewModel {
  return attachProjectionState(
    {
      ...dest,
      tiles: cloneTiles(src.tiles),
      mowers: cloneMarkers(src.mowers),
      pets: cloneMarkers(src.pets),
      hand: [...src.hand],
      travelBuffs: [...src.travelBuffs],
      levelName: src.levelName,
      result: src.result,
      lastInvade: src.lastInvade ? { ...src.lastInvade } : undefined,
      lastAction: src.lastAction ? { ...src.lastAction } : undefined,
      lastHit: src.lastHit ? { ...src.lastHit } : undefined,
      economy: src.economy ? { ...src.economy } : undefined,
      matchCommander: src.matchCommander ? { ...src.matchCommander } : undefined,
      pendingLawnDeploy: src.pendingLawnDeploy
        ? {
            caseId: src.pendingLawnDeploy.caseId,
            eligibleInstanceIds: [...src.pendingLawnDeploy.eligibleInstanceIds]
          }
        : src.pendingLawnDeploy
    },
    cloneBindingIndex((src as ProjectionModel)[BINDINGS]),
    lastEventId(src)
  );
}

function applyEconomy(m: LawnViewModel, p: Payload): LawnViewModel {
  const economy: LawnEconomy = {
    ...m.economy,
    sun: num(p.sun) ?? num(p.theSun) ?? m.economy?.sun,
    money: num(p.money) ?? num(p.theMoney) ?? m.economy?.money,
    points: num(p.points) ?? m.economy?.points,
    wave: num(p.wave) ?? num(p.theWave) ?? m.economy?.wave,
    maxWave: num(p.maxWave) ?? num(p.theMaxWave) ?? m.economy?.maxWave,
    hugeWave: bool(p.hugeWave) ?? bool(p.isHugeWave) ?? m.economy?.hugeWave
  };
  const prev = m.economy;
  if (
    prev?.sun === economy.sun &&
    prev?.money === economy.money &&
    prev?.points === economy.points &&
    prev?.wave === economy.wave &&
    prev?.maxWave === economy.maxWave &&
    prev?.hugeWave === economy.hugeWave
  ) {
    return m;
  }
  return { ...m, economy };
}

function applyEconomyDelta(
  m: LawnViewModel,
  field: "sun" | "money" | "points",
  delta: number
): LawnViewModel {
  if (!Number.isFinite(delta) || delta === 0) return m;
  const prev = m.economy?.[field] ?? 0;
  return { ...m, economy: { ...m.economy, [field]: prev + delta } };
}

function parsePhase(raw: unknown): LawnPhase | undefined {
  if (typeof raw !== "string") return undefined;
  const s = raw.trim();
  if (s === "Ending") return "Idle";
  if (s === "Idle" || s === "Starting" || s === "InMatch" || s === "Paused") {
    return s;
  }
  return undefined;
}

function rawPhaseName(raw: unknown): string | undefined {
  return typeof raw === "string" ? raw.trim() : undefined;
}

function applyDebugActorHud(m: LawnViewModel, p: Payload): LawnViewModel {
  const ptr = str(p.ptr);
  if (!ptr) return m;
  const existing = findOccupant(m, ptr);
  if (!existing) return m;
  const hud = foldHudFromPayload(p, existing.hud);
  if (hudSnapshotsEqual(hud, existing.hud)) return m;
  return placeOccupant(m, { ...cloneOccupant(existing), hud });
}

/**
 * Replaces living set (RT-05 feed law when entity lists present).
 * Preserves grid tiles — board-stats is occupancy, not grid items.
 */
function livePhase(m: LawnViewModel): LawnPhase {
  if (m.phase === "Idle" || m.phase === "Starting" || m.phase === "Ending") return "InMatch";
  return m.phase;
}

function applyMowerSnapshot(m: LawnViewModel, p: Payload): LawnViewModel {
  if (!Array.isArray(p.mowers)) return m;
  let next: LawnViewModel = { ...m, mowers: new Map() };
  for (const raw of p.mowers) {
    const item = asObj(raw);
    const ptr = str(item.ptr);
    if (!ptr) continue;
    next = placeMarker(next, "mower", {
      ptr,
      kind: "mower",
      typeId: num(item.type) ?? num(item.typeId) ?? -1,
      typeName: str(item.typeName),
      row: num(item.row),
      col: num(item.col) ?? (num(item.row) == null ? undefined : 0),
      started: bool(item.started)
    });
  }
  return next;
}

function applyBoardStatsMembership(m: LawnViewModel, p: Payload): LawnViewModel {
  const plants = Array.isArray(p.plants) ? p.plants : null;
  const zombies = Array.isArray(p.zombies) ? p.zombies : null;
  if (!plants && !zombies) return m;

  const prevByPtr = new Map(
    listOccupants(m).map((o) => [normalizePtr(o.ptr), o] as const)
  );

  const observed = lawnGridFromPayload(p);
  const grid = floorLawnGrid(
    Math.max(m.rows, observed.rows ?? 0),
    Math.max(m.cols, observed.cols ?? 0)
  );
  let next = emptyLawnViewModel({
    rows: grid.rows,
    cols: grid.cols,
    phase: m.phase,
    revision: m.revision,
    matchKey: m.matchKey
  });
  next = copyChrome(m, next);

  const add = (side: LawnSide, raw: unknown) => {
    const item = asObj(raw);
    const ptr = str(item.ptr);
    if (!ptr) return;
    const prev = prevByPtr.get(normalizePtr(ptr));
    next = placeOccupant(next, {
      ptr,
      side,
      typeId: num(item.typeId) ?? num(item.type) ?? prev?.typeId ?? -1,
      typeName: prev?.typeName,
      row: num(item.row) ?? prev?.row,
      col: readLawnCol(side, item) ?? prev?.col,
      hp: num(item.hp) ?? prev?.hp,
      maxHp: num(item.maxHp) ?? prev?.maxHp,
      atk: foldAtk(item, prev?.atk),
      armor: foldArmor(item, prev?.armor),
      armorMax: foldArmorMax(item, prev?.armorMax),
      armor2: foldArmor2(item, prev?.armor2),
      armor2Max: foldArmor2Max(item, prev?.armor2Max),
      rpgShield: foldRpgShield(item, prev?.rpgShield),
      rpgShieldMax: foldRpgShieldMax(item, prev?.rpgShieldMax),
      speed: foldSpeed(item, prev?.speed),
      interval: foldInterval(item, prev?.interval),
      statusChips: prev?.statusChips ?? [],
      flags: prev?.flags ?? {},
      instanceId: prev?.instanceId,
      hud: foldHudFromPayload(item, prev?.hud)
    });
  };

  for (const x of plants ?? []) add("plant", x);
  for (const x of zombies ?? []) add("zombie", x);
  next = applyMowerSnapshot(next, p);
  const living = listOccupants(next).length;
  if (living > 0) {
    const phase = livePhase(next);
    if (phase !== next.phase) next = { ...next, phase };
  }
  return next;
}

/**
 * Overlay phase / bindings / optional entities from debug.snapshot.
 * Never copies MatchRuntime.revision into FE revision (local-monotonic only).
 */
function applyDebugSnapshot(m: LawnViewModel, p: Payload): LawnViewModel {
  const match = asObj(p.match);
  let next = { ...m };
  let changed = false;

  const rawPhase = rawPhaseName(match.phase) ?? rawPhaseName(p.matchPhase);
  const phase = parsePhase(rawPhase) ?? next.phase;
  const matchKey = str(match.matchKey) || str(p.matchKey) || next.matchKey;
  if (rawPhase === "Ending") {
    next = clearLiving({ ...next, phase: "Idle", matchKey });
    changed = true;
  } else if (phase !== m.phase || matchKey !== m.matchKey) {
    next = { ...next, phase, matchKey };
    changed = true;
  }

  const observed = lawnGridFromPayload({ ...p, ...match });
  const grid = floorLawnGrid(
    Math.max(next.rows, observed.rows ?? 0),
    Math.max(next.cols, observed.cols ?? 0)
  );
  if (grid.rows !== next.rows || grid.cols !== next.cols) {
    next = { ...next, rows: grid.rows, cols: grid.cols };
    changed = true;
  }

  // Bindings are a full authoritative set whenever the field is present. An empty array is
  // meaningful: it clears ids left over from an earlier ring, rather than meaning "no update".
  const rawBindings = Array.isArray(match.bindings) ? match.bindings : null;
  if (rawBindings && rawPhase !== "Ending") {
    const index: BindingIndex = { byPtr: new Map(), byInstance: new Map() };
    for (const raw of rawBindings) {
      const binding = asObj(raw);
      const instanceId = str(binding.instanceId);
      if (!instanceId) continue;
      const phase = str(binding.phase)?.toLowerCase();
      if (phase === "cleared") continue;
      index.byInstance.set(instanceId, instanceId);
      const ptr = str(binding.ptr);
      if (ptr) index.byPtr.set(normalizePtr(ptr), instanceId);
    }
    next = attachProjectionState({ ...next }, index, lastEventId(next));
    next = applyBindingIndexToOccupants(next);
    changed = true;
  }

  // `entities: []` is also an authoritative empty membership. Rebuild for an empty array;
  // absence of the field keeps event-folded membership intact.
  if (Array.isArray(match.entities) && rawPhase !== "Ending") {
    const prevByPtr = new Map(
      listOccupants(next).map((o) => [normalizePtr(o.ptr), o] as const)
    );
    let rebuilt = emptyLawnViewModel({
      rows: next.rows,
      cols: next.cols,
      phase: next.phase,
      revision: next.revision,
      matchKey: next.matchKey
    });
    rebuilt = copyChrome(next, rebuilt);
    for (const raw of match.entities) {
      const entity = asObj(raw);
      const ptr = str(entity.ptr) ?? str(entity.Ptr);
      if (!ptr) continue;
      const sideRaw = str(entity.side) ?? str(entity.Side) ?? "";
      const side: LawnSide =
        sideRaw.toLowerCase().includes("zombie") || sideRaw === "1" ? "zombie" : "plant";
      const previous = prevByPtr.get(normalizePtr(ptr));
      rebuilt = placeOccupant(rebuilt, {
        ptr,
        side,
        typeId: num(entity.typeId) ?? num(entity.TypeId) ?? previous?.typeId ?? -1,
        typeName: previous?.typeName,
        row: previous?.row,
        col: previous?.col,
        hp: previous?.hp,
        maxHp: previous?.maxHp,
        atk: foldAtk(entity, previous?.atk),
        armor: foldArmor(entity, previous?.armor),
        armorMax: foldArmorMax(entity, previous?.armorMax),
        armor2: foldArmor2(entity, previous?.armor2),
        armor2Max: foldArmor2Max(entity, previous?.armor2Max),
        rpgShield: foldRpgShield(entity, previous?.rpgShield),
        rpgShieldMax: foldRpgShieldMax(entity, previous?.rpgShieldMax),
        speed: foldSpeed(entity, previous?.speed),
        interval: foldInterval(entity, previous?.interval),
        statusChips: previous?.statusChips ?? [],
        flags: previous?.flags ?? {},
        instanceId: rawBindings
          ? bindingIdFor(rebuilt, ptr, entity)
          : previous?.instanceId ?? bindingIdFor(rebuilt, ptr, entity),
        hud: foldHudFromPayload(entity, previous?.hud) ?? previous?.hud
      });
    }
    next = applyBindingIndexToOccupants(rebuilt);
    changed = true;
  }

  const commander = asObj(match.commander);
  const leadingName = str(commander.leadingCommanderDisplayName);
  if (leadingName) {
    const auraName = str(commander.activeAuraDisplayName) ?? null;
    const leadingId = str(commander.leadingCommanderId) ?? "commander:dave";
    const nextCommander = { id: leadingId, displayName: leadingName, auraDisplayName: auraName };
    if (
      next.matchCommander?.id !== nextCommander.id ||
      next.matchCommander?.displayName !== nextCommander.displayName ||
      next.matchCommander?.auraDisplayName !== nextCommander.auraDisplayName
    ) {
      next = { ...next, matchCommander: nextCommander };
      changed = true;
    }
  } else if (next.matchCommander != null) {
    next = { ...next, matchCommander: undefined };
    changed = true;
  }

  return changed ? next : m;
}

function applyOne(m: LawnViewModel, e: EventEnvelope): LawnViewModel {
  const incomingMatchKey = eventMatchKey(e);
  if (incomingMatchKey && m.matchKey && incomingMatchKey !== m.matchKey) {
    // A lifecycle start can open a new scope only after the current scope has ended. A delayed
    // start, a foreign snapshot, or any other event is data to ignore, never a reason to retarget
    // the visible lawn.
    const eventId = e.id ?? 0;
    const previousEventId = lastEventId(m);
    const currentScopeOpen = m.phase !== "Idle";
    if (
      e.kind !== "board.start" ||
      currentScopeOpen ||
      (eventId > 0 && previousEventId > 0 && eventId <= previousEventId)
    ) {
      return m;
    }
  }

  const next = applyOneUnscoped(m, e);
  if (e.id != null && e.id > lastEventId(next)) {
    attachProjectionState(next, bindingIndex(next), e.id);
  }
  return next;
}

function applyOneUnscoped(m: LawnViewModel, e: EventEnvelope): LawnViewModel {
  const kind = e.kind;
  const p = asObj(e.payload);
  const incomingMatchKey = eventMatchKey(e);
  if (incomingMatchKey && !m.matchKey) {
    m = { ...m, matchKey: incomingMatchKey };
  }

  switch (kind) {
    case "board.start": {
      const observed = lawnGridFromPayload(p);
      const grid = floorLawnGrid(observed.rows, observed.cols);
      return bump({
        ...emptyLawnViewModel({
          rows: grid.rows,
          cols: grid.cols,
          phase: "Starting",
          matchKey: incomingMatchKey ?? m.matchKey
        }),
        revision: m.revision
      });
    }
    case "match.pause":
      return m.phase === "Paused" ? m : bump({ ...m, phase: "Paused" });
    case "match.resume":
      return m.phase === "InMatch" ? m : bump({ ...m, phase: "InMatch" });
    case "board.end": {
      if (
        m.phase === "Idle" &&
        listOccupants(m).length === 0 &&
        m.tiles.size === 0 &&
        m.mowers.size === 0
      ) {
        return m;
      }
      return bump(clearLiving({ ...m, phase: "Idle" }));
    }
    case "match.result": {
      const result = str(p.result) ?? m.result;
      if (
        m.phase === "Idle" &&
        listOccupants(m).length === 0 &&
        m.tiles.size === 0 &&
        m.result === result
      ) {
        return m;
      }
      return bump(clearLiving({ ...m, phase: "Idle", result }));
    }
    case "match.win": {
      if (
        m.result === "victory" &&
        m.phase === "Idle" &&
        listOccupants(m).length === 0 &&
        m.tiles.size === 0
      ) {
        return m;
      }
      return bump(clearLiving({ ...m, phase: "Idle", result: "victory" }));
    }
    case "match.lose": {
      if (
        m.result === "defeat" &&
        m.phase === "Idle" &&
        listOccupants(m).length === 0 &&
        m.tiles.size === 0
      ) {
        return m;
      }
      return bump(clearLiving({ ...m, phase: "Idle", result: "defeat" }));
    }
    case "match.invade": {
      const ptr = str(p.zombiePtr) ?? str(p.ptr);
      if (!ptr) return m;
      return bump({
        ...m,
        lastInvade: {
          ptr,
          typeId: num(p.type) ?? num(p.typeId),
          typeName: str(p.typeName)
        }
      });
    }
    case "lawn-deploy-event.fired": {
      const caseId = str(p.caseId);
      if (!caseId) return m;
      return bump({
        ...m,
        pendingLawnDeploy: { caseId, eligibleInstanceIds: strArray(p.eligibleInstanceIds) }
      });
    }
    case "match.restart":
      return maybeBump(m, noteAction(m, kind, "restart"));
    case "entity.stats":
      return maybeBump(m, updateExistingStats(m, p));
    case "plant.spawn": {
      const next = upsertLiving(
        { ...m, phase: livePhase(m) },
        "plant",
        p
      );
      return maybeBump(m, next);
    }
    case "zombie.spawn": {
      const next = upsertLiving(
        { ...m, phase: livePhase(m) },
        "zombie",
        p,
        spawnZombieExtras(p)
      );
      return maybeBump(m, next);
    }
    case "plant.die": {
      const ptr = str(p.ptr);
      if (!ptr) return m;
      const { model, removed } = removeByPtr(m, ptr);
      return removed ? bump(model) : m;
    }
    case "zombie.die": {
      const ptr = str(p.ptr) ?? str(p.deadPtr);
      if (!ptr) return m;
      const { model, removed } = removeByPtr(m, ptr);
      return removed ? bump(model) : m;
    }
    case "plant.place":
      return maybeBump(m, hintPlace(m, "plant", p));
    case "zombie.place":
      return maybeBump(m, hintPlace(m, "zombie", p));
    case "zombie.hypno":
      return maybeBump(m, applyHypno(m, p));
    case "debug.status.applied":
      return maybeBump(m, applyStatusApplied(m, p));
    case "debug.status":
      return maybeBump(m, applyDebugStatusSnapshot(m, p));
    case "debug.status.resisted":
      return bump(m);
    case "pvz.status.apply":
      return maybeBump(m, applyStatusApplied(m, withAllZombiePtrsIfEmpty(m, p)));
    case "debug.status.cleared":
      return maybeBump(m, applyStatusCleared(m, p));
    case "pvz.status.clear":
      return maybeBump(m, applyStatusCleared(m, withAllZombiePtrsIfEmpty(m, p)));
    case "zombie.status":
      return maybeBump(m, applyZombieStatus(m, p));
    case "grid.place":
      return maybeBump(m, applyGridPlace(m, p));
    case "grid.die": {
      const ptr = str(p.ptr);
      if (!ptr) return m;
      const { model, removed } = removeTile(m, ptr);
      return removed ? bump(model) : m;
    }
    case "plant.mix": {
      const resultPtr = str(p.plantPtr) ?? str(p.ptr);
      let next = resultPtr ? setFlag(m, resultPtr, "mixed") : m;
      const usedRaw = p.usedPtrs;
      const usedList = Array.isArray(usedRaw)
        ? usedRaw
        : typeof usedRaw === "string"
          ? [usedRaw]
          : [];
      const resultKey = resultPtr ? normalizePtr(resultPtr) : "";
      for (const raw of usedList) {
        const ptr =
          typeof raw === "string" ? raw.trim() : str(asObj(raw).ptr);
        if (!ptr) continue;
        if (resultKey && normalizePtr(ptr) === resultKey) continue;
        const gone = removeByPtr(next, ptr);
        if (gone.removed) next = gone.model;
      }
      return maybeBump(m, next);
    }
    case "plant.unique":
      return maybeBump(m, setFlag(m, str(p.plantPtr) ?? str(p.ptr), "unique"));
    case "plant.crash": {
      const ptr = str(p.ptr);
      if (!ptr) return m;
      const existing = findOccupant(m, ptr);
      if (!existing) return m;
      const chips = existing.statusChips.includes("crash")
        ? existing.statusChips
        : [...existing.statusChips, "crash"];
      if (existing.flags.crashed && chips.join() === existing.statusChips.join()) return m;
      return placeOccupant(m, {
        ...cloneOccupant(existing),
        flags: { ...existing.flags, crashed: true },
        statusChips: chips
      });
    }
    case "mower.place": {
      const ptr = str(p.ptr);
      if (!ptr) return m;
      const row = num(p.row);
      return maybeBump(
        m,
        placeMarker(m, "mower", {
          ptr,
          kind: "mower",
          typeId: num(p.type) ?? num(p.typeId) ?? -1,
          typeName: str(p.typeName),
          row,
          col: row == null ? undefined : 0
        })
      );
    }
    case "mower.start": {
      const ptr = str(p.ptr);
      if (!ptr) return m;
      const prev = m.mowers.get(normalizePtr(ptr));
      if (!prev) return m;
      if (prev.started) return m;
      return maybeBump(m, placeMarker(m, "mower", { ...prev, started: true }));
    }
    case "mower.die": {
      const ptr = str(p.ptr);
      if (!ptr) return m;
      const { model, removed } = removeMarker(m, "mower", ptr);
      return removed ? bump(model) : m;
    }
    case "pet.spawn": {
      const ptr = str(p.ptr);
      if (!ptr) return m;
      return maybeBump(
        m,
        placeMarker(m, "pet", {
          ptr,
          kind: "pet",
          typeId: num(p.type) ?? num(p.typeId) ?? -1,
          typeName: str(p.typeName),
          row: num(p.row),
          col: num(p.col)
        })
      );
    }
    case "sun.spend":
      return maybeBump(m, applyEconomyDelta(m, "sun", -(num(p.count) ?? 0)));
    case "sun.gain":
    case "sun.refund":
      return maybeBump(m, applyEconomyDelta(m, "sun", num(p.count) ?? 0));
    case "money.spend":
      return maybeBump(m, applyEconomyDelta(m, "money", -(num(p.value) ?? num(p.count) ?? 0)));
    case "money.gain":
      return maybeBump(m, applyEconomyDelta(m, "money", num(p.count) ?? num(p.value) ?? 0));
    case "points.gain":
      return maybeBump(m, applyEconomyDelta(m, "points", num(p.count) ?? 0));
    case "wave.spawn":
      return maybeBump(m, applyEconomy(m, { ...p, wave: num(p.wave) }));
    case "wave.huge":
      return maybeBump(m, applyEconomy(m, { ...p, hugeWave: true, wave: num(p.wave) }));
    case "level.name": {
      const levelName = str(p.levelName);
      if (!levelName || m.levelName === levelName) return m;
      return bump({ ...m, levelName });
    }
    case "card.bank": {
      const card = {
        typeId: num(p.plantType) ?? num(p.type) ?? num(p.typeId),
        typeName: str(p.typeName),
        side: str(p.side)
      };
      const hand = [...m.hand, card].slice(-24);
      return bump({ ...m, hand, lastAction: { kind, summary: card.typeName ?? "card.bank" } });
    }
    case "card.pick":
    case "card.place":
    case "card.use":
    case "card.drop":
      return maybeBump(
        m,
        noteAction(m, kind, str(p.typeName) ?? str(p.plantType) ?? kind)
      );
    case "travel.buff": {
      const buff = { kind: str(p.kind) ?? "buff", name: str(p.name) ?? "" };
      const travelBuffs = [...m.travelBuffs, buff].slice(-24);
      return bump({ ...m, travelBuffs, lastAction: { kind, summary: `${buff.kind} ${buff.name}` } });
    }
    case "travel.start":
    case "travel.pick":
      return maybeBump(m, noteAction(m, kind, str(p.name) ?? kind));
    case "stat.applied":
      return maybeBump(m, updateExistingStats(m, p));
    case "combat.hit":
    case "combat.hitland": {
      const lastHit = {
        side: str(p.side),
        damage: num(p.damage),
        targetPtr: str(p.targetPtr),
        source: str(p.source) ?? kind
      };
      if (
        m.lastHit?.side === lastHit.side &&
        m.lastHit?.damage === lastHit.damage &&
        m.lastHit?.targetPtr === lastHit.targetPtr &&
        m.lastHit?.source === lastHit.source
      ) {
        return m;
      }
      return { ...m, lastHit };
    }
    case "plant.shovel":
    case "plant.unfuse":
    case "plant.glove":
    case "item.fertilize":
    case "item.hammer":
    case "item.wheel":
    case "item.bucket":
    case "almanac.select":
    case "present.open":
    case "prize.spawn":
    case "prize.click":
    case "board.modifiers":
      return maybeBump(
        m,
        noteAction(m, kind, str(p.typeName) ?? str(p.ptr) ?? kind)
      );
    case "board.economy":
    case "wave.change":
      return maybeBump(m, applyEconomy(m, p));
    case "debug.board-stats":
      return maybeBump(m, applyBoardStatsMembership(m, p));
    case "debug.actor-hud":
      return maybeBump(m, applyDebugActorHud(m, p));
    case "debug.snapshot":
      return maybeBump(m, applyDebugSnapshot(m, p));
    default:
      return m;
  }
}

/**
 * Fold events oldest-first.
 * Living membership is never derived from Activity rollups.
 */
export function foldLawnEvents(
  events: readonly EventEnvelope[],
  seed?: LawnViewModel
): LawnViewModel {
  let model = cloneModel(seed ?? emptyLawnViewModel());
  const ordered = events.every((e) => e.id != null)
    ? [...events].sort((a, b) => (a.id ?? 0) - (b.id ?? 0))
    : events;
  for (const e of ordered) {
    model = applyOne(model, e);
  }
  return model;
}

/** Convenience: a hub ring is newest-first; identified rows are sorted by their durable id. */
export function foldLawnFromRing(
  ringNewestFirst: readonly EventEnvelope[],
  seed?: LawnViewModel
): LawnViewModel {
  const chrono = ringNewestFirst.every((e) => e.id != null)
    ? [...ringNewestFirst].sort((a, b) => (a.id ?? 0) - (b.id ?? 0))
    : [...ringNewestFirst].reverse();
  return foldLawnEvents(chrono, seed);
}

/** Clear FE selection when ptr no longer in model (RT-01 / RT-04). */
export function selectionStillValid(
  model: LawnViewModel,
  selectedPtr: string | undefined
): boolean {
  if (!selectedPtr) return false;
  const want = normalizePtr(selectedPtr);
  if (listOccupants(model).some((o) => normalizePtr(o.ptr) === want)) return true;
  return model.tiles.has(want) || model.mowers.has(want) || model.pets.has(want);
}

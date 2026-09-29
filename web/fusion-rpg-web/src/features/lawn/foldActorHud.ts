/** Pure fold: validate injector actorHud wire → Occupant.hud (actor-hud-fold spec). */

import type { ActorHudSnapshot, ActorHudTier, MagnitudeBand } from "./lawnViewModel";

const TIERS = new Set<ActorHudTier>(["normal", "elite", "boss", "unique"]);
const BANDS = new Set<MagnitudeBand>(["low", "mid", "high"]);

type ShieldWire = NonNullable<NonNullable<ActorHudSnapshot["resources"]>["shield"]>;

function asObj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function num(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return undefined;
}

function str(v: unknown): string | undefined {
  if (typeof v === "string" && v.trim()) return v.trim();
  return undefined;
}

function strArray(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const out: string[] = [];
  for (const item of v) {
    const s = str(item);
    if (!s) return null;
    out.push(s);
  }
  return out;
}

function foldShield(raw: unknown): ShieldWire | undefined {
  const o = asObj(raw);
  if (!o) return undefined;
  const hp = num(o.hp);
  const max = num(o.max);
  if (hp == null || max == null || max <= 0) return undefined;
  const stacksRaw = o.stacks;
  if (!Array.isArray(stacksRaw)) return undefined;
  const stacks: ShieldWire["stacks"] = [];
  for (const item of stacksRaw) {
    const stack = asObj(item);
    const element = str(stack?.element);
    const shp = num(stack?.hp);
    const smax = num(stack?.max);
    if (!element || shp == null || smax == null) return undefined;
    stacks.push({ element, hp: shp, max: smax });
  }
  return { hp, max, stacks };
}

function foldResources(raw: unknown): ActorHudSnapshot["resources"] | undefined {
  const o = asObj(raw);
  if (!o) return undefined;
  const resources: NonNullable<ActorHudSnapshot["resources"]> = {};
  if (o.shield != null) {
    const shield = foldShield(o.shield);
    if (shield) resources.shield = shield;
  }
  const sliver = asObj(o.hpSliver);
  const ratio = num(sliver?.ratio);
  if (ratio != null) resources.hpSliver = { ratio };
  if (Array.isArray(o.meters)) {
    const meters: { id: string; ratio: number }[] = [];
    for (const item of o.meters) {
      const m = asObj(item);
      const id = str(m?.id);
      const mr = num(m?.ratio);
      if (!id || mr == null) return undefined;
      meters.push({ id, ratio: mr });
    }
    if (meters.length) resources.meters = meters;
  }
  return Object.keys(resources).length ? resources : undefined;
}

function foldStatuses(raw: unknown): ActorHudSnapshot["statuses"] | null {
  if (!Array.isArray(raw)) return null;
  const out: ActorHudSnapshot["statuses"] = [];
  for (const item of raw) {
    const o = asObj(item);
    const id = str(o?.id);
    const band = str(o?.magnitudeBand) as MagnitudeBand | undefined;
    if (!id || !band || !BANDS.has(band)) return null;
    if (typeof o?.cc !== "boolean") return null;
    out.push({ id, cc: o.cc, magnitudeBand: band });
  }
  return out;
}

/** Validate wire actorHud; malformed payloads return undefined (no invented defaults). */
export function foldActorHud(raw: unknown): ActorHudSnapshot | undefined {
  const root = asObj(raw);
  if (!root) return undefined;

  const identityRaw = asObj(root.identity);
  const tier = str(identityRaw?.tier) as ActorHudTier | undefined;
  const role = str(identityRaw?.role);
  const flags = strArray(identityRaw?.flags);
  if (!tier || !TIERS.has(tier) || !role || flags == null) return undefined;

  const statuses = foldStatuses(root.statuses);
  if (!statuses) return undefined;

  const overflowRaw = asObj(root.overflow);
  const statusCount = num(overflowRaw?.statusCount);
  if (statusCount == null || statusCount < 0) return undefined;

  const levelBand = num(identityRaw?.levelBand);
  const resources = foldResources(root.resources);
  const elementsRaw = asObj(root.elements);
  const primary = str(elementsRaw?.primary);
  const secondary = str(elementsRaw?.secondary);
  if (elementsRaw && (!primary || (elementsRaw.secondary != null && !secondary))) return undefined;

  let snapshot: ActorHudSnapshot = {
    identity: {
      tier,
      role,
      flags,
      ...(levelBand != null ? { levelBand } : {})
    },
    ...(primary ? { elements: { primary, ...(secondary ? { secondary } : {}) } } : {}),
    ...(resources ? { resources } : {}),
    statuses,
    overflow: { statusCount }
  };

  snapshot = clearEmptyShield(snapshot);
  return snapshot;
}

/** When shield max or hp is 0, drop the resource shield row (Unity display parity). */
export function clearEmptyShield(hud: ActorHudSnapshot): ActorHudSnapshot {
  const shield = hud.resources?.shield;
  if (!shield || shield.max <= 0 || shield.hp <= 0) {
    if (!hud.resources) return hud;
    const { shield: _removed, ...rest } = hud.resources;
    const nextResources = Object.keys(rest).length ? rest : undefined;
    return { ...hud, resources: nextResources };
  }
  return hud;
}

/** Merge actorHud from observe payload; absent key preserves fallback. */
export function foldHudFromPayload(
  payload: Record<string, unknown>,
  fallback?: ActorHudSnapshot
): ActorHudSnapshot | undefined {
  if (!Object.prototype.hasOwnProperty.call(payload, "actorHud")) return fallback;
  if (payload.actorHud == null) return undefined;
  return foldActorHud(payload.actorHud);
}

/** Shallow content compare for revision dedupe on debug.actor-hud patches. */
export function hudSnapshotsEqual(
  a: ActorHudSnapshot | undefined,
  b: ActorHudSnapshot | undefined
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.identity.tier !== b.identity.tier) return false;
  if (a.identity.role !== b.identity.role) return false;
  if (a.identity.levelBand !== b.identity.levelBand) return false;
  if (a.elements?.primary !== b.elements?.primary || a.elements?.secondary !== b.elements?.secondary) return false;
  if (a.overflow.statusCount !== b.overflow.statusCount) return false;
  if (a.statuses.length !== b.statuses.length) return false;
  for (let i = 0; i < a.statuses.length; i++) {
    const sa = a.statuses[i];
    const sb = b.statuses[i];
    if (sa.id !== sb.id || sa.cc !== sb.cc || sa.magnitudeBand !== sb.magnitudeBand) return false;
  }
  const shA = a.resources?.shield;
  const shB = b.resources?.shield;
  if (!shA && !shB) return true;
  if (!shA || !shB) return false;
  return shA.hp === shB.hp && shA.max === shB.max && shA.stacks.length === shB.stacks.length;
}

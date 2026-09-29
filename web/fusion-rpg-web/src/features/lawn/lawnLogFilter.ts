import type { EventEnvelope } from "@/lib/bus/types";
import type { LawnLastHit } from "./lawnViewModel";

export function isCombatHitKind(kind: string | undefined): boolean {
  return kind === "combat.hit" || kind === "combat.hitland";
}

export function lastHitFromEnvelope(
  e: EventEnvelope | null | undefined
): LawnLastHit | null {
  if (!e || !isCombatHitKind(e.kind)) return null;
  const p =
    e.payload && typeof e.payload === "object"
      ? (e.payload as Record<string, unknown>)
      : {};
  return {
    side: typeof p.side === "string" ? p.side : undefined,
    damage: typeof p.damage === "number" ? p.damage : undefined,
    targetPtr: typeof p.targetPtr === "string" ? p.targetPtr : undefined,
    source: typeof p.source === "string" ? p.source : e.kind
  };
}

export function formatLastHit(hit: LawnLastHit | null | undefined): string {
  if (!hit) return "—";
  return `${hit.source ?? "hit"} dmg ${hit.damage ?? "?"} → ${hit.targetPtr ?? "?"}`;
}

/** Mirror lawnViewModel.normalizePtr / PtrEntityRegistry keying. */
export function normalizePtr(ptr: string): string {
  return ptr.trim().toUpperCase();
}

export type BoardEntityCore = {
  ptr?: string;
  row?: number;
  col?: number;
  actorHud?: {
    resources?: { shield?: { hp?: number; max?: number } };
    statuses?: unknown[];
  };
};

export function parseBoardStatsPayload(payload: unknown): Record<string, unknown> | null {
  if (!payload) return null;
  if (typeof payload === "string") {
    try {
      return JSON.parse(payload) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  if (typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return null;
}

export function findActorHudEntity(
  payload: Record<string, unknown>,
  targetPtr: string
): BoardEntityCore | null {
  const want = normalizePtr(targetPtr);
  for (const side of ["zombies", "plants"] as const) {
    const list = payload[side];
    if (!Array.isArray(list)) continue;
    for (const raw of list) {
      if (!raw || typeof raw !== "object") continue;
      const ent = raw as BoardEntityCore;
      if (ent.ptr && normalizePtr(ent.ptr) === want) return ent;
    }
  }
  return null;
}

export function entityMeetsActorHudPollCriteria(
  ent: BoardEntityCore,
  minStatuses: number
): boolean {
  if (!ent.actorHud) return false;
  const shield = ent.actorHud.resources?.shield;
  const statuses = ent.actorHud.statuses ?? [];
  return Boolean(shield && (shield.hp ?? 0) > 0 && statuses.length >= minStatuses);
}

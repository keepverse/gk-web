/** IDs the user is editing — CheatsUpdated / poll must not overwrite these floats. */
const dirtyFloatIds = new Set<string>();

export function markCheatFloatDirty(id: string) {
  dirtyFloatIds.add(id);
}

export function clearCheatFloatDirty(id?: string) {
  if (id) dirtyFloatIds.delete(id);
  else dirtyFloatIds.clear();
}

export function isCheatFloatDirty(id: string) {
  return dirtyFloatIds.has(id);
}

export function hasCheatFloatDirty() {
  return dirtyFloatIds.size > 0;
}

export function mergeCheatsPreservingDirty(
  remote: Record<string, unknown>,
  local: { entries?: { id: string; floatValue?: number; enabled?: boolean; kind?: string }[] } | undefined
): Record<string, unknown> {
  if (!local?.entries?.length || dirtyFloatIds.size === 0) return remote;
  const remoteEntries = Array.isArray(remote.entries) ? [...(remote.entries as object[])] : [];
  const byId = new Map(
    remoteEntries.map((e) => {
      const row = e as { id?: string };
      return [row.id ?? "", e] as const;
    })
  );
  for (const le of local.entries) {
    if (!dirtyFloatIds.has(le.id)) continue;
    const cur = (byId.get(le.id) as Record<string, unknown>) ?? {
      id: le.id,
      kind: le.kind ?? "number",
      enabled: true,
      isSet: true
    };
    byId.set(le.id, {
      ...cur,
      floatValue: le.floatValue,
      enabled: le.enabled ?? true,
      isSet: true
    });
  }
  return { ...remote, entries: [...byId.values()] };
}

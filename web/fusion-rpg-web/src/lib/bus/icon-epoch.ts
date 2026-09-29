let epoch = 0;
const listeners = new Set<() => void>();

export function getIconEpoch(): number {
  return epoch;
}

export function bumpIconEpoch(): void {
  epoch += 1;
  for (const l of listeners) l();
}

export function subscribeIconEpoch(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Test isolation — not for production. */
export function resetIconEpochForTests(): void {
  epoch = 0;
  listeners.clear();
}

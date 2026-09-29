import type { NotifyRefKind } from "./catalog";
import type { NotifyTarget } from "./format/translator";

export type TargetAction = { label: string; run: () => void };
export type TargetActionResolver = (target: NotifyTarget) => TargetAction | null;

/**
 * notify-client spec §6 — a toast or rail item gets a button only when a resolver is registered
 * for its `target`'s `refKind`. The active mount registers one (e.g. the world stage maps `sector`
 * and `legion` to its existing select/centre handlers); v1 registers none by default, so a
 * translator's `target` resolves to no button until a mount claims that kind. Keeps
 * spec-world-notify.md §7's "act on one important event = 1 click" without this module knowing
 * anything about any one stage's own navigation.
 */
const resolvers = new Map<NotifyRefKind, TargetActionResolver>();

/** Returns an unregister function, mirroring `player-routing`'s `subscribePlayerJoined` shape. */
export function registerTargetActionResolver(kind: NotifyRefKind, resolver: TargetActionResolver): () => void {
  resolvers.set(kind, resolver);
  return () => {
    if (resolvers.get(kind) === resolver) resolvers.delete(kind);
  };
}

export function resolveTargetAction(target: NotifyTarget | undefined): TargetAction | null {
  if (!target) return null;
  const resolver = resolvers.get(target.refKind);
  return resolver ? resolver(target) : null;
}

/** Test isolation — not for production. */
export function clearTargetActionResolversForTests(): void {
  resolvers.clear();
}

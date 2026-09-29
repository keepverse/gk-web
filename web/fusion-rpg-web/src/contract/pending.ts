/**
 * The sealed view contract's core mechanism (game-gui-map.md "The contract —
 * sealed now, filled later"). `absent` and `pending` are different and
 * conflating them is the bug this exists to prevent: "you have none" must
 * never look identical to "this isn't wired up yet".
 */
export type Pending<T> =
  | { state: "known"; value: T }
  | { state: "absent" }
  | { state: "pending"; reason: string };

export function known<T>(value: T): Pending<T> {
  return { state: "known", value };
}

export function absent<T>(): Pending<T> {
  return { state: "absent" };
}

/** `reason` is player-facing copy, not a developer note — the UI renders it. */
export function pendingWithReason<T>(reason: string): Pending<T> {
  return { state: "pending", reason };
}

export function isKnown<T>(p: Pending<T>): p is { state: "known"; value: T } {
  return p.state === "known";
}

export function isPending<T>(p: Pending<T>): p is { state: "pending"; reason: string } {
  return p.state === "pending";
}

/**
 * world-stage W83 (spec-world-turn.md §4) — the force-end hatch: ending the turn from a hard-blocked
 * state, on purpose, without waiting for the blocker to resolve. This is the insurance that a state
 * disagreement between the button and the world (W82's own property) can never cost a session.
 *
 * Pointer-only today, and that is a verified fact, not a preference: `useGlobalKeys.ts:25` is
 * `dispatchGlobalVerb(event.key)`, carrying no modifier state at all, so `Shift+Enter` and `Enter`
 * arrive at the registry as the same key `"Enter"` and cannot be told apart. The plate's `⇧⏎` binding
 * is not expressible in the shipped keymap until it does. Until then, this hatch has no key of its
 * own — `TurnCluster`'s hard-blocked control is reachable by pointer alone.
 */
export const FORCE_END_KEYBOARD_BLOCKED_REASON =
  "blocked on useGlobalKeys.ts:25 (dispatchGlobalVerb carries no modifier state, so Shift+Enter and Enter are indistinguishable) — not a preference";

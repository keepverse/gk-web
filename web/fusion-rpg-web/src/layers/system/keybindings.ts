/**
 * T20 — the rebindable half of the verb table (plate 06 §D/§D.2). GG-20: "if this screen and the
 * code ever disagree, the code is wrong" — this module is the one place a binding is decided;
 * `SanctumStage.tsx` reads `currentKeyFor` instead of a hardcoded key literal, so the Controls
 * screen and the actual registered verb can never drift apart.
 *
 * The launcher's own reserved overlay-toggle key is never a bindable action here — it's
 * `keymap.ts`'s own forbidden-keys list, rendered by `SystemLayer.tsx` as a read-only reserved
 * row (plate: "reserved... owned by the game launcher"), not something this module could assign.
 */

export type BindableActionId =
  | "creatures"
  | "commanders"
  | "relics"
  | "fusion"
  | "pacts"
  | "expeditions"
  | "almanac"
  | "chronicle";

export const DEFAULT_BINDINGS: Record<BindableActionId, string> = {
  creatures: "c",
  commanders: "k",
  relics: "r",
  fusion: "f",
  pacts: "p",
  expeditions: "e",
  almanac: "a",
  chronicle: "h"
};

export const ACTION_LABELS: Record<BindableActionId, string> = {
  creatures: "Creatures",
  commanders: "Commanders",
  relics: "Relics",
  fusion: "Fusion",
  pacts: "Pacts",
  expeditions: "Expeditions",
  almanac: "Almanac",
  chronicle: "Chronicle"
};

const STORAGE_KEY = "fusionrpg.keybindings.v1";

/** GG-20 held live, not just after reload: whatever registers this app's global verbs
 * (`SanctumStage.tsx`) listens for this and re-registers with the new table immediately, so the
 * Controls screen and the actually-bound key can never drift apart even mid-session. */
export const KEYBINDINGS_CHANGED_EVENT = "fusionrpg:keybindings-changed";

function notifyChanged(): void {
  window.dispatchEvent(new Event(KEYBINDINGS_CHANGED_EVENT));
}

function readOverrides(): Partial<Record<BindableActionId, string>> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return {};
    return parsed as Partial<Record<BindableActionId, string>>;
  } catch {
    return {};
  }
}

function writeOverrides(overrides: Partial<Record<BindableActionId, string>>): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    // Preferences degrade to session-only if storage is unavailable — never throw.
  }
}

/** The full, current key → action table (defaults merged with any saved overrides). */
export function currentBindings(): Record<BindableActionId, string> {
  const overrides = readOverrides();
  return { ...DEFAULT_BINDINGS, ...overrides } as Record<BindableActionId, string>;
}

export function currentKeyFor(action: BindableActionId): string {
  return currentBindings()[action];
}

/** The other action already holding this key, if any (case-insensitive — keydown.key casing
 * varies by modifier state, and a bound single character is meant to match either case). */
export function conflictFor(candidateKey: string, exclude: BindableActionId): BindableActionId | null {
  const key = candidateKey.toLowerCase();
  const bindings = currentBindings();
  for (const id of Object.keys(bindings) as BindableActionId[]) {
    if (id === exclude) continue;
    if (bindings[id].toLowerCase() === key) return id;
  }
  return null;
}

/**
 * world-stage W95 — `1`-`9` are `information-architecture.md`'s own reserved range ("Stage-specific
 * hotbar · owned by the current stage"), so a rebind onto one of them is already a rule violation,
 * not merely a UX nicety this task invents. Enforced *at the source* (`rebind` itself, not only at
 * one call site) so no caller can corrupt the table into a state that throws the next time a stage
 * using that digit for its own hotbar tries to register it via `registerGlobalVerb`.
 */
const RESERVED_DIGIT_PATTERN = /^[1-9]$/;

export function reservedRangeReasonFor(key: string): string | null {
  return RESERVED_DIGIT_PATTERN.test(key)
    ? "1–9 are reserved for the current stage's own hotbar and cannot be rebound here"
    : null;
}

/** Rebinds `action` to `key`. If another action already holds `key` (the plate's "Take it"), that
 * action swaps onto whatever `action` is vacating rather than reverting to its own default — a
 * revert-to-default is only safe when that default isn't the very key just taken, which it can be
 * (e.g. Relics defaults to "r" itself), and would otherwise leave both actions resolving to the
 * same key. The vacated key is provably held by nobody else going in, so the swap can never
 * introduce a second collision. Returns the full updated table — unchanged, and with no change
 * event fired, if `key` is in the reserved `1`-`9` range (`reservedRangeReasonFor` names why; a
 * caller that wants to show the reason before attempting the rebind checks it directly). */
export function rebind(action: BindableActionId, key: string): Record<BindableActionId, string> {
  if (reservedRangeReasonFor(key) != null) {
    return currentBindings();
  }

  const previousKey = currentKeyFor(action);
  const overrides = readOverrides();
  const next: Partial<Record<BindableActionId, string>> = { ...overrides, [action]: key.toLowerCase() };
  const conflicting = conflictFor(key, action);
  if (conflicting) {
    next[conflicting] = previousKey.toLowerCase();
  }
  writeOverrides(next);
  notifyChanged();
  return { ...DEFAULT_BINDINGS, ...next } as Record<BindableActionId, string>;
}

export function resetBindings(): Record<BindableActionId, string> {
  writeOverrides({});
  notifyChanged();
  return { ...DEFAULT_BINDINGS };
}

/** Test-only: clears the persisted table without going through the reset semantics above. */
export function clearBindingsForTests(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

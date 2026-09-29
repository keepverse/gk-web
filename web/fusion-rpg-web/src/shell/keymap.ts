import type { Band } from "./layerStack";
import { useLayerStack } from "./layerStack";

/**
 * GG-5's dismiss column: Panel/Dialog/System go via Esc, close or
 * click-away; Toast only auto-expires, HUD never dismisses, Shell is
 * explicit-only. Esc must skip a Toast even if one is nominally "on top" of
 * the raw push order — this is what encodes that.
 */
const ESCAPE_DISMISSIBLE_BANDS: ReadonlySet<Band> = new Set(["panel", "dialog", "system"]);

/**
 * Reserved for the injector overlay's own resume hotkey (see
 * OverlaySwitchLayout.cs / the F10 resume note in local dev docs). The app
 * must never bind it — registering it is a programming error, not a runtime
 * condition to handle gracefully.
 */
const FORBIDDEN_KEYS: ReadonlySet<string> = new Set(["F10"]);

/** T20's Controls screen lists every reserved key by reading this — the one other allowed
 * mention of the literal, per `keymapGuard.ts`'s own allowlist — rather than duplicating it. */
export function listForbiddenKeys(): string[] {
  return [...FORBIDDEN_KEYS];
}

type Registration = { id: string; handler: () => void };

const registry = new Map<string, Registration>();
let emptyStackEscapeFallback: { id: string; handler: () => void } | null = null;
let keyCapture: ((key: string) => void) | null = null;

/**
 * Every global verb — everything a keydown does regardless of which layer
 * has focus — is registered here, in this one module, so a lint can prove
 * nothing else binds one (T3's guard). Escape is not registered through
 * this; it is a distinct built-in (see `handleEscape`) because GG-6 gives it
 * fixed, non-overridable stack semantics rather than a swappable handler.
 */
export function registerGlobalVerb(key: string, id: string, handler: () => void): () => void {
  if (FORBIDDEN_KEYS.has(key)) {
    throw new Error(
      `registerGlobalVerb: "${key}" is reserved for the injector overlay's own hotkey and must never be handled by the app.`
    );
  }
  const existing = registry.get(key);
  if (existing) {
    throw new Error(
      `registerGlobalVerb: "${key}" is already registered by "${existing.id}" — every global verb has exactly one owner.`
    );
  }
  registry.set(key, { id, handler });
  return () => {
    if (registry.get(key)?.id === id) registry.delete(key);
  };
}

export function dispatchGlobalVerb(key: string): boolean {
  const reg = registry.get(key);
  if (!reg) return false;
  reg.handler();
  return true;
}

/**
 * T20's rebind flow: "press a key…" needs the *next* physical keydown, whatever it is —
 * including one that's already a registered verb, Escape, or the forbidden key itself (so the
 * Controls screen can correctly refuse it). Rather than a second `window` listener (which GG-6's
 * single-owner rule and `keymapGuard.ts` both forbid), the one real listener in
 * `useGlobalKeys.ts` checks this first and routes the raw key here instead of its normal
 * Escape/verb dispatch while a capture is active. Only one capture may be active at a time.
 */
export function captureNextKey(handler: (key: string) => void): () => void {
  keyCapture = handler;
  return () => {
    if (keyCapture === handler) keyCapture = null;
  };
}

/** `useGlobalKeys.ts`'s own hook into the capture above — consumes the key and clears the
 * capture if one is active, returning whether it did. */
export function consumeKeyCapture(key: string): boolean {
  if (!keyCapture) return false;
  const handler = keyCapture;
  keyCapture = null;
  handler(key);
  return true;
}

/**
 * Claimed once, by whatever owns the System layer (T20). Esc on an empty
 * stack opens it (GG-5's Shell/System row: System is reachable from
 * anywhere, including nowhere).
 */
export function registerEmptyStackEscapeFallback(id: string, handler: () => void): () => void {
  if (emptyStackEscapeFallback) {
    throw new Error(
      `registerEmptyStackEscapeFallback: already claimed by "${emptyStackEscapeFallback.id}" — only the System layer may own this.`
    );
  }
  emptyStackEscapeFallback = { id, handler };
  return () => {
    if (emptyStackEscapeFallback?.id === id) emptyStackEscapeFallback = null;
  };
}

/**
 * For stage chrome that wants Esc-to-cancel without being a `PanelShell` layer (T22: "stage
 * chrome, not a layer — no scrim"). Wraps the real stack's own push/pop so a caller never needs
 * to import `layerStack` directly (`bandGuard.test.ts` enforces that only `src/shell/` may) —
 * `handleEscape()` finds and closes it exactly like any band-2 layer, just with no rendered Dialog
 * behind it. Call from within the owning component's own `useEffect`.
 */
export function claimStageEscape(id: string, close: () => void): () => void {
  useLayerStack.getState().push({ id, band: "panel", close });
  return () => useLayerStack.getState().pop(id);
}

/**
 * GG-6: Esc pops exactly one layer. It finds the topmost Esc-dismissible
 * layer (skipping Toasts) and tells it to close itself via the entry's own
 * `close` — never mutates the stack array directly, so there is exactly one
 * path to "this layer closes" no matter who triggered it (Esc, a close
 * button, click-away). An empty stack falls through to the System layer.
 */
export function handleEscape(): void {
  const layers = useLayerStack.getState().layers;
  for (let i = layers.length - 1; i >= 0; i -= 1) {
    const layer = layers[i]!;
    if (ESCAPE_DISMISSIBLE_BANDS.has(layer.band)) {
      layer.close();
      return;
    }
  }
  emptyStackEscapeFallback?.handler();
}

/** Test-only: both registries are module-level singletons. */
export function resetKeymapForTests(): void {
  registry.clear();
  emptyStackEscapeFallback = null;
  keyCapture = null;
}

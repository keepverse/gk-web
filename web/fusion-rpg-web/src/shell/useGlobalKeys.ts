import { useEffect } from "react";
import { consumeKeyCapture, dispatchGlobalVerb, handleEscape } from "./keymap";

/**
 * The one `keydown` listener for every global verb (T3). Mounted once, at
 * the app root — see `AppShell`. A key capture (T20's rebind "press a
 * key…" flow) wins first if one is active — it needs the raw next key,
 * including Escape or the forbidden key, so it's checked before either of
 * those get their normal meaning. Otherwise Escape is handled inline
 * (GG-6's fixed stack semantics); anything else goes through the swappable
 * verb registry.
 */
export function useGlobalKeys(): void {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (consumeKeyCapture(event.key)) {
        event.preventDefault();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        handleEscape();
        return;
      }
      dispatchGlobalVerb(event.key);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}

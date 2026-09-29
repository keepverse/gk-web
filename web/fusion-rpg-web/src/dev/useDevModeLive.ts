import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { isDevModeEnabled } from "./devMode";

/**
 * A live-reactive read of the same flag `isDevModeEnabled()` exposes — for a component that stays
 * mounted across a Settings toggle (T28: `LawnPage.tsx` never unmounts while the player is on the
 * stage, the same way `DevTreeHost.tsx` doesn't). Mirrors `DevTreeHost.tsx`'s own re-sync path
 * exactly: `?devmode=1`/`?devmode=0` is the one live-update signal `SystemLayer.tsx`'s toggle
 * already drives globally; a plain `isDevModeEnabled()` read at mount time would miss a toggle that
 * happens while this component is already mounted.
 */
export function useDevModeLive(): boolean {
  const [searchParams] = useSearchParams();
  const [enabled, setEnabled] = useState(() => isDevModeEnabled());

  useEffect(() => {
    const flag = searchParams.get("devmode");
    setEnabled(flag === "1" || flag === "0" ? flag === "1" : isDevModeEnabled());
  }, [searchParams]);

  return enabled;
}

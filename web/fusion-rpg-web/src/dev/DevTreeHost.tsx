import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { registerGlobalVerb } from "@/shell/keymap";
import { DEV_SURFACES, DeveloperTree, type DevSurfaceId } from "./DeveloperTree";
import { isDevModeEnabled, setDevModeEnabled } from "./devMode";

function isDevSurfaceId(value: string | null): value is DevSurfaceId {
  return DEV_SURFACES.some((s) => s.id === value);
}

/**
 * Mounted once, globally (AppShell), so the tree is reachable — via
 * backtick or `?dev=<surface>` — from whatever stage the player is on, not
 * just one route. `?devmode=1`/`?devmode=0` flips and persists the gate
 * itself, then is stripped from the URL (it's a one-time switch, not part
 * of the addressable state the way `?dev=` is).
 */
export function DevTreeHost() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [devEnabled, setDevEnabled] = useState(() => isDevModeEnabled());

  // react-router's setSearchParams closes over the `searchParams` from the render that
  // created it, so a verb handler registered once (below) and kept across renders would
  // otherwise toggle against a stale snapshot. Route every call through the latest one.
  const setSearchParamsRef = useRef(setSearchParams);
  setSearchParamsRef.current = setSearchParams;

  useEffect(() => {
    const flag = searchParams.get("devmode");
    if (flag !== "1" && flag !== "0") return;
    const enabled = flag === "1";
    setDevModeEnabled(enabled);
    setDevEnabled(enabled);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("devmode");
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get("devmode")]);

  useEffect(() => {
    if (!devEnabled) return undefined;
    return registerGlobalVerb("`", "dev-tree", () => {
      setSearchParamsRef.current((prev) => {
        const next = new URLSearchParams(prev);
        if (next.has("dev")) next.delete("dev");
        else next.set("dev", "status");
        return next;
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devEnabled]);

  const devParam = searchParams.get("dev");
  const open = isDevSurfaceId(devParam);

  return (
    <DeveloperTree
      open={open}
      initialTab={open ? devParam : undefined}
      onOpenChange={(next) => {
        setSearchParams((prev) => {
          const params = new URLSearchParams(prev);
          if (next) params.set("dev", "status");
          else params.delete("dev");
          return params;
        });
      }}
    />
  );
}

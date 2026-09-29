import { Outlet, useLocation } from "react-router-dom";
import { useHealth, useHubStatus, usePlayers } from "@/lib/bus";
import { DevTreeHost } from "@/dev/DevTreeHost";
import { SystemHost } from "@/layers/system/SystemHost";
import { useGlobalKeys } from "@/shell/useGlobalKeys";
import { useStageScrollLocked } from "@/shell/stageScrollLock";
import { Banner } from "@/ui";

/**
 * world-stage W34: routes whose stage is measured against the viewport, not the page — a stage's
 * own camera owns its extent, so the outlet must never grow past the viewport and hand the page a
 * scrollbar (GG-36 forbids exactly that dressed as a feature). Route-scoped on purpose: this is an
 * opt-in lookup, not a blanket AppShell layout change, so Sanctum and Lawn — neither of which is in
 * this set — render byte-identically to before.
 *
 * `/world` joined this set the same turn `#/world` started serving `WorldStage` (the owner's
 * "flip now" decision, 2026-09-04): it is the same stage component under a second route, and it
 * needs the same unpadded, non-scrolling outlet `/world-stage` already gets — not a copy of the
 * old `WorldPage`'s scrolling layout.
 */
const NON_SCROLLING_ROUTES = new Set(["/world-stage", "/world"]);

export function AppShell() {
  useGlobalKeys();
  const health = useHealth();
  const players = usePlayers();
  const hub = useHubStatus();
  const location = useLocation();

  const apiErr = health.error?.message || players.error?.message;
  const hubWarn = hub === "err" ? "SignalR disconnected — falling back to poll" : null;
  const nonScrolling = NON_SCROLLING_ROUTES.has(location.pathname);
  // GG-36, as the note above states it: the outlet must never hand the page a scrollbar it should
  // not have. With a panel open there were TWO vertical scrollbars — the panel body (correct; the
  // body-scrolls-not-the-shell discipline) and this outlet still scrolling the stage behind it.
  // Measured live 2026-09-17 at `#/sanctum?panel=creatures` and `?panel=chronicle`: two scrollers,
  // `page-outlet` 921/883 plus the layer body. The stage behind a panel is not what the player is
  // reading, so it does not scroll while one is up.
  //
  // Only the overflow changes — `p-5` is kept — so opening a panel cannot shift the stage under it.
  const layerLocksStage = useStageScrollLocked();

  return (
    <div className="flex h-screen flex-col" data-testid="app-shell">
      {apiErr ? (
        <Banner tone="error" data-testid="banner-api-error">
          Server unreachable: {apiErr}
        </Banner>
      ) : null}
      {!apiErr && hubWarn ? (
        <Banner tone="warn" data-testid="banner-hub-warn">
          {hubWarn}
        </Banner>
      ) : null}
      <div className="flex min-h-0 flex-1" data-testid="shell-body">
        <main
          className={
            nonScrolling
              ? "min-w-0 flex-1 overflow-hidden"
              : layerLocksStage
                ? "min-w-0 flex-1 overflow-hidden p-5"
                : "min-w-0 flex-1 overflow-auto p-5"
          }
          data-testid="page-outlet"
        >
          <Outlet />
        </main>
      </div>
      <DevTreeHost />
      <SystemHost />
    </div>
  );
}

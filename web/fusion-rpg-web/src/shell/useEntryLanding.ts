import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { usePlayers } from "@/lib/bus";
import { getFirstOpen } from "@/lib/bus";
import { isEmbedded } from "./overlayEmbed";
import { shouldLandOnSanctum } from "./entryLanding";

/**
 * rift-gate entry-landing: on the first open, land the player at the new-save entry point
 * (`/sanctum`). Once per player, driven by the durable first-open fact — a returning player keeps
 * their own route.
 *
 * Two hazards this is built against:
 *  - **A redirect loop.** The landing navigates exactly once. The guard is the fact itself plus a
 *    `landedRef`, and the effect re-checks nothing after navigating.
 *  - **Never redirect on an unknown fact.** While the read is in flight we do nothing; we never treat
 *    "not loaded yet" as "not first open", which would either skip the landing or (worse) land on a
 *    default for a returning player.
 *
 * It does not create a player: the server already seeds one (`SeedPlayerIfEmpty`), so the FE only ever
 * reads the current id.
 *
 * The story scene runs first and is owned by `story-scene`; landing on `/sanctum` is the surface that
 * already mounts it, so that trigger is not duplicated here.
 */
export function useEntryLanding(): void {
  const navigate = useNavigate();
  const location = useLocation();
  const players = usePlayers();
  const playerId = players.data?.currentPlayerId;
  const landedRef = useRef(false);

  useEffect(() => {
    if (typeof playerId !== "number") return; // no player known yet: do not guess
    if (landedRef.current) return;

    let cancelled = false;
    void (async () => {
      try {
        const fact = await getFirstOpen(playerId);
        if (cancelled) return;
        landedRef.current = true; // one attempt per mount, whether or not it navigates
        if (shouldLandOnSanctum({
          firstOpen: fact.opened,
          embedded: isEmbedded(),
          pathname: location.pathname
        })) {
          navigate("/sanctum", { replace: true });
        }
      } catch {
        // The read failed: leave the player where they are rather than landing on a guess.
        // A later load can still land them.
      }
    })();

    return () => { cancelled = true; };
  }, [playerId, location.pathname, navigate]);
}

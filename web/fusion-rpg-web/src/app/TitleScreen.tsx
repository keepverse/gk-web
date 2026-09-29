import { useNavigate } from "react-router-dom";
import { usePlayers } from "@/lib/bus";
import { Button } from "@/ui";
import packageJson from "../../package.json";

/**
 * Plate 01 §A — band -1, one of only two surfaces that replace a stage without being travel.
 * Deliberately carries none of the dev-facing HudBar fields it replaces (API address, injector dot,
 * hub state) — those are developer surfaces, not what a player meets first (plate 01 §F).
 *
 * "Continue" jumps straight to Sanctum with whatever player the server already has selected
 * (`currentPlayerId`) — there is no separate "last played" concept to read, `/api/players` already
 * is the source of truth HudBar used. "Settings" reuses the existing `?system=1` mechanism
 * (SanctumStage.tsx's own openSystem) rather than inventing a title-screen-only settings surface.
 */
export function TitleScreen() {
  const navigate = useNavigate();
  const players = usePlayers();
  const hasAnyPlayer = (players.data?.items.length ?? 0) > 0;

  return (
    <div className="grid h-screen place-items-center bg-panel-inset" data-testid="title-screen">
      <div className="grid justify-items-center gap-8 text-center">
        <div>
          <h1 className="font-display text-4xl text-text">Garden Keeper and his Multiverse</h1>
          <p className="mt-1 text-sm text-muted">Fusion</p>
        </div>
        <div className="grid gap-2">
          <Button
            size="md"
            data-testid="title-continue"
            disabled={!hasAnyPlayer}
            title={hasAnyPlayer ? undefined : "No summoner yet — start with New summoner"}
            onClick={() => navigate("/sanctum")}
          >
            Continue
          </Button>
          <Button variant="ghost" data-testid="title-new-summoner" onClick={() => navigate("/saves?create=1")}>
            New summoner
          </Button>
          <Button variant="ghost" data-testid="title-saves" onClick={() => navigate("/saves")}>
            Saves
          </Button>
          <Button variant="ghost" data-testid="title-settings" onClick={() => navigate("/sanctum?system=1")}>
            Settings
          </Button>
          <Button variant="ghost" data-testid="title-quit" disabled title="Not available in the web build">
            Quit
          </Button>
        </div>
        <span className="text-xs text-faint" data-testid="title-build">
          v{packageJson.version}
        </span>
      </div>
    </div>
  );
}

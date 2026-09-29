import { useSearchParams } from "react-router-dom";
import { msg } from "@lingui/macro";
import { useLingui } from "@lingui/react";
import { StageHost, useStageMountGuard } from "@/shell/stageHost";
import { PanelShell } from "@/shell/PanelShell";

/**
 * The siege stage — `#/siege/{siegeId}` (decisions.md's fifth-stage amendment, approved 2026-09-04).
 * A turn-based tactical board gets its own stage rather than reusing `battle`, so a besieged base's
 * HUD and transport never constrain a squad battle's (decisions 8/9).
 *
 * Deliberately minimal for now, matching `LawnStage.tsx`'s own honest-placeholder precedent: this
 * task (21.1, "route + six shell rows") wires the shell — mount guard, the `?layer=` URL contract
 * GG-1 requires (`#/siege/abc?layer=structures` from spec-siege-stage.md §1), and Esc-dismissal via
 * the existing `PanelShell` (which owns the layer-stack push/pop itself, so this stage needs no
 * `claimStageEscape` call of its own) — so every later `stages/siege/` task (21.3's hud/inspector/
 * render/targeting/playback subdirectories) lands in a real stage instead of inventing shell wiring
 * too. The real board is 21.3+'s job, not this one's.
 */
export function SiegeStage() {
  useStageMountGuard("siege");
  const { _ } = useLingui();
  const [searchParams, setSearchParams] = useSearchParams();
  const openLayer = searchParams.get("layer");

  function closeLayer() {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("layer");
      return next;
    });
  }

  return (
    <StageHost>
      <h1 className="sr-only">{_(msg`Siege`)}</h1>
      <div className="flex h-full w-full items-center justify-center" data-testid="siege-stage-frame">
        <p className="max-w-md text-center text-sm text-muted" data-testid="siege-stage-placeholder">
          {_(
            msg`The siege board arrives with a later pass — this stage exists to prove the route, the layer-in-URL contract and the shell wiring work before the board does.`
          )}
        </p>
      </div>
      <PanelShell
        open={openLayer != null}
        onOpenChange={(open) => {
          if (!open) closeLayer();
        }}
        title={_(msg`Board layer`)}
        testId="siege-stage-layer-panel"
      >
        <p className="text-sm text-muted" data-testid="siege-stage-layer-placeholder">
          {_(msg`This layer arrives with a later pass.`)}
        </p>
      </PanelShell>
    </StageHost>
  );
}

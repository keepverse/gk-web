import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { msg } from "@lingui/macro";
import { useLingui } from "@lingui/react";
import { useCreatureRoster, usePlayers, useRelics, useRuns } from "@/lib/bus";
import { useContracts } from "@/lib/bus/contracts";
import { useDevModeLive } from "@/dev/useDevModeLive";
import { LawnPage } from "@/features/lawn/LawnPage";
import { setLawnKeyboardMuted } from "@/game/focusGate";
import { useExpeditionReturnWatcher } from "@/layers/expeditions/expeditionReturnWatcher";
import { PanelShell } from "@/shell/PanelShell";
import { Rail } from "@/shell/Rail";
import { deriveRailEntries, type RailEntry, type RailUnlockInputs } from "@/shell/railState";
import { StageHost, useStageMountGuard } from "@/shell/stageHost";

/**
 * The lawn hosted as a band-0 stage (GG-1/GG-11): `LawnPage` renders exactly
 * as it always has, and a `PanelShell` can open over it without unmounting
 * it, resetting its view model, or touching the Phaser `Game` instance
 * `LawnGameHost` owns. This is the GG-11 keystone proof (T2) — it wraps the
 * *existing* page rather than a redesigned one, on purpose, so the proof
 * holds before anything else depends on it.
 *
 * Uses `useLingui()`'s context-bound `_` with `msg` descriptors, not the
 * bare `t` macro. `t` compiles to a call against the global `i18n` singleton
 * directly — correct for non-component code, but a component using only
 * that has nothing subscribing it to `I18nProvider`'s context, so a locale
 * switch elsewhere in the tree never triggers *this* component to
 * re-render (ordinary React children-prop-reference semantics, not a
 * Lingui bug — found by trying to switch locale live and watching nothing
 * update). `_` is a real context consumer, so it does.
 */
export function LawnStage() {
  useStageMountGuard("lawn");
  const { _ } = useLingui();
  const navigate = useNavigate();
  const [panelOpen, setPanelOpen] = useState(false);
  // GG-18: mute Phaser keyboard while a React panel owns input.
  useEffect(() => {
    setLawnKeyboardMuted(panelOpen);
    return () => setLawnKeyboardMuted(false);
  }, [panelOpen]);
  // T28: this GG-11 keystone proof (a panel can open over the live board without disturbing it) is
  // now redundantly re-proven by real usage every time a player reaches System or a Sanctum layer
  // from here — visually found overlapping the top banner row at a wider viewport during a second
  // multi-width pass, not caused by T28's own new HUD but newly exposed by it (this stage never had
  // a Rail before). Gated behind developer mode rather than deleted (GG-41).
  const devMode = useDevModeLive();

  // T28/GG-1: "the rail is identical on every stage." Every layer it opens still only exists inside
  // `SanctumStage.tsx` (its `mountedLayers` gate isn't shared globally — moving the whole layer
  // stack up to AppShell is real future scope, not this task's), so a rail click here navigates to
  // where the layer actually lives rather than trying to open it in place over the live board. The
  // unlock queries below duplicate `SanctumStage.tsx`'s own — cheap and safe, since react-query
  // dedupes by query key rather than refetching.
  const players = usePlayers();
  const playerId = players.data?.currentPlayerId ?? 1;
  const runsQuery = useRuns();
  const contractsQuery = useContracts(playerId);
  const relicsQuery = useRelics();
  const creatureRosterQuery = useCreatureRoster(playerId);
  const { returnedCount } = useExpeditionReturnWatcher(playerId);
  const railInputs: RailUnlockInputs = {
    currentStageId: "lawn",
    hasCompletedARun: (runsQuery.data?.length ?? 0) > 0,
    hasAnyCreature: (creatureRosterQuery.data?.items.length ?? 0) > 0,
    hasAnyContract: (contractsQuery.data?.contracts.length ?? 0) > 0,
    hasAnyRelic: (relicsQuery.data?.items.length ?? 0) > 0,
    hasAnyBoundCreature: contractsQuery.data?.contracts.some((c) => c.bound) ?? false,
    returnedExpeditionCount: returnedCount,
    unreadResultCount: 0
  };
  const railEntries = deriveRailEntries(railInputs);

  function openLayerOnSanctum(id: Exclude<RailEntry["id"], "sanctum">) {
    navigate(`/sanctum?panel=${id}`);
  }

  return (
    <StageHost>
      {/* LawnHud is deliberately ornament-free (T28, plate 04 §A) — this is the page's only
          heading, visually hidden so axe's page-has-heading-one rule is satisfied without adding
          chrome the plate explicitly says shouldn't be here. */}
      <h1 className="sr-only">Lawn</h1>
      <div className="flex items-start" data-testid="lawn-frame">
        <Rail entries={railEntries} onSelect={(id) => (id === "sanctum" ? navigate("/sanctum") : openLayerOnSanctum(id))} />
        <div className="min-w-0 flex-1">
          <LawnPage />
        </div>
      </div>
      {devMode ? (
        <>
          <button
            type="button"
            data-testid="lawn-stage-open-panel"
            className="band-hud fixed right-4 top-4 rounded-sm border border-border bg-panel px-3 py-1 text-sm text-text shadow-panel"
            onClick={() => setPanelOpen(true)}
          >
            {_(msg`Board panel`)}
          </button>
          <PanelShell
            open={panelOpen}
            onOpenChange={setPanelOpen}
            title={_(msg`Board panel`)}
            subtitle={_(msg`Proves a panel can open here without disturbing the board`)}
            testId="lawn-stage-panel"
          >
            <p className="text-sm text-muted">
              {_(msg`Board layers arrive with a later pass — this one exists to prove they can open over the live game without resetting it.`)}
            </p>
          </PanelShell>
        </>
      ) : null}
    </StageHost>
  );
}

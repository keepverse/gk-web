import { useCallback, useEffect, useState } from "react";
import type { CommanderSheetMeta } from "@/contract/types";
import {
  actorSurfaceCatalogNow,
  type ActorSheetTabKind
} from "@/lib/bus/actorSurface";
import { PanelShell } from "@/shell/PanelShell";
import { Banner, Button } from "@/ui";
import type { ActorRungState } from "./actorRungState";
import { RungStateFallback } from "./RungStateFallback";
import { CommanderSheetFooter } from "./CommanderSheetFooter";
import { ActionsTab } from "./ActionsTab";
import { AptitudesTab, type AptitudeDraftState } from "./AptitudesTab";
import { ConditionTab } from "./ConditionTab";
import { DerivedTab } from "./DerivedTab";
import { ElementsTab, KitTab, ShieldTab, StatusTab } from "./CatalogTabs";
import { PathsTab } from "./PathsTab";
import { LeftoverBar } from "./LeftoverBar";
import { emitActorSheetObs } from "./actorSheetObs";
import { ActorSheetTabRail } from "./ActorSheetTabRail";
import { ActorSummarize } from "./ActorSummarize";
import { useActorSheet } from "@/lib/bus/aura";

export type ActorPanelRole = "creature" | "commander";

const RAIL_COLLAPSED_KEY = "fusionRpg.actorSheet.railCollapsed";

function readRailCollapsed(): boolean {
  try {
    return localStorage.getItem(RAIL_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeRailCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(RAIL_COLLAPSED_KEY, collapsed ? "1" : "0");
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * Catalog-era ActorSheet (band 2, GG-9). Near-fullscreen shell; left vertical rail
 * (summarize + tabs, expand/collapse); leftover Confirm only on Aptitudes / dirty draft.
 */
export function ActorPanel({
  state,
  open,
  onOpenChange,
  role = "creature",
  commanderMeta,
  setDefaultPending = false,
  onSetDefault,
  onDefendLawn,
  onOpenCommandersList,
  matchBanner
}: {
  state: ActorRungState;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role?: ActorPanelRole;
  commanderMeta?: CommanderSheetMeta;
  setDefaultPending?: boolean;
  onSetDefault?: () => void;
  onDefendLawn?: () => void;
  onOpenCommandersList?: () => void;
  matchBanner?: { displayName: string; auraDisplayName: string | null };
}) {
  const surface = actorSurfaceCatalogNow();
  const [tab, setTab] = useState<ActorSheetTabKind>(surface.defaultOpen);
  const [aptitudeDraft, setAptitudeDraft] = useState<AptitudeDraftState | null>(null);
  const [railCollapsed, setRailCollapsed] = useState(readRailCollapsed);
  const isCommander = role === "commander";
  const actorId = state.kind === "ready" && !isCommander ? state.data.instanceId : null;
  const sheet = useActorSheet(actorId);
  const showLeftover = tab === "aptitudes" || (aptitudeDraft?.dirty ?? false);

  useEffect(() => {
    if (!open || state.kind !== "ready") return;
    emitActorSheetObs("actor-sheet.open", {
      instanceId: state.data.instanceId,
      tab,
      versionStamp: surface.versionStamp
    });
    // Open once per open cycle — tab changes emit separately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, state.kind === "ready" ? state.data.instanceId : null]);

  const handleTabChange = useCallback((id: string) => {
    const next = id as ActorSheetTabKind;
    setTab(next);
    emitActorSheetObs("actor-sheet.tab", { tab: next });
  }, []);

  const handleRailCollapsed = useCallback((collapsed: boolean) => {
    setRailCollapsed(collapsed);
    writeRailCollapsed(collapsed);
  }, []);

  if (state.kind !== "ready") {
    return (
      <PanelShell open={open} onOpenChange={onOpenChange} title="Actor" testId="actor-panel" size="actorSheet">
        <RungStateFallback state={state} dimensionClass="h-40 w-full rounded-md" label="panel" />
      </PanelShell>
    );
  }

  const { data } = state;
  const name = sheet.data?.displayName || (data.displayName.state === "known" ? data.displayName.value : `#${data.instanceId.slice(0, 6)}`);
  const roleLabel =
    sheet.data?.roleLabel ??
    (isCommander ? "Commander" : data.side === "plant" ? "Plant" : "Zombie");

  const tabs = surface.tabs
    .filter((item) => !item.hidden)
    .sort((a, b) => a.order - b.order)
    .map((item) => ({
      id: item.kind,
      label: item.label,
      icon: item.icon,
      testId: `actor-sheet-tab-${item.kind}`
    }));

  const leftoverFooter = showLeftover ? (
    <div className="flex w-full flex-wrap items-center justify-between gap-2" data-testid="actor-leftover-footer">
      {aptitudeDraft ? (
        <>
          <LeftoverBar budget={aptitudeDraft.budget} spent={aptitudeDraft.spent} />
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              data-testid="actor-leftover-cancel"
              disabled={!aptitudeDraft.dirty || aptitudeDraft.saving}
              title={
                aptitudeDraft.saving
                  ? "Saving…"
                  : !aptitudeDraft.dirty
                    ? "No unsaved changes to cancel"
                    : undefined
              }
              onClick={() => aptitudeDraft.revert()}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              data-testid="actor-leftover-confirm"
              disabled={!aptitudeDraft.dirty || !aptitudeDraft.withinBudget || aptitudeDraft.saving}
              title={
                aptitudeDraft.saving
                  ? "Saving…"
                  : !aptitudeDraft.dirty
                    ? "No unsaved changes to confirm"
                    : !aptitudeDraft.withinBudget
                      ? "Over budget — reduce points spent before confirming"
                      : undefined
              }
              onClick={() => void aptitudeDraft.save()}
            >
              {aptitudeDraft.saving ? "Saving…" : "Confirm"}
            </Button>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted" data-testid="actor-leftover-pending">
          Loading aptitudes…
        </p>
      )}
    </div>
  ) : null;

  const defaultFooter =
    isCommander && commanderMeta ? (
      <CommanderSheetFooter
        isDefault={commanderMeta.isDefault}
        setDefaultPending={setDefaultPending}
        editsScope={matchBanner ? "nextRun" : undefined}
        onClose={() => onOpenChange(false)}
        onSetDefault={() => onSetDefault?.()}
        onDefendLawn={() => onDefendLawn?.()}
        onOpenCommandersList={() => onOpenCommandersList?.()}
      />
    ) : (
      <>
        <Button variant="ghost" size="sm" data-testid="actor-panel-release" onClick={() => onOpenChange(false)}>
          Release
        </Button>
        <Button size="sm" data-testid="actor-panel-deploy" onClick={() => onOpenChange(false)}>
          Deploy
        </Button>
      </>
    );

  return (
    <PanelShell
      open={open}
      onOpenChange={onOpenChange}
      title={name}
      headerMode="none"
      testId="actor-panel"
      size="actorSheet"
      // Leftover strip replaces default footer while Aptitudes is active or draft dirty —
      // never fall back to Release/Deploy on that strip (GG-61 / GG-63).
      footer={showLeftover ? leftoverFooter : defaultFooter}
    >
      <div className="flex min-h-0 min-w-0 flex-1" data-testid="actor-sheet-root">
        <ActorSheetTabRail
          tabs={tabs}
          value={tab}
          onChange={handleTabChange}
          collapsed={railCollapsed}
          onCollapsedChange={handleRailCollapsed}
          onClose={() => onOpenChange(false)}
          summarize={
            <ActorSummarize
              displayName={data.displayName}
              instanceId={data.instanceId}
              level={data.level}
              roleLabel={roleLabel}
              side={data.side}
              collapsed={railCollapsed}
              sheet={sheet.data}
            />
          }
        />

        <div
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden px-4 py-4"
          data-testid="actor-sheet-tab-panel"
        >
          {matchBanner ? (
            <Banner tone="info" className="mb-4" data-testid="commander-sheet-match-banner">
              This match: {matchBanner.displayName}
              {matchBanner.auraDisplayName ? ` · ${matchBanner.auraDisplayName}` : ""}
            </Banner>
          ) : null}

          {tab === "condition" ? (
            <>
              {isCommander && commanderMeta ? (
                <>
                  <div className="mt-0" data-testid="commander-sheet-overview-default">
                    <p className="text-2xs font-bold uppercase tracking-wide text-muted">Default lawn</p>
                    <p className="text-sm text-text">
                      {commanderMeta.isDefault ? "Leads the next run." : "Not your default lawn commander yet."}
                    </p>
                    {onOpenCommandersList ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="mt-1 px-0"
                        data-testid="commander-sheet-overview-change"
                        onClick={onOpenCommandersList}
                      >
                        Change in list
                      </Button>
                    ) : null}
                  </div>
                  <div className="mt-4" data-testid="commander-sheet-overview-location">
                    <p className="text-2xs font-bold uppercase tracking-wide text-muted">Location</p>
                    <p className="text-sm text-muted">{commanderMeta.locationStub ?? "not shown yet"}</p>
                  </div>
                  <div className="mt-4" data-testid="commander-sheet-overview-legion">
                    <p className="text-2xs font-bold uppercase tracking-wide text-muted">Legion</p>
                    <p className="text-sm text-muted">{commanderMeta.legionStub ?? "not shown yet"}</p>
                  </div>
                </>
              ) : null}
              <ConditionTab
                data={data}
                surface={surface}
                sheet={sheet.data}
                sheetError={sheet.isError}
                onRetry={() => void sheet.refetch()}
                onOpenStatusTab={() => setTab("status")}
              />
            </>
          ) : null}

          {/* Keep aptitudes mounted while draft is dirty so leftover Confirm stays reachable. */}
          {tab === "aptitudes" || aptitudeDraft?.dirty ? (
            <div hidden={tab !== "aptitudes"} data-testid="aptitudes-mount">
              <AptitudesTab
                data={data}
                surface={surface}
                role={isCommander ? "commander" : "creature"}
                onDraftState={setAptitudeDraft}
              />
            </div>
          ) : null}

          {tab === "derived" ? <DerivedTab data={data} surface={surface} /> : null}
          {tab === "shield" ? (
            <ShieldTab
              data={data}
              sheet={sheet.data}
              sheetError={sheet.isError}
              onRetry={() => void sheet.refetch()}
            />
          ) : null}
          {tab === "status" ? <StatusTab surface={surface} /> : null}
          {tab === "elements" ? <ElementsTab data={data} surface={surface} /> : null}
          {tab === "kit" ? (
            <>
              {/* aura-skill T18c: the aura + regular-action surface rides in the Kit tab, which is
                  where it was mounted from 2026-08-29 until 9aad045cf (2026-09-07) deferred it with a
                  placeholder reading "Aura row — live aura chrome when present". That condition is met:
                  /api/aura-runtime is live in the server, so the placeholder's chrome now mounts. */}
              <ActionsTab data={data} />
              <KitTab data={data} surface={surface} />
            </>
          ) : null}
          {tab === "paths" ? <PathsTab elementTyping={data.elementTyping} /> : null}
        </div>
      </div>
    </PanelShell>
  );
}

export const ActorSheet = ActorPanel;

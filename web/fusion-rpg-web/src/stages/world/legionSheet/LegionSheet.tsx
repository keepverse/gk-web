import { useCallback, useEffect, useState } from "react";
import { PanelShell } from "@/shell/PanelShell";
import { ActorSheetTabRail } from "@/ui/actor/ActorSheetTabRail";
import type { LegionSheetTabId, LegionView } from "@/contract/types";
import { CargoTab } from "./CargoTab";

const RAIL_COLLAPSED_KEY = "fusionRpg.legionSheet.railCollapsed";

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
 * empire-inventory-surfaces `legion-sheet` host (plan Task 4D.1, spec
 * §Design 1). A band-2 sheet-menu over the world stage for one selected
 * legion — mirrors the actor-sheet rail discipline (`ActorPanel` shell +
 * `ActorSheetTabRail` contract: `tabs/value/onChange/collapsed/summarize`,
 * `role="tablist"`, vertical orientation) without forking it.
 *
 * - Open trigger: `selectedEntityId != null` — the sheet never owns
 *   selection, it renders it (parent passes `entityId` + `onDeselect`).
 * - Tabs: closed `overview` (default — the player asked to see the band,
 *   not its packs) + `cargo`. Future tabs by reservation only.
 * - Per-legion reset: switching legions returns to the default tab; the
 *   rail-collapsed preference persists (same localStorage pattern as the
 *   actor rail, same key family, new key name).
 * - Close (Esc / ✕ / empty-map deselect) never clears the pending queue
 *   (turn-scoped, not sheet-scoped — this host never touches the queue).
 * - Lifecycle: unknown legion = `phase-error` with retry; known legion
 *   with empty packs = `phase-empty` with next action (in `CargoTab`).
 *   No new route, no new stage — closing returns the exact map state
 *   (GG-12).
 */
export function LegionSheet(props: {
  worldId: string | null;
  entityId: string | null;
  turn: number;
  commanderId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeselect: () => void;
  displayName: string | null;
  ownerFactionId: string | null;
  memberCount: number | null;
  legion: LegionView | null;
  defaultTab?: LegionSheetTabId;
}) {
  const defaultTab: LegionSheetTabId = props.defaultTab ?? "overview";
  const [tab, setTab] = useState<LegionSheetTabId>(defaultTab);
  const [railCollapsed, setRailCollapsed] = useState(readRailCollapsed);

  // Per-legion reset: the player asked to see THIS band, not its packs.
  useEffect(() => {
    setTab(defaultTab);
  }, [props.entityId, defaultTab]);

  const handleTabChange = useCallback((id: string) => {
    setTab(id === "cargo" ? "cargo" : "overview");
  }, []);

  const handleRailCollapsed = useCallback((collapsed: boolean) => {
    setRailCollapsed(collapsed);
    writeRailCollapsed(collapsed);
  }, []);

  const handleClose = useCallback(() => {
    props.onOpenChange(false);
    props.onDeselect();
  }, [props]);

  const open = props.open && props.entityId != null;
  const title =
    props.displayName && props.displayName.length > 0 ? props.displayName : (props.entityId ?? "Legion");

  return (
    <PanelShell
      open={open}
      onOpenChange={(next) => {
        props.onOpenChange(next);
        if (!next) props.onDeselect();
      }}
      title={title}
      headerMode="none"
      testId="legion-sheet"
      size="actorSheet"
    >
      <div className="flex min-h-0 min-w-0 flex-1" data-testid="legion-sheet-root">
        <ActorSheetTabRail
          tabs={[
            { id: "overview", label: "Overview", testId: "legion-sheet-tab-overview" },
            { id: "cargo", label: "Cargo", testId: "legion-sheet-tab-cargo" }
          ]}
          value={tab}
          onChange={handleTabChange}
          collapsed={railCollapsed}
          onCollapsedChange={handleRailCollapsed}
          onClose={handleClose}
          testId="legion-sheet-rail"
          // Close landmark stays the rail's own shared `actor-sheet-close`
          // (reuse, not a fork — the draft's `legion-sheet-close` is amended here).
          summarize={
            <div data-testid="legion-sheet-summary">
              <p>{title}</p>
              {props.ownerFactionId ? <p>{props.ownerFactionId}</p> : null}
              {props.memberCount != null ? <p>{props.memberCount} members</p> : null}
            </div>
          }
        />
        <div
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden px-4 py-4"
          data-testid="legion-sheet-panel"
        >
          {tab === "overview" ? (
            <div data-testid="legion-overview" data-role="identity-strip">
              <p>{title}</p>
              {props.ownerFactionId ? <p>Held by {props.ownerFactionId}</p> : null}
              {props.memberCount != null ? <p>{props.memberCount} members</p> : null}
              {props.legion ? <p>Stance {props.legion.stance}</p> : null}
            </div>
          ) : (
            <CargoTab
              worldId={props.worldId}
              entityId={props.entityId}
              turn={props.turn}
              commanderId={props.commanderId}
              displayName={props.displayName}
              ownerFactionId={props.ownerFactionId}
              legion={props.legion}
            />
          )}
        </div>
      </div>
    </PanelShell>
  );
}

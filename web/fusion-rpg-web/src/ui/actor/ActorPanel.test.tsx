import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { PLAYER_PENDING, adaptCommanderSheet } from "@/contract/adapt";
import { known, pendingWithReason } from "@/contract/pending";
import type { ActorView } from "@/contract/types";
import { actorSurfaceFixture } from "@/lib/bus/actorSurface";
import type { ActorRungState } from "./actorRungState";
import { ActorPanel, ActorSheet } from "./ActorPanel";
import { resetActorSheetObsForTests } from "./actorSheetObs";

function readyState(): ActorRungState {
  const data: ActorView = {
    instanceId: "a1",
    playerId: 1,
    side: "plant",
    typeId: 3,
    displayName: known("Emberling"),
    phase: "ActiveBound",
    level: 14,
    xp: 2140,
    xpToNext: pendingWithReason(PLAYER_PENDING.xpToNext),
    revision: 1,
    channelSummary: pendingWithReason(PLAYER_PENDING.channelSummary),
    elementTyping: pendingWithReason(PLAYER_PENDING.elementTyping),
    shieldStack: pendingWithReason(PLAYER_PENDING.shieldStack),
    equipSlots: pendingWithReason(PLAYER_PENDING.equipSlots)
  };
  return { kind: "ready", data };
}

describe("ActorPanel (catalog-era)", () => {
  beforeEach(() => {
    window.__fusionRpgActorSurface = actorSurfaceFixture();
    resetActorSheetObsForTests();
    const store = globalThis.localStorage as Storage | undefined;
    if (store && typeof store.removeItem === "function") {
      store.removeItem("fusionRpg.actorSheet.railCollapsed");
    }
  });

  it("exports ActorSheet as an alias of ActorPanel", () => {
    expect(ActorSheet).toBe(ActorPanel);
  });

  it("uses the near-fullscreen actorSheet size bound", () => {
    renderWithProviders(<ActorPanel state={readyState()} open onOpenChange={vi.fn()} />);
    const panel = screen.getByTestId("actor-panel");
    expect(panel.className).toContain("h-[min(960px,92vh)]");
    expect(panel.className).toContain("w-[min(1800px,96vw)]");
  });

  it("still short-circuits non-ready states to RungStateFallback before any tab bar renders", () => {
    renderWithProviders(<ActorPanel state={{ kind: "loading" }} open onOpenChange={vi.fn()} />);
    expect(screen.getByTestId("actor-panel-loading")).toBeInTheDocument();
    expect(screen.queryByTestId("actor-sheet-tabs")).not.toBeInTheDocument();
  });

  it("renders eight catalog tabs from actor-sheet.v1.json", () => {
    renderWithProviders(<ActorPanel state={readyState()} open onOpenChange={vi.fn()} />);
    expect(screen.getByTestId("actor-sheet-tab-condition")).toBeInTheDocument();
    expect(screen.getByTestId("actor-sheet-tab-aptitudes")).toBeInTheDocument();
    expect(screen.getByTestId("actor-sheet-tab-derived")).toBeInTheDocument();
    expect(screen.getByTestId("actor-sheet-tab-shield")).toBeInTheDocument();
    expect(screen.getByTestId("actor-sheet-tab-status")).toBeInTheDocument();
    expect(screen.getByTestId("actor-sheet-tab-elements")).toBeInTheDocument();
    expect(screen.getByTestId("actor-sheet-tab-kit")).toBeInTheDocument();
    expect(screen.getByTestId("actor-sheet-tab-paths")).toBeInTheDocument();
    expect(screen.queryByTestId("actor-sheet-tab-overview")).not.toBeInTheDocument();
  });

  it("shows actor summarize with name, level, and role-badge on the left rail", () => {
    renderWithProviders(<ActorPanel state={readyState()} open onOpenChange={vi.fn()} />);
    expect(screen.getByTestId("actor-sheet-rail")).toHaveAttribute("data-collapsed", "false");
    expect(screen.getByTestId("actor-summarize-name")).toHaveTextContent("Emberling");
    expect(screen.getByTestId("actor-summarize-level")).toHaveTextContent("Lv 14");
    expect(screen.getByTestId("role-badge")).toHaveTextContent("Plant");
    expect(screen.getByTestId("actor-panel-header")).toHaveAttribute("data-header-mode", "none");
    expect(screen.getByTestId("actor-sheet-close")).toBeInTheDocument();
  });

  it("Esc in the left rail closes the panel", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderWithProviders(<ActorPanel state={readyState()} open onOpenChange={onOpenChange} />);
    await user.click(screen.getByTestId("actor-sheet-close"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("collapses the rail to icon-only and restores labels on toggle", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ActorPanel state={readyState()} open onOpenChange={vi.fn()} />);

    await user.click(screen.getByTestId("actor-sheet-rail-toggle"));
    expect(screen.getByTestId("actor-sheet-rail")).toHaveAttribute("data-collapsed", "true");
    expect(screen.getByTestId("actor-summarize-glyph")).toBeInTheDocument();
    expect(screen.queryByTestId("actor-summarize-name")).not.toBeInTheDocument();
    expect(screen.getByTestId("actor-sheet-tab-condition")).toHaveAttribute("aria-label", "Condition");

    await user.click(screen.getByTestId("actor-sheet-rail-toggle"));
    expect(screen.getByTestId("actor-sheet-rail")).toHaveAttribute("data-collapsed", "false");
    expect(screen.getByTestId("actor-summarize-name")).toBeInTheDocument();
  });

  it("commander summarize uses Commander role label", () => {
    const state: ActorRungState = {
      kind: "ready",
      data: adaptCommanderSheet(
        {
          id: "commander:dave",
          displayName: "Crazy Dave",
          isDefault: true,
          activeAuraId: "Might",
          activeAuraName: "Might",
          locationStub: null,
          legionStub: null
        },
        1
      )
    };
    renderWithProviders(
      <ActorPanel
        state={state}
        open
        onOpenChange={vi.fn()}
        role="commander"
        commanderMeta={{
          isDefault: true,
          activeAuraName: "Might",
          locationStub: null,
          legionStub: null
        }}
        onSetDefault={vi.fn()}
        onDefendLawn={vi.fn()}
        onOpenCommandersList={vi.fn()}
      />
    );
    expect(screen.getByTestId("actor-summarize-name")).toHaveTextContent("Crazy Dave");
    expect(screen.getByTestId("role-badge")).toHaveTextContent(/Commander/);
  });

  it("defaults to Condition with honest Standing / xpToNext pending (never fabricated)", () => {
    renderWithProviders(<ActorPanel state={readyState()} open onOpenChange={vi.fn()} />);
    expect(screen.getByTestId("actor-standing-pending")).toBeInTheDocument();
    expect(screen.getByTestId("condition-xp-pending")).toBeInTheDocument();
    expect(screen.getByTestId("condition-xp-count")).toHaveTextContent(/2[,.]?140|2140/);
  });

  it("Condition iterates every resource-catalog row including poise with plant Sun label", () => {
    renderWithProviders(<ActorPanel state={readyState()} open onOpenChange={vi.fn()} />);
    expect(screen.getByTestId("condition-resource-poise")).toBeInTheDocument();
    expect(screen.getByTestId("condition-resource-hunger")).toHaveTextContent("Sun");
  });

  it("switching tabs shows only the active tab's own content", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ActorPanel state={readyState()} open onOpenChange={vi.fn()} />);

    await user.click(screen.getByTestId("actor-sheet-tab-kit"));
    expect(screen.queryByTestId("actor-standing-pending")).not.toBeInTheDocument();
    expect(screen.getByTestId("kit-tab")).toBeInTheDocument();
    expect(screen.getByTestId("kit-equip-pending")).toBeInTheDocument();

    await user.click(screen.getByTestId("actor-sheet-tab-condition"));
    expect(await screen.findByTestId("actor-standing-pending")).toBeInTheDocument();
  });

  it("Shield tab stays honest pending and never says Ward", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ActorPanel state={readyState()} open onOpenChange={vi.fn()} />);
    await user.click(screen.getByTestId("actor-sheet-tab-shield"));
    expect(screen.getByTestId("actor-shield-pending")).toBeInTheDocument();
    expect(screen.getByTestId("shield-tab").textContent).not.toMatch(/Ward/i);
  });

  it("emits sheet open observability", () => {
    renderWithProviders(<ActorPanel state={readyState()} open onOpenChange={vi.fn()} />);
    expect(window.__fusionRpgActorSheetObs?.[0]?.channel).toBe("actor-sheet.open");
  });

  it("Kit tab has no placeholder Strike/Firebolt actions", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ActorPanel state={readyState()} open onOpenChange={vi.fn()} />);
    await user.click(screen.getByTestId("actor-sheet-tab-kit"));
    expect(screen.getByTestId("kit-tab")).toBeInTheDocument();
    expect(screen.queryByText("Strike")).not.toBeInTheDocument();
    expect(screen.queryByText("Firebolt")).not.toBeInTheDocument();
    expect(screen.queryByTestId("actions-tab")).not.toBeInTheDocument();
  });

  it("leftover footer is absent on Condition and present (pending or ready) on Aptitudes", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ActorPanel state={readyState()} open onOpenChange={vi.fn()} />);
    expect(screen.queryByTestId("actor-leftover-footer")).not.toBeInTheDocument();
    expect(screen.getByTestId("actor-panel-deploy")).toBeInTheDocument();

    await user.click(screen.getByTestId("actor-sheet-tab-aptitudes"));
    expect(screen.getByTestId("actor-leftover-footer")).toBeInTheDocument();
    expect(screen.queryByTestId("actor-panel-deploy")).not.toBeInTheDocument();
    expect(screen.queryByTestId("actor-panel-release")).not.toBeInTheDocument();
  });

  it("Release and Deploy each close the panel", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderWithProviders(<ActorPanel state={readyState()} open onOpenChange={onOpenChange} />);

    await user.click(screen.getByTestId("actor-panel-release"));
    expect(onOpenChange).toHaveBeenCalledWith(false);

    onOpenChange.mockClear();
    await user.click(screen.getByTestId("actor-panel-deploy"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("commander role shows CommanderSheetFooter and hides Deploy/Release", () => {
    const state: ActorRungState = {
      kind: "ready",
      data: adaptCommanderSheet(
        {
          id: "commander:dave",
          displayName: "Crazy Dave",
          isDefault: true,
          activeAuraId: "Might",
          activeAuraName: "Might",
          locationStub: null,
          legionStub: null
        },
        1
      )
    };
    renderWithProviders(
      <ActorPanel
        state={state}
        open
        onOpenChange={vi.fn()}
        role="commander"
        commanderMeta={{
          isDefault: true,
          activeAuraName: "Might",
          locationStub: null,
          legionStub: null
        }}
        onSetDefault={vi.fn()}
        onDefendLawn={vi.fn()}
        onOpenCommandersList={vi.fn()}
      />
    );
    expect(screen.getByTestId("commander-sheet-set-default")).toBeInTheDocument();
    expect(screen.getByTestId("commander-sheet-defend")).toBeInTheDocument();
    expect(screen.queryByTestId("actor-panel-deploy")).not.toBeInTheDocument();
    expect(screen.queryByTestId("actor-panel-release")).not.toBeInTheDocument();
    expect(screen.getByTestId("commander-sheet-overview-default")).toBeInTheDocument();
  });

  it("commander role wires Set default and Defend callbacks from the footer", async () => {
    const user = userEvent.setup();
    const onSetDefault = vi.fn();
    const onDefendLawn = vi.fn();
    const state: ActorRungState = {
      kind: "ready",
      data: adaptCommanderSheet(
        {
          id: "commander:penny",
          displayName: "Penny",
          isDefault: false,
          activeAuraId: null,
          activeAuraName: null,
          locationStub: null,
          legionStub: null
        },
        1
      )
    };
    renderWithProviders(
      <ActorPanel
        state={state}
        open
        onOpenChange={vi.fn()}
        role="commander"
        commanderMeta={{
          isDefault: false,
          activeAuraName: null,
          locationStub: null,
          legionStub: null
        }}
        onSetDefault={onSetDefault}
        onDefendLawn={onDefendLawn}
        onOpenCommandersList={vi.fn()}
      />
    );
    await user.click(screen.getByTestId("commander-sheet-set-default"));
    await user.click(screen.getByTestId("commander-sheet-defend"));
    expect(onSetDefault).toHaveBeenCalledTimes(1);
    expect(onDefendLawn).toHaveBeenCalledTimes(1);
  });

  it("commander role can switch to Aptitudes without Deploy or Release", async () => {
    const user = userEvent.setup();
    const state: ActorRungState = {
      kind: "ready",
      data: adaptCommanderSheet(
        {
          id: "commander:dave",
          displayName: "Crazy Dave",
          isDefault: true,
          activeAuraId: "Might",
          activeAuraName: "Might",
          locationStub: null,
          legionStub: null
        },
        1
      )
    };
    renderWithProviders(
      <ActorPanel
        state={state}
        open
        onOpenChange={vi.fn()}
        role="commander"
        commanderMeta={{
          isDefault: true,
          activeAuraName: "Might",
          locationStub: null,
          legionStub: null
        }}
        onSetDefault={vi.fn()}
        onDefendLawn={vi.fn()}
        onOpenCommandersList={vi.fn()}
      />
    );
    await user.click(screen.getByTestId("actor-sheet-tab-aptitudes"));
    expect(screen.getByTestId("actor-panel")).toBeInTheDocument();
    expect(screen.queryByTestId("actor-panel-deploy")).not.toBeInTheDocument();
    expect(screen.queryByTestId("actor-panel-release")).not.toBeInTheDocument();
  });

  it("shows Set default (next run) when matchBanner is set", () => {
    const state: ActorRungState = {
      kind: "ready",
      data: adaptCommanderSheet(
        {
          id: "commander:dave",
          displayName: "Crazy Dave",
          isDefault: true,
          activeAuraId: "Might",
          activeAuraName: "Might",
          locationStub: null,
          legionStub: null
        },
        1
      )
    };
    renderWithProviders(
      <ActorPanel
        state={state}
        open
        onOpenChange={vi.fn()}
        role="commander"
        matchBanner={{ displayName: "Crazy Dave", auraDisplayName: "Might" }}
        commanderMeta={{
          isDefault: true,
          activeAuraName: "Might",
          locationStub: null,
          legionStub: null
        }}
        onSetDefault={vi.fn()}
        onDefendLawn={vi.fn()}
        onOpenCommandersList={vi.fn()}
      />
    );
    expect(screen.getByTestId("commander-sheet-match-banner")).toHaveTextContent("This match: Crazy Dave · Might");
    expect(screen.getByTestId("commander-sheet-set-default")).toHaveTextContent("Set default (next run)");
  });

  it("matchBanner without aura omits the separator", () => {
    const state: ActorRungState = {
      kind: "ready",
      data: adaptCommanderSheet(
        {
          id: "commander:dave",
          displayName: "Dave",
          isDefault: true,
          activeAuraId: null,
          activeAuraName: null,
          locationStub: null,
          legionStub: null
        },
        1
      )
    };
    renderWithProviders(
      <ActorPanel
        state={state}
        open
        onOpenChange={vi.fn()}
        role="commander"
        matchBanner={{ displayName: "Dave", auraDisplayName: null }}
        commanderMeta={{
          isDefault: true,
          activeAuraName: null,
          locationStub: null,
          legionStub: null
        }}
        onSetDefault={vi.fn()}
        onDefendLawn={vi.fn()}
        onOpenCommandersList={vi.fn()}
      />
    );
    expect(screen.getByTestId("commander-sheet-match-banner")).toHaveTextContent("This match: Dave");
    expect(screen.getByTestId("commander-sheet-match-banner").textContent).not.toContain(" · ");
  });
});

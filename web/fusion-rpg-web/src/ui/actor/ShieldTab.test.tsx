import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PLAYER_PENDING } from "@/contract/adapt";
import { known, pendingWithReason } from "@/contract/pending";
import type { ActorView } from "@/contract/types";
import { actorSurfaceFixture } from "@/lib/bus/actorSurface";
import type { ActorSheetDto } from "@/lib/bus/aura";
import { clearPieceRegistryForTests } from "@/features/gui-lego/pieceRegistry";
import { clearRecipeRegistryForTests } from "@/features/gui-lego/recipeRegistry";
import { resetDerivedPiecesRegistrationFlagForTests } from "@/ui/gui-lego/pieces/register";
import { ShieldTab } from "./ShieldTab";

function actor(): ActorView {
  return {
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
}

function sheetWithLayers(): ActorSheetDto {
  return {
    instanceId: "a1",
    playerId: 1,
    side: "plant",
    typeId: 3,
    displayName: "Emberling",
    level: 14,
    derived: [],
    primary: [],
    shieldSummary: { elementId: "ice", current: 40, max: 40, stacks: 1 },
    shieldLayers: [
      {
        shieldId: "aura-1",
        elementId: "ice",
        current: 40,
        max: 40,
        priority: 30,
        sourceId: "aura:ice",
        isInnate: false
      }
    ]
  };
}

describe("ShieldTab", () => {
  beforeEach(() => {
    window.__fusionRpgActorSurface = actorSurfaceFixture();
    clearPieceRegistryForTests();
    clearRecipeRegistryForTests();
    resetDerivedPiecesRegistrationFlagForTests();
  });

  it("pending: no Empty layer wells and never says Ward", () => {
    render(<ShieldTab data={actor()} />);
    expect(screen.getByTestId("shield-tab")).toBeInTheDocument();
    expect(screen.getByTestId("actor-shield-pending")).toBeInTheDocument();
    expect(screen.queryByText(/Empty layer/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId("shield-well-1")).not.toBeInTheDocument();
    expect(screen.getByTestId("shield-tab").textContent).not.toMatch(/Ward/i);
  });

  it("hot layers: mounts stack bar + inspect + omni region", () => {
    render(<ShieldTab data={actor()} sheet={sheetWithLayers()} />);
    expect(screen.getByTestId("shield-console")).toBeInTheDocument();
    expect(screen.getByTestId("shield-stack-bar")).toBeInTheDocument();
    expect(screen.getByTestId("shield-segment-aura-1")).toBeInTheDocument();
    expect(screen.getByTestId("shield-segment-aura-1")).toHaveTextContent(/Aura/i);
    expect(screen.getByTestId("shield-layer-inspect")).toBeInTheDocument();
    expect(screen.getByTestId("shield-omni-region")).toBeInTheDocument();
    expect(screen.queryByText(/Empty layer/i)).not.toBeInTheDocument();
    expect(screen.getByTestId("shield-tab").textContent).not.toMatch(/Ward/i);
  });

  it("hot-empty: dashed empty slots without Empty layer labels", () => {
    render(
      <ShieldTab
        data={actor()}
        sheet={{
          ...sheetWithLayers(),
          shieldLayers: [],
          shieldSummary: null
        }}
      />
    );
    expect(screen.getByTestId("shield-empty-slot-1")).toBeInTheDocument();
    expect(screen.getByTestId("shield-empty-slot-2")).toBeInTheDocument();
    expect(screen.getByTestId("shield-empty-slot-3")).toBeInTheDocument();
    expect(screen.queryByText(/Empty layer/i)).not.toBeInTheDocument();
  });

  it("selects a layer on segment click", async () => {
    const user = userEvent.setup();
    const two: ActorSheetDto = {
      ...sheetWithLayers(),
      shieldSummary: { elementId: "ice", current: 100, max: 100, stacks: 2 },
      shieldLayers: [
        {
          shieldId: "aura-1",
          elementId: "ice",
          current: 40,
          max: 40,
          priority: 30,
          sourceId: "aura:ice",
          isInnate: false
        },
        {
          shieldId: "skill-1",
          elementId: "fire",
          current: 60,
          max: 60,
          priority: 20,
          sourceId: "skill:fire",
          isInnate: false
        }
      ]
    };
    render(<ShieldTab data={actor()} sheet={two} />);
    await user.click(screen.getByTestId("shield-segment-skill-1"));
    expect(screen.getByTestId("shield-layer-inspect")).toHaveTextContent(/Skill/i);
  });

  it("retry strip emits when sheet enrichment failed", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<ShieldTab data={actor()} sheetError onRetry={onRetry} />);
    await user.click(screen.getByTestId("shield-sheet-retry-button"));
    expect(onRetry).toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PLAYER_PENDING } from "@/contract/adapt";
import { known, pendingWithReason } from "@/contract/pending";
import type { ActorView } from "@/contract/types";
import { actorSurfaceFixture } from "@/lib/bus/actorSurface";
import { ConditionTab } from "./ConditionTab";

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

describe("ConditionTab", () => {
  it("renders one meter slot per resource-catalog entry including poise", () => {
    const surface = actorSurfaceFixture();
    render(<ConditionTab data={actor()} surface={surface} />);
    for (const resource of surface.resources) {
      expect(screen.getByTestId(`condition-resource-${resource.id}`)).toBeInTheDocument();
    }
    expect(screen.getByTestId("condition-resource-hunger")).toHaveTextContent("Sun");
  });

  it("keeps Standing and xpToNext honest pending without fabricated zero fills", () => {
    render(<ConditionTab data={actor()} surface={actorSurfaceFixture()} />);
    expect(screen.getByTestId("actor-standing-pending")).toBeInTheDocument();
    expect(screen.getByTestId("condition-xp-pending")).toBeInTheDocument();
    expect(screen.getByTestId("condition-hp-radial")).toHaveAttribute("data-pending", "true");
    expect(screen.getByTestId("condition-resource-hp")).toHaveAttribute("data-pending", "true");
    expect(screen.queryByTestId("condition-console")?.querySelector(".inspect-split")).toBeNull();
  });

  it("selects a meter on click", async () => {
    const user = userEvent.setup();
    render(<ConditionTab data={actor()} surface={actorSurfaceFixture()} />);
    const poise = screen.getByTestId("condition-resource-poise");
    await user.click(poise);
    expect(poise.className).toContain("is-on");
  });

  it("opens status tab when a live glyph is clicked", async () => {
    const user = userEvent.setup();
    const onOpenStatusTab = vi.fn();
    const surface = actorSurfaceFixture();
    const status = surface.statuses[0]!;
    render(
      <ConditionTab
        data={actor()}
        surface={surface}
        sheet={{
          instanceId: "a1",
          playerId: 1,
          side: "plant",
          typeId: 3,
          displayName: "Emberling",
          level: 14,
          xp: 2140,
          xpToNext: 3400,
          derived: [],
          primary: [],
          liveStatuses: [{ statusId: status.id, remainingPermille: 500 }]
        }}
        onOpenStatusTab={onOpenStatusTab}
      />
    );
    await user.click(screen.getByTestId("condition-live-effects").querySelector("button")!);
    expect(onOpenStatusTab).toHaveBeenCalledTimes(1);
  });

  it("shows compact sheet retry and keeps glance mounted on sheet error", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(
      <ConditionTab data={actor()} surface={actorSurfaceFixture()} sheetError onRetry={onRetry} />
    );
    expect(screen.getByTestId("condition-sheet-retry")).toBeInTheDocument();
    expect(screen.getByTestId("condition-console")).toBeInTheDocument();
    expect(screen.getByTestId("actor-standing-pending")).toBeInTheDocument();
    await user.click(screen.getByTestId("condition-sheet-retry-button"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("omits status strip entirely when sheet has no live effects (Q3)", () => {
    render(
      <ConditionTab
        data={actor()}
        surface={actorSurfaceFixture()}
        sheet={{
          instanceId: "a1",
          playerId: 1,
          side: "plant",
          typeId: 3,
          displayName: "Emberling",
          level: 14,
          xp: 2140,
          xpToNext: 3400,
          derived: [],
          primary: [],
          liveStatuses: []
        }}
      />
    );
    expect(screen.queryByTestId("condition-status-strip")).not.toBeInTheDocument();
    expect(screen.queryByTestId("condition-live-effects")).not.toBeInTheDocument();
    expect(screen.queryByTestId("condition-live-effects-empty")).not.toBeInTheDocument();
  });

  it("is RecipeMount-only — no mute chip twin path for identity", () => {
    render(
      <ConditionTab
        data={actor()}
        surface={actorSurfaceFixture()}
        sheet={{
          instanceId: "a1",
          playerId: 1,
          side: "plant",
          typeId: 3,
          displayName: "Emberling",
          speciesName: "Sunflower",
          phase: "ActiveBound",
          level: 14,
          xp: 2140,
          xpToNext: 3400,
          elementTyping: { primary: "fire", secondary: "light" },
          derived: [],
          primary: [],
          liveStatuses: []
        }}
      />
    );
    expect(screen.getByTestId("condition-tab-host").querySelector(".chip")).toBeNull();
    expect(screen.getByTestId("phase-badge")).toHaveTextContent("ActiveBound");
    expect(screen.getByTestId("element-badge-fire")).toBeInTheDocument();
    expect(screen.getByTestId("element-badge-light")).toBeInTheDocument();
  });

  it("sheet standing + pools light meters and bars; species on identity piece", () => {
    render(
      <ConditionTab
        data={actor()}
        surface={actorSurfaceFixture()}
        sheet={{
          instanceId: "a1",
          playerId: 1,
          side: "plant",
          typeId: 3,
          displayName: "Emberling",
          speciesName: "Sunflower",
          phase: "ActiveBound",
          level: 14,
          xp: 2140,
          xpToNext: 3400,
          elementTyping: { primary: "fire", secondary: "light" },
          standing: {
            offense: 77,
            survivability: 58,
            control: 36,
            utility: 26,
            economy: 49
          },
          resourcePools: [
            { resourceId: "hp", current: 1240, max: 1800 },
            { resourceId: "stamina", current: 44, max: 60 },
            { resourceId: "hunger", current: 12, max: 40 },
            { resourceId: "spirit", current: 22, max: 40 },
            { resourceId: "qi", current: 8, max: 24 },
            { resourceId: "poise", current: 18, max: 20 }
          ],
          derived: [],
          primary: [],
          liveStatuses: []
        }}
      />
    );
    const consoleEl = screen.getByTestId("condition-console");
    expect(consoleEl.querySelector('[data-grid-area="prog"]')).toBeTruthy();
    expect(consoleEl.querySelector('[data-grid-area="identity"]')).toBeTruthy();
    expect(consoleEl.querySelector('[data-grid-area="hero"]')).toBeTruthy();
    expect(consoleEl.querySelector('[data-grid-area="stand"]')).toBeTruthy();
    expect(screen.getByTestId("condition-actor-identity")).toHaveTextContent("Sunflower");
    expect(screen.queryByTestId("actor-standing-pending")).not.toBeInTheDocument();
    expect(screen.getByTestId("condition-resource-hp")).not.toHaveAttribute("data-pending", "true");
    expect(screen.getByTestId("condition-resource-hp")).toHaveTextContent(/1,?240/);
    expect(screen.getByTestId("condition-resource-hp").querySelector(".fill")).toBeTruthy();
    expect(screen.getByTestId("condition-hp-radial")).not.toHaveAttribute("data-pending", "true");
    expect(screen.getByTestId("condition-hp-radial").querySelector(".radial-hp")).toBeTruthy();
    expect(screen.getByTestId("condition-hp-radial").querySelector(".v")).toBeNull();
    expect(screen.getByTestId("condition-resource-hp").querySelector(".cap-title")).toBeNull();
  });
});

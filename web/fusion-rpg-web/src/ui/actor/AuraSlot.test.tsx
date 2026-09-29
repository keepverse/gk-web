import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuraSlot } from "./AuraSlot";

describe("AuraSlot", () => {
  it("active vs equipped-inactive is unmistakable, not a subtle tint", () => {
    const { rerender } = render(
      <AuraSlot auraId="Might" state="active" onEnable={vi.fn()} onDisable={vi.fn()} />
    );
    expect(screen.getByTestId("aura-slot-Might-badge")).toHaveTextContent("Active");
    expect(screen.getByTestId("aura-slot-Might")).toHaveAttribute("data-state", "active");

    rerender(<AuraSlot auraId="Might" state="equipped-inactive" onEnable={vi.fn()} onDisable={vi.fn()} />);
    expect(screen.getByTestId("aura-slot-Might-badge")).toHaveTextContent("Equipped");
    expect(screen.getByTestId("aura-slot-Might")).toHaveAttribute("data-state", "equipped-inactive");
  });

  it("a gated aura is locked with its real reason, never a generic string", () => {
    render(
      <AuraSlot
        auraId="Onslaught"
        state="locked"
        lockedReason="Not equipped -- assign it in your loadout first"
        onEnable={vi.fn()}
        onDisable={vi.fn()}
      />
    );
    const slot = screen.getByTestId("aura-slot-Onslaught");
    expect(slot).toHaveAttribute("title", "Not equipped -- assign it in your loadout first");
    expect(screen.queryByTestId("aura-slot-Onslaught-toggle")).not.toBeInTheDocument();
  });

  it("clicking Enable on an equipped-inactive slot calls onEnable, not onDisable", () => {
    const onEnable = vi.fn();
    const onDisable = vi.fn();
    render(<AuraSlot auraId="Might" state="equipped-inactive" onEnable={onEnable} onDisable={onDisable} />);
    fireEvent.click(screen.getByTestId("aura-slot-Might-toggle"));
    expect(onEnable).toHaveBeenCalledTimes(1);
    expect(onDisable).not.toHaveBeenCalled();
  });

  it("clicking Disable on an active slot calls onDisable, not onEnable", () => {
    const onEnable = vi.fn();
    const onDisable = vi.fn();
    render(<AuraSlot auraId="Might" state="active" onEnable={onEnable} onDisable={onDisable} />);
    fireEvent.click(screen.getByTestId("aura-slot-Might-toggle"));
    expect(onDisable).toHaveBeenCalledTimes(1);
    expect(onEnable).not.toHaveBeenCalled();
  });

  it("an unaffordable/refused toggle stays visible and names why, disabled with reason (GG-55)", () => {
    render(
      <AuraSlot
        auraId="Fortitude"
        state="equipped-inactive"
        refusalReason="Enabling Fortitude switched off Might"
        busy={false}
        onEnable={vi.fn()}
        onDisable={vi.fn()}
      />
    );
    expect(screen.getByTestId("aura-slot-Fortitude-refusal")).toHaveTextContent(
      "Enabling Fortitude switched off Might"
    );
  });

  it("shows the upkeep note before the toggle when a real cost is authored", () => {
    render(
      <AuraSlot
        auraId="Might"
        state="equipped-inactive"
        upkeepNote="5 stamina per tick"
        onEnable={vi.fn()}
        onDisable={vi.fn()}
      />
    );
    expect(screen.getByTestId("aura-slot-Might-upkeep")).toHaveTextContent("5 stamina per tick");
  });

  it("renders no upkeep note when none is authored, never a fabricated placeholder", () => {
    render(<AuraSlot auraId="Might" state="equipped-inactive" onEnable={vi.fn()} onDisable={vi.fn()} />);
    expect(screen.queryByTestId("aura-slot-Might-upkeep")).not.toBeInTheDocument();
  });

  it("busy disables the toggle so a second click cannot double-submit", () => {
    render(<AuraSlot auraId="Might" state="active" busy onEnable={vi.fn()} onDisable={vi.fn()} />);
    expect(screen.getByTestId("aura-slot-Might-toggle")).toBeDisabled();
  });
});

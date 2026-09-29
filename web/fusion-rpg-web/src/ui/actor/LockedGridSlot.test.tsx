import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LockedGridSlot } from "./LockedGridSlot";

describe("LockedGridSlot", () => {
  it("renders the label and names the real reason via title", () => {
    render(<LockedGridSlot id="firebolt" label="Firebolt" reason="Unlocks once the action system ships" />);
    const slot = screen.getByTestId("locked-slot-firebolt");
    expect(slot).toHaveTextContent("Firebolt");
    expect(slot).toHaveAttribute("title", "Unlocks once the action system ships");
  });

  it("is not an interactive control — no button role, no onClick", () => {
    render(<LockedGridSlot id="guard" label="Guard" reason="Locked" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("uses Rail's own real locked-state classes, not an independently invented look", () => {
    render(<LockedGridSlot id="overgrowth" label="Overgrowth" reason="Locked" />);
    const slot = screen.getByTestId("locked-slot-overgrowth");
    expect(slot.className).toContain("opacity-60");
    expect(slot.className).toContain("cursor-not-allowed");
  });

  it("keeps the testid stable when the label changes, since id is caller-supplied", () => {
    render(<LockedGridSlot id="overgrowth" label="Fire Bolt" reason="Locked" />);
    expect(screen.getByTestId("locked-slot-overgrowth")).toHaveTextContent("Fire Bolt");
  });
});

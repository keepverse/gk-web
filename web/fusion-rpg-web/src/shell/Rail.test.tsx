import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Rail } from "./Rail";
import { deriveRailEntries, type RailUnlockInputs } from "./railState";

const baseInputs: RailUnlockInputs = {
  currentStageId: "sanctum",
  hasCompletedARun: true,
  hasAnyCreature: false,
  hasAnyContract: false,
  hasAnyRelic: false,
  hasAnyBoundCreature: false,
  returnedExpeditionCount: 0,
  unreadResultCount: 2
};

describe("Rail", () => {
  it("renders all eight entries", () => {
    render(<Rail entries={deriveRailEntries(baseInputs)} onSelect={() => {}} />);
    for (const id of ["sanctum", "creatures", "commanders", "relics", "fusion", "pacts", "expeditions", "almanac", "chronicle"]) {
      expect(screen.getByTestId(`rail-${id}`)).toBeInTheDocument();
    }
  });

  it("a locked entry is disabled and carries its reason as a title", () => {
    render(<Rail entries={deriveRailEntries(baseInputs)} onSelect={() => {}} />);
    const relics = screen.getByTestId("rail-relics");
    expect(relics).toBeDisabled();
    expect(relics).toHaveAttribute("title", expect.stringContaining("item"));
  });

  it("a badged entry shows its count", () => {
    render(<Rail entries={deriveRailEntries(baseInputs)} onSelect={() => {}} />);
    expect(screen.getByTestId("rail-chronicle-badge")).toHaveTextContent("2");
  });

  it("clicking an available entry calls onSelect with its id", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Rail entries={deriveRailEntries(baseInputs)} onSelect={onSelect} />);
    await user.click(screen.getByTestId("rail-creatures"));
    expect(onSelect).toHaveBeenCalledWith("creatures");
  });

  it("clicking a locked entry never calls onSelect", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Rail entries={deriveRailEntries(baseInputs)} onSelect={onSelect} />);
    await user.click(screen.getByTestId("rail-relics"));
    expect(onSelect).not.toHaveBeenCalled();
  });

  // T25 (plate 01 §C / 02 §A / 04 §A): a vertical, left-docked icon-over-label column, not the
  // earlier horizontal strip.
  it("renders as a vertical icon-over-label dock, not a horizontal strip", () => {
    render(<Rail entries={deriveRailEntries(baseInputs)} onSelect={() => {}} />);
    expect(screen.getByTestId("rail")).toHaveClass("flex-col");
    const creatures = screen.getByTestId("rail-creatures");
    // icon-over-label: an aria-hidden glyph span plus the visible label text, both inside the button.
    expect(creatures.querySelector("span[aria-hidden='true']")).toBeInTheDocument();
    expect(creatures).toHaveTextContent("Creatures");
  });
});

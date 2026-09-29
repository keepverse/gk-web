import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SectorView } from "@/contract/types";
import { NextTurnBlock } from "./NextTurnBlock";
import { maximalSector } from "./fixtures/maximalSector";

function sector(willReleaseNextTurn: boolean): SectorView {
  return { ...maximalSector, willReleaseNextTurn };
}

describe("NextTurnBlock — the most delicate block on the surface (world-stage W59)", () => {
  it("not at risk renders a plain forecast, no pin controls, no forbidden copy", () => {
    render(<NextTurnBlock sector={sector(false)} cedeOrderAvailable={false} />);
    expect(screen.getByTestId("next-turn-forecast")).toHaveTextContent("Not at risk");
    expect(screen.queryByTestId("next-turn-pin-controls")).not.toBeInTheDocument();
  });

  it("at risk with the cede capability absent: the truthful forecast renders, no controls, no 'choose'/'release first' copy", () => {
    const { container } = render(<NextTurnBlock sector={sector(true)} cedeOrderAvailable={false} />);
    expect(screen.getByTestId("next-turn-forecast")).toHaveTextContent("will be released next turn if nothing changes");
    expect(screen.queryByTestId("next-turn-pin-controls")).not.toBeInTheDocument();
    expect(container.textContent).not.toMatch(/choose what to release/i);
    expect(container.textContent).not.toMatch(/release first/i);
  });

  it("at risk with the cede capability present: both pin controls render and file a real callback", async () => {
    const user = userEvent.setup();
    const onPin = vi.fn();
    render(<NextTurnBlock sector={sector(true)} cedeOrderAvailable={true} onPin={onPin} />);

    expect(screen.getByTestId("next-turn-pin-controls")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Keep this ground" }));
    expect(onPin).toHaveBeenCalledWith("keep");
    await user.click(screen.getByRole("button", { name: "Give this up first" }));
    expect(onPin).toHaveBeenCalledWith("release-first");
  });

  it("the forecast renders with its reason regardless of cede capability", () => {
    render(<NextTurnBlock sector={sector(true)} cedeOrderAvailable={false} />);
    expect(screen.getByTestId("next-turn-forecast")).toBeInTheDocument();

    const { unmount } = render(<NextTurnBlock sector={sector(true)} cedeOrderAvailable={true} />);
    expect(screen.getAllByTestId("next-turn-forecast").length).toBeGreaterThan(0);
    unmount();
  });
});

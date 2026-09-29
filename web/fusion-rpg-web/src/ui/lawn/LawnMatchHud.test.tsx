import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LawnMatchHud } from "./LawnMatchHud";

describe("LawnMatchHud", () => {
  it("renders Field CTA, connection, and optional clock", () => {
    render(
      <LawnMatchHud
        sun={150}
        wave={2}
        maxWave={5}
        clockLabel="01:23"
        phase="InMatch"
        connection="optional"
        deployed={[]}
        onField={vi.fn()}
      />
    );
    expect(screen.getByTestId("lawn-match-hud-field")).toBeInTheDocument();
    expect(screen.getByTestId("lawn-match-hud-connection")).toHaveAttribute("data-connection", "optional");
    expect(screen.getByTestId("lawn-match-hud-clock")).toHaveTextContent("01:23");
  });

  it("Field click invokes onField", async () => {
    const onField = vi.fn();
    const user = userEvent.setup();
    render(<LawnMatchHud deployed={[]} onField={onField} />);
    await user.click(screen.getByTestId("lawn-match-hud-field"));
    expect(onField).toHaveBeenCalledTimes(1);
  });
});

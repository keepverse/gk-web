import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { FightInputPanel } from "./FightInputPanel";

describe("FightInputPanel (D5.7, spec-delve-stage.md §7 — the steered party's input surface)", () => {
  it("renders its own real, honest pending reason — no session client exists yet (D5.11/D2.16)", () => {
    render(<FightInputPanel />);
    expect(screen.getByTestId("delve-fight-input-dwell")).toHaveTextContent(
      "Fight controls aren't shown yet"
    );
    expect(screen.getByTestId("delve-fight-input-chooser")).toHaveTextContent(
      "Fight controls aren't shown yet"
    );
  });

  it("never renders the frozen banner when nothing is known to be frozen", () => {
    render(<FightInputPanel />);
    expect(screen.queryByTestId("delve-fight-input-frozen")).not.toBeInTheDocument();
  });

  it("renders zero interactive controls — no session exists to wire a real chooser to yet", () => {
    render(<FightInputPanel />);
    const root = screen.getByTestId("delve-panel-fight");
    expect(root.querySelectorAll("button, input, select, textarea, a[href]")).toHaveLength(0);
  });
});

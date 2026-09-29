import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Magnitude } from "@/contract/types";
import { ComponentSplit } from "./ComponentSplit";
import type { ComponentSplitInput } from "./componentSplitMath";

const net = (value: number): Magnitude => ({ unit: "loamUnits", value });
const c = (componentId: string, sectorCount: number, netValue: number): ComponentSplitInput => ({
  componentId,
  sectorCount,
  net: net(netValue)
});

describe("ComponentSplit — six states, three rows, colour fourth (world-stage W54)", () => {
  it("no territory renders a sentence, not four zeroes", () => {
    render(<ComponentSplit components={[]} />);
    expect(screen.getByTestId("component-split-empty")).toHaveTextContent(
      "No territory of your own to draw on yet."
    );
    expect(screen.queryByTestId("component-split")).not.toBeInTheDocument();
  });

  it("one component collapses entirely — nothing renders", () => {
    const { container } = render(<ComponentSplit components={[c("a", 4, 120)]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("split and solvent renders with no alarm on either row", () => {
    render(<ComponentSplit components={[c("a", 4, 120), c("b", 2, 60)]} />);
    expect(screen.getByTestId("component-split-row-a")).toHaveAttribute("data-state", "solvent");
    expect(screen.getByTestId("component-split-row-b")).toHaveAttribute("data-state", "solvent");
    expect(screen.queryByTestId(/component-split-alarm-/)).not.toBeInTheDocument();
  });

  it("one starving — only that row alarms", () => {
    render(<ComponentSplit components={[c("a", 4, 120), c("b", 2, -30)]} />);
    expect(screen.getByTestId("component-split-row-a")).toHaveAttribute("data-state", "solvent");
    expect(screen.getByTestId("component-split-row-b")).toHaveAttribute("data-state", "starving");
    expect(screen.getByTestId("component-split-alarm-b")).toBeInTheDocument();
    expect(screen.queryByTestId("component-split-alarm-a")).not.toBeInTheDocument();
  });

  it("both starving — both alarm independently", () => {
    render(<ComponentSplit components={[c("a", 4, -10), c("b", 2, -30)]} />);
    expect(screen.getByTestId("component-split-alarm-a")).toBeInTheDocument();
    expect(screen.getByTestId("component-split-alarm-b")).toBeInTheDocument();
  });

  it("many components: starving rows all show, solvent folds with a count, never exceeding the cap", () => {
    render(
      <ComponentSplit
        components={[c("solvent-1", 1, 10), c("starving-1", 1, -5), c("solvent-2", 1, 20), c("solvent-3", 1, 30), c("solvent-4", 1, 40)]}
      />
    );
    expect(screen.getByTestId("component-split-row-starving-1")).toBeInTheDocument();
    expect(screen.getByTestId("component-split-folded")).toHaveTextContent("+2 more, self-sufficient");
  });

  it("the alarm carries a non-colour glyph and its own words, not colour alone", () => {
    render(<ComponentSplit components={[c("a", 4, 120), c("b", 2, -30)]} />);
    const alarm = screen.getByTestId("component-split-alarm-b");
    expect(alarm).toHaveTextContent("can't cover its own keep");
    expect(alarm.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
    // Border weight differs too — a fourth, redundant channel, not the only one.
    expect(screen.getByTestId("component-split-row-b").className).toMatch(/border-2/);
    expect(screen.getByTestId("component-split-row-a").className).not.toMatch(/border-2/);
  });

  it("no reading uses the sub-floor text classes", () => {
    const { container } = render(<ComponentSplit components={[c("a", 4, 120), c("b", 2, -30)]} />);
    expect(container.innerHTML).not.toMatch(/\btext-(?:2xs|xs|faint)\b/);
  });
});

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ForceView } from "@/contract/types";
import { ForceMarker } from "./ForceMarker";

const legion: ForceView = {
  entityId: "e-dave-legion-1",
  ownerFactionId: "dave",
  kind: "Legion",
  exact: true,
  strength: { unit: "gameUnits", value: 330 }
};

describe("ForceMarker — a force standing still at a sector (world-stage W71)", () => {
  it("renders at the position it is given, real SVG, never HTML dropped into the SVG tree", () => {
    render(
      <svg>
        <ForceMarker force={legion} ownership="yours" x={40} y={60} selected={false} selectable />
      </svg>
    );
    const marker = screen.getByTestId("legion-marker-e-dave-legion-1");
    expect(marker.tagName.toLowerCase()).toBe("g");
    expect(marker).toHaveAttribute("transform", "translate(40, 60)");
    expect(marker.querySelector("circle")).not.toBeNull();
  });

  it("carries its ownership as a real data attribute, never colour alone", () => {
    render(
      <svg>
        <ForceMarker force={legion} ownership="yours" x={0} y={0} selected={false} selectable />
      </svg>
    );
    expect(screen.getByTestId("legion-marker-e-dave-legion-1")).toHaveAttribute("data-ownership", "yours");
  });

  it("a selectable marker fires its own callback and never lets the click fall through to the sector beneath it", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onSectorClick = vi.fn();
    render(
      <svg onClick={onSectorClick}>
        <ForceMarker force={legion} ownership="yours" x={0} y={0} selected={false} selectable onSelect={onSelect} />
      </svg>
    );
    await user.click(screen.getByTestId("legion-marker-e-dave-legion-1"));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSectorClick).not.toHaveBeenCalled();
  });

  it("an unselectable marker (not yours) still draws, but never responds to a click", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <svg>
        <ForceMarker force={legion} ownership="enemy" x={0} y={0} selected={false} selectable={false} onSelect={onSelect} />
      </svg>
    );
    const marker = screen.getByTestId("legion-marker-e-dave-legion-1");
    expect(marker).toHaveAttribute("data-selectable", "false");
    await user.click(marker);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("the selected state is a real data attribute", () => {
    render(
      <svg>
        <ForceMarker force={legion} ownership="yours" x={0} y={0} selected={true} selectable />
      </svg>
    );
    expect(screen.getByTestId("legion-marker-e-dave-legion-1")).toHaveAttribute("data-selected", "true");
  });
});

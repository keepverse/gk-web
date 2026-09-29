import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CellOccupancyDock } from "./CellOccupancyDock";
import type { Occupant } from "@/features/lawn/lawnViewModel";

const occupant: Occupant = {
  ptr: "P:3:2,4",
  side: "plant",
  typeId: 3,
  typeName: "Sunflower",
  row: 2,
  col: 4,
  hp: 100,
  maxHp: 100,
  flags: {}
};

describe("CellOccupancyDock", () => {
  it("renders collection rows when open", () => {
    render(
      <CellOccupancyDock
        open
        occupants={[occupant]}
        cellLabel="R2C4"
        onSelectRow={vi.fn()}
      />
    );
    expect(screen.getByTestId("cell-occupancy-dock")).toBeInTheDocument();
    expect(screen.getByTestId("cell-occupancy-dock-title")).toHaveTextContent("R2C4");
    expect(screen.getByTestId("cell-occupancy-collection")).toBeInTheDocument();
  });

  it("unmounts when closed", () => {
    const { rerender } = render(
      <CellOccupancyDock open occupants={[occupant]} cellLabel="R2C4" onSelectRow={vi.fn()} />
    );
    expect(screen.getByTestId("cell-occupancy-dock")).toBeInTheDocument();
    rerender(
      <CellOccupancyDock open={false} occupants={[occupant]} cellLabel="R2C4" onSelectRow={vi.fn()} />
    );
    expect(screen.queryByTestId("cell-occupancy-dock")).not.toBeInTheDocument();
  });
});

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { DoorView } from "@/contract/types";
import { DoorEdge } from "./DoorEdge";

const baseDoor: DoorView = {
  laneId: "l-1",
  fromSectorId: "s-1",
  toSectorId: "s-2",
  typeId: "passage",
  gateKeyId: null,
  state: "Open"
};

// DoorEdge renders <g>/<line>/<text> — real SVG elements, so the test tree needs a real <svg> parent
// for a browser DOM to accept them without warnings; jsdom is lenient either way, but this matches
// how the door is actually mounted in DelveGraph.tsx.
function renderDoor(door: DoorView) {
  return render(
    <svg>
      <DoorEdge door={door} from={{ x: 0, y: 0 }} to={{ x: 100, y: 0 }} />
    </svg>
  );
}

describe("DoorEdge — door-kind visual rules (D5.4)", () => {
  it("passage: no gate mark, no arrow, no dashing", () => {
    renderDoor(baseDoor);
    const g = screen.getByTestId("delve-door-l-1");
    expect(g).toHaveAttribute("data-gated", "false");
    expect(g).toHaveAttribute("data-one-way", "false");
    expect(g).toHaveAttribute("data-secret", "false");
    expect(screen.queryByTestId("delve-door-gate-mark")).not.toBeInTheDocument();
  });

  it("gated (by gateKeyId): renders the gate mark", () => {
    renderDoor({ ...baseDoor, typeId: "gated", gateKeyId: "key-1" });
    expect(screen.getByTestId("delve-door-l-1")).toHaveAttribute("data-gated", "true");
    expect(screen.getByTestId("delve-door-gate-mark")).toBeInTheDocument();
  });

  it("one-way: the line references the arrow marker", () => {
    const { container } = renderDoor({ ...baseDoor, typeId: "one-way" });
    expect(screen.getByTestId("delve-door-l-1")).toHaveAttribute("data-one-way", "true");
    const line = container.querySelector("line");
    expect(line).toHaveAttribute("marker-end", "url(#delve-door-arrow)");
  });

  it("secret: distinct dashed/faint treatment, no arrow, no gate mark", () => {
    renderDoor({ ...baseDoor, typeId: "secret" });
    const g = screen.getByTestId("delve-door-l-1");
    expect(g).toHaveAttribute("data-secret", "true");
    expect(g).toHaveAttribute("data-one-way", "false");
    expect(screen.queryByTestId("delve-door-gate-mark")).not.toBeInTheDocument();
  });

  it("severed: its own treatment, independent of and combinable with any door kind", () => {
    renderDoor({ ...baseDoor, typeId: "gated", gateKeyId: "key-1", state: "Severed" });
    const g = screen.getByTestId("delve-door-l-1");
    expect(g).toHaveAttribute("data-severed", "true");
    expect(g).toHaveAttribute("data-gated", "true");
    // Still shows the gate mark — a broken gate is still a gate, just also broken.
    expect(screen.getByTestId("delve-door-gate-mark")).toBeInTheDocument();
  });

  it("every (typeId × state) combination renders without throwing", () => {
    const typeIds = ["passage", "gated", "one-way", "secret", "some-future-kind"];
    const states: DoorView["state"][] = ["Open", "Severed"];
    for (const typeId of typeIds) {
      for (const state of states) {
        expect(() => renderDoor({ ...baseDoor, typeId, state })).not.toThrow();
      }
    }
  });
});

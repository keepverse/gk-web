import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { known } from "@/contract/pending";
import type { DelveView, RoomView } from "@/contract/types";
import { useLayerStack } from "@/shell/layerStack";
import { DelvePanelHost } from "./DelvePanelHost";

function room(overrides: Partial<RoomView> = {}): RoomView {
  return {
    sectorId: "s-1",
    rowIndex: 0,
    colIndex: 0,
    visited: true,
    cleared: false,
    keyForLaneId: null,
    sight: "Full",
    kind: "fight",
    archetypeId: "a",
    eventId: null,
    resolvedKind: "fight",
    resolvedArchetypeId: "a",
    floorContents: { state: "absent" },
    ...overrides
  };
}

function delve(rooms: RoomView[]): DelveView {
  return {
    delveId: 1,
    worldId: "w",
    state: "Active",
    domainId: "d",
    raidMode: "solo",
    rungId: "r-1",
    soulsUnbanked: { unit: "count", value: 0 },
    rooms,
    doors: [],
    parties: [
      {
        partyIndex: 0,
        entityId: 501,
        atSectorId: "s-1",
        onLaneId: null,
        route: ["s-1"],
        members: [],
        pack: known({ rows: 4, cols: 6, cells: [], floor: [], provisionCellsLeft: { unit: "count", value: 4 } }),
        haul: []
      }
    ],
    revision: 1,
    quests: { state: "absent" }
  };
}

describe("DelvePanelHost (D5.7, spec-delve-stage.md §4/§7 — the six panels' own switch)", () => {
  beforeEach(() => {
    useLayerStack.setState({ layers: [] });
  });

  it("panel: null renders no dialog at all", () => {
    render(<DelvePanelHost panel={null} delve={delve([room()])} selectedRoomId={null} onClose={vi.fn()} />);
    expect(screen.queryByTestId("delve-stage-panel")).not.toBeInTheDocument();
  });

  it("panel: pack renders the real Pack panel with its own real title", () => {
    render(<DelvePanelHost panel="pack" delve={delve([room()])} selectedRoomId={null} onClose={vi.fn()} />);
    expect(screen.getByTestId("delve-panel-pack")).toBeInTheDocument();
    // PanelShell renders the title twice on purpose (a visible heading plus an sr-only Dialog
    // Description, since no `subtitle` is supplied) — assert on the visible heading specifically.
    expect(screen.getByRole("heading", { name: "Pack" })).toBeInTheDocument();
  });

  it("panel: talk resolves the selected room's own real kind — a wild room reaches the pending branch, a fight room reaches absent", () => {
    const d = delve([room({ sectorId: "s-1", kind: "wild", resolvedKind: "wild" }), room({ sectorId: "s-2" })]);

    const { rerender } = render(<DelvePanelHost panel="talk" delve={d} selectedRoomId="s-1" onClose={vi.fn()} />);
    expect(screen.getByTestId("delve-talk-fallback")).toHaveTextContent("What this room has to say isn't shown yet");

    rerender(<DelvePanelHost panel="talk" delve={d} selectedRoomId="s-2" onClose={vi.fn()} />);
    expect(screen.getByTestId("delve-talk-fallback")).toHaveTextContent("There's no one to talk to here.");
  });

  it("panel: event resolves the selected room's own real eventId — present reaches pending, null reaches absent", () => {
    const d = delve([room({ sectorId: "s-1", eventId: "evt-1" }), room({ sectorId: "s-2", eventId: null })]);

    const { rerender } = render(<DelvePanelHost panel="event" delve={d} selectedRoomId="s-1" onClose={vi.fn()} />);
    expect(screen.getByTestId("delve-event-kind")).toHaveTextContent("What's happening in this room isn't shown yet");

    rerender(<DelvePanelHost panel="event" delve={d} selectedRoomId="s-2" onClose={vi.fn()} />);
    expect(screen.getByTestId("delve-event-kind")).toHaveTextContent("There's nothing happening here.");
  });

  it("panel: object and panel: supply both read 'no room selected' as their own absent copy", () => {
    const d = delve([room()]);
    const { rerender } = render(<DelvePanelHost panel="object" delve={d} selectedRoomId={null} onClose={vi.fn()} />);
    expect(screen.getByTestId("delve-object-fallback")).toHaveTextContent("Pick a room first.");

    rerender(<DelvePanelHost panel="supply" delve={d} selectedRoomId={null} onClose={vi.fn()} />);
    expect(screen.getByTestId("delve-supply-fallback")).toHaveTextContent("Pick a room first.");
  });

  it("panel: fight renders the Fight input panel regardless of selection", () => {
    render(<DelvePanelHost panel="fight" delve={delve([room()])} selectedRoomId={null} onClose={vi.fn()} />);
    expect(screen.getByTestId("delve-panel-fight")).toBeInTheDocument();
  });

  it("pushes exactly one layer-stack entry while open, and none once panel is null", () => {
    const { rerender } = render(
      <DelvePanelHost panel="pack" delve={delve([room()])} selectedRoomId={null} onClose={vi.fn()} />
    );
    expect(useLayerStack.getState().layers).toHaveLength(1);

    rerender(<DelvePanelHost panel={null} delve={delve([room()])} selectedRoomId={null} onClose={vi.fn()} />);
    expect(useLayerStack.getState().layers).toHaveLength(0);
  });

  // `onOpenChange(false) -> onClose` is real, load-bearing wiring, but Radix's own outside-click/Esc
  // dismissal machinery is not reliably driven by jsdom's synthetic events in isolation (`PanelShell`
  // itself suppresses Radix's built-in Escape handling — GG-6: the layer stack owns Esc, not Radix) —
  // proven instead at the level that actually exercises it end to end, through the real global keymap:
  // `DelveStage.test.tsx`'s own `Route_round_trips_with_every_panel` and
  // `Esc_pops_one_panel_and_returns_to_the_same_stage_state` tests.
});

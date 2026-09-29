import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FightView, RoomView } from "@/contract/types";
import { known } from "@/contract/pending";
import { RoomNode } from "./RoomNode";
import type { RoomFightState } from "./FightInPlace";

const baseRoom: RoomView = {
  sectorId: "s-1",
  rowIndex: 0,
  colIndex: 0,
  visited: false,
  cleared: false,
  keyForLaneId: null,
  sight: "Full",
  kind: "fight",
  archetypeId: "a-1",
  eventId: null,
  resolvedKind: "fight",
  resolvedArchetypeId: "a-1",
  floorContents: { state: "absent" }
};

describe("RoomNode — the three sight treatments plus the secret-dead-end overlay (D5.4)", () => {
  it("None: no kind text anywhere, renders as undiscovered", () => {
    render(
      <RoomNode room={{ ...baseRoom, sight: "None", kind: null, resolvedKind: null }} selected={false} secretDeadEnd={false} onSelect={() => {}} />
    );
    const node = screen.getByTestId("delve-room-s-1");
    expect(node).toHaveAttribute("data-sight", "None");
    expect(screen.queryByTestId("delve-room-kind")).not.toBeInTheDocument();
    expect(node).toHaveAccessibleName("Undiscovered room");
  });

  it("Glimpse: shows the translated kind, never the raw id, never archetype/event detail", () => {
    render(
      <RoomNode
        room={{ ...baseRoom, sight: "Glimpse", resolvedKind: null, resolvedArchetypeId: null }}
        selected={false}
        secretDeadEnd={false}
        onSelect={() => {}}
      />
    );
    expect(screen.getByTestId("delve-room-kind")).toHaveTextContent("Fight");
    expect(screen.queryByTestId("delve-room-cleared-mark")).not.toBeInTheDocument();
  });

  it("Full: shows kind and, when cleared, the cleared mark", () => {
    render(<RoomNode room={{ ...baseRoom, sight: "Full", cleared: true }} selected={false} secretDeadEnd={false} onSelect={() => {}} />);
    expect(screen.getByTestId("delve-room-kind")).toHaveTextContent("Fight");
    expect(screen.getByTestId("delve-room-cleared-mark")).toBeInTheDocument();
  });

  it("Full but not cleared: no cleared mark", () => {
    render(<RoomNode room={{ ...baseRoom, sight: "Full", cleared: false }} selected={false} secretDeadEnd={false} onSelect={() => {}} />);
    expect(screen.queryByTestId("delve-room-cleared-mark")).not.toBeInTheDocument();
  });

  it("resolvedKind overrides kind when sight is Full (an event twisted the room)", () => {
    render(
      <RoomNode
        room={{ ...baseRoom, sight: "Full", kind: "wild", resolvedKind: "fight" }}
        selected={false}
        secretDeadEnd={false}
        onSelect={() => {}}
      />
    );
    expect(screen.getByTestId("delve-room-kind")).toHaveTextContent("Fight");
  });

  it("a key-bearing room shows its key mark regardless of sight (structural, never sight-gated)", () => {
    render(
      <RoomNode
        room={{ ...baseRoom, sight: "None", kind: null, resolvedKind: null, keyForLaneId: "l-gate" }}
        selected={false}
        secretDeadEnd={false}
        onSelect={() => {}}
      />
    );
    expect(screen.getByTestId("delve-room-key-mark")).toBeInTheDocument();
  });

  it("secretDeadEnd renders a distinct dashed treatment on top of whatever sight tier is showing", () => {
    render(<RoomNode room={baseRoom} selected={false} secretDeadEnd onSelect={() => {}} />);
    expect(screen.getByTestId("delve-room-s-1")).toHaveAttribute("data-secret-dead-end", "true");
  });

  it("selected renders data-selected and aria-pressed", () => {
    render(<RoomNode room={baseRoom} selected onSelect={() => {}} secretDeadEnd={false} />);
    const node = screen.getByTestId("delve-room-s-1");
    expect(node).toHaveAttribute("data-selected", "true");
    expect(node).toHaveAttribute("aria-pressed", "true");
  });

  it("is a real, focusable, keyboard-activatable button (GG-19/GG-21, spec-board-render.md's keyboard rule)", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<RoomNode room={baseRoom} selected={false} secretDeadEnd={false} onSelect={onSelect} />);

    const node = screen.getByTestId("delve-room-s-1");
    expect(node.tagName).toBe("BUTTON");
    node.focus();
    expect(node).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("every (sight × cleared × secretDeadEnd) combination renders without throwing", () => {
    const sights: RoomView["sight"][] = ["None", "Glimpse", "Full"];
    for (const sight of sights) {
      for (const cleared of [false, true]) {
        for (const secretDeadEnd of [false, true]) {
          expect(() =>
            render(
              <RoomNode
                room={{ ...baseRoom, sight, cleared, kind: sight === "None" ? null : "fight" }}
                selected={false}
                secretDeadEnd={secretDeadEnd}
                onSelect={() => {}}
              />
            )
          ).not.toThrow();
        }
      }
    }
  });
});

const knownFightView: FightView = {
  frozen: known(false),
  dwellRemaining: known({ unit: "milliseconds", value: 800 }),
  initiative: known([{}, {}]),
  strikeFeed: known([{}])
};

const fightState: RoomFightState = { fight: knownFightView, steered: true };

describe("RoomNode — the fight drawn in place (D5.5)", () => {
  it("with no fight prop, renders byte-identical to D5.4 — unexpanded, no fight subtree", () => {
    render(<RoomNode room={{ ...baseRoom, sight: "Full" }} selected={false} secretDeadEnd={false} onSelect={() => {}} />);
    const node = screen.getByTestId("delve-room-s-1");
    expect(node).toHaveAttribute("data-fight-expanded", "false");
    expect(screen.queryByTestId("delve-room-fight")).not.toBeInTheDocument();
  });

  it("a fight at a Full-sight room expands the node in place", () => {
    render(
      <RoomNode room={{ ...baseRoom, sight: "Full" }} selected={false} secretDeadEnd={false} fight={fightState} onSelect={() => {}} />
    );
    const node = screen.getByTestId("delve-room-s-1");
    expect(node).toHaveAttribute("data-fight-expanded", "true");
    expect(screen.getByTestId("delve-room-fight")).toBeInTheDocument();
    expect(node).toHaveAccessibleName("Fight — fight in progress");
  });

  it("a fight at a Glimpse-sight room does NOT expand — a glimpsed room never reveals fight detail", () => {
    render(
      <RoomNode
        room={{ ...baseRoom, sight: "Glimpse", resolvedKind: null, resolvedArchetypeId: null }}
        selected={false}
        secretDeadEnd={false}
        fight={fightState}
        onSelect={() => {}}
      />
    );
    const node = screen.getByTestId("delve-room-s-1");
    expect(node).toHaveAttribute("data-fight-expanded", "false");
    expect(screen.queryByTestId("delve-room-fight")).not.toBeInTheDocument();
  });

  it("a fight at an unlit (None-sight) room does NOT expand", () => {
    render(
      <RoomNode
        room={{ ...baseRoom, sight: "None", kind: null, resolvedKind: null, resolvedArchetypeId: null }}
        selected={false}
        secretDeadEnd={false}
        fight={fightState}
        onSelect={() => {}}
      />
    );
    expect(screen.queryByTestId("delve-room-fight")).not.toBeInTheDocument();
  });

  it("a fight never mounts as a separate screen: the expanded content is a descendant of the SAME room button, never a sibling or a portal", () => {
    const { container } = render(
      <RoomNode room={{ ...baseRoom, sight: "Full" }} selected={false} secretDeadEnd={false} fight={fightState} onSelect={() => {}} />
    );
    // Still exactly one button in the whole subtree — a fight expanding never nests a second
    // interactive control, and never opens outside this component's own returned element.
    expect(container.querySelectorAll("button")).toHaveLength(1);
    const button = screen.getByTestId("delve-room-s-1");
    expect(button.contains(screen.getByTestId("delve-room-fight"))).toBe(true);
  });

  it("the automated party has no input surface: an un-steered fight still renders through the same button, zero extra controls", () => {
    const { container } = render(
      <RoomNode
        room={{ ...baseRoom, sight: "Full" }}
        selected={false}
        secretDeadEnd={false}
        fight={{ fight: knownFightView, steered: false }}
        onSelect={() => {}}
      />
    );
    expect(container.querySelectorAll("button")).toHaveLength(1);
    expect(screen.getByTestId("delve-room-fight")).toHaveAttribute("data-steered", "false");
  });

  it("selecting the expanded room still calls onSelect (the fight content never intercepts the click)", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <RoomNode room={{ ...baseRoom, sight: "Full" }} selected={false} secretDeadEnd={false} fight={fightState} onSelect={onSelect} />
    );
    await user.click(screen.getByTestId("delve-room-s-1"));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});

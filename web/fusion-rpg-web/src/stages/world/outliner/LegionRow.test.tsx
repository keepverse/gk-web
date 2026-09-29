import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { LegionMemberView, LegionView } from "@/contract/types";
import { pendingWithReason, known, absent } from "@/contract/pending";
import { LegionRow } from "./LegionRow";

const R = (name: string) => pendingWithReason<never>(`no ${name} tracked in this test`);
const member: LegionMemberView = {
  instanceId: null,
  speciesId: "sunflower",
  level: { unit: "count", value: 1 },
  hp: { unit: "gameUnits", value: 100 },
  wounds: { unit: "gameUnits", value: 0 },
  role: R("role")
};

function legion(overrides: Partial<LegionView> = {}): LegionView {
  return {
    entityId: "e-1",
    kind: "Legion",
    ownerFactionId: "dave",
    position: { kind: "sector", sectorId: "s-1" },
    stance: "march",
    movementRemaining: { unit: "perMilleRatio", op: "flat", value: 500 },
    routed: false,
    members: [member],
    carriedLoam: R("carried loam"),
    capacity: R("capacity"),
    burn: R("burn"),
    runway: known(4),
    ...overrides
  };
}

describe("LegionRow — stance, movement, runway, unresolved flag, no fifth fact (world-stage W92)", () => {
  it("renders stance, movement (per-mille family declared) and runway in turns", () => {
    render(<LegionRow legion={legion()} unresolved={false} />);
    expect(screen.getByTestId("legion-row-stance")).toHaveTextContent("march");
    expect(screen.getByTestId("permille-figure-march-remaining")).toHaveTextContent("50%");
    expect(screen.getByTestId("legion-row-runway")).toHaveTextContent("4 turns of supply left");
  });

  it("the unresolved flag is text and a glyph, not colour, and absent when resolved", () => {
    const { rerender } = render(<LegionRow legion={legion()} unresolved />);
    expect(screen.getByTestId("legion-row-unresolved")).toHaveTextContent("needs orders");

    rerender(<LegionRow legion={legion()} unresolved={false} />);
    expect(screen.queryByTestId("legion-row-unresolved")).not.toBeInTheDocument();
  });

  it("a pending runway renders its real reason, never a bare zero", () => {
    render(<LegionRow legion={legion({ runway: R("runway") })} unresolved={false} />);
    expect(screen.getByTestId("legion-row-runway")).toHaveTextContent("no runway tracked in this test");
  });

  it("an absent runway (genuinely not applicable, distinct from pending) renders its own honest text", () => {
    render(<LegionRow legion={legion({ runway: absent() })} unresolved={false} />);
    expect(screen.getByTestId("legion-row-runway")).toHaveTextContent("runway does not apply");
  });
});

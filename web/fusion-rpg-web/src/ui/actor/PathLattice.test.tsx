import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TreeNodeSummary, TreeResolveReport } from "@/lib/bus";
import { PathLattice } from "./PathLattice";

/**
 * passive-tree-todo.md I6 — Level 2, the lattice (spec-tree-surface.md §2.3, §9, §9.1).
 * `jsdom` has no layout engine, so the real "the body scrolls, not the shell" pixel proof lives at
 * e2e/passive-tree-volume.spec.ts's 1280x720 floor (the two tests this task un-skips) — these tests
 * cover the DOM-shape and text-content contract instead: all 40 cells mount, the condition/distance
 * presentations are mutually exclusive and read from `gateState`, the locked reason names both
 * routes as visible text, and the scroll target lands on the actor's own depth.
 */

function fortyNodes(): TreeNodeSummary[] {
  const out: TreeNodeSummary[] = [];
  for (let tier = 1; tier <= 10; tier++) {
    for (const branch of ["Off", "Def"]) {
      for (const n of [0, 1]) {
        out.push({ nodeId: `skill.might-${branch.toLowerCase()}-t${tier}-n${n}`, branch, tier, nodeClass: "Magnitude" });
      }
    }
  }
  return out;
}

function tree(overrides: Partial<TreeResolveReport> = {}): TreeResolveReport {
  return {
    treeId: "might",
    category: "primary",
    gateState: "wired",
    tierReached: 0,
    tiers: 10,
    aptitudePoints: 0,
    contributingNodeIds: [],
    invalidNodeIds: [],
    lenderTreeId: null,
    herfindahlMilli: 0,
    focusMilli: 1000,
    excludedNodes: [],
    nodes: fortyNodes(),
    ...overrides
  };
}

describe("PathLattice — GG-61: all 40 cells mount, no windowing", () => {
  it("mounts every one of the 40 real cells directly", () => {
    render(<PathLattice tree={tree()} soulLevelByNodeId={{}} reqScalePoints={5} onBack={() => {}} />);
    expect(screen.getAllByTestId(/^lattice-cell-/)).toHaveLength(40);
  });

  it("renders 10 tier rows inside a single scrolling body", () => {
    render(<PathLattice tree={tree()} soulLevelByNodeId={{}} reqScalePoints={5} onBack={() => {}} />);
    const body = screen.getByTestId("path-lattice-body");
    expect(screen.getAllByTestId(/^lattice-tier-row-/)).toHaveLength(10);
    for (const row of screen.getAllByTestId(/^lattice-tier-row-/)) {
      expect(body).toContainElement(row);
    }
  });
});

describe("PathLattice — test 5: opens scrolled to the player's own depth, never tier 1", () => {
  it("marks the actor's own reached tier as the scroll target, not tier 1", () => {
    render(<PathLattice tree={tree({ tierReached: 6, aptitudePoints: 999 })} soulLevelByNodeId={{}} reqScalePoints={5} onBack={() => {}} />);
    expect(screen.getByTestId("lattice-tier-row-6")).toHaveAttribute("data-scroll-target", "true");
    expect(screen.getByTestId("lattice-tier-row-1")).not.toHaveAttribute("data-scroll-target");
  });

  it("a fresh actor legitimately targets tier 1 -- there is no deeper real state to scroll to", () => {
    render(<PathLattice tree={tree({ tierReached: 0 })} soulLevelByNodeId={{}} reqScalePoints={5} onBack={() => {}} />);
    expect(screen.getByTestId("lattice-tier-row-1")).toHaveAttribute("data-scroll-target", "true");
  });
});

describe("PathLattice — seedsmith-content-standard, content-completeness-passive-tree (2026-09-08)", () => {
  it("renders a node's real generated name instead of its raw id when the wire sends one", () => {
    const nodes = fortyNodes();
    nodes[0] = { ...nodes[0], name: "Thickened Marrow" };
    render(<PathLattice tree={tree({ nodes })} soulLevelByNodeId={{}} reqScalePoints={5} onBack={() => {}} />);
    const cell = screen.getByTestId(`lattice-cell-${nodes[0].nodeId}`);
    expect(cell).toHaveTextContent("Thickened Marrow");
    expect(cell).not.toHaveTextContent(nodes[0].nodeId);
  });

  it("falls back to the raw node id, never a blank cell, when no name has been generated yet", () => {
    render(<PathLattice tree={tree()} soulLevelByNodeId={{}} reqScalePoints={5} onBack={() => {}} />);
    const nodes = fortyNodes();
    const cell = screen.getByTestId(`lattice-cell-${nodes[0].nodeId}`);
    expect(cell).toHaveTextContent(nodes[0].nodeId);
  });
});

describe("PathLattice — test 29/§9.1: a gate-less tree takes the CONDITION presentation", () => {
  it("shows the condition once, and on every tier row -- never a price or an Unlock verb", () => {
    render(<PathLattice tree={tree({ gateState: "unproduced" })} soulLevelByNodeId={{}} reqScalePoints={5} onBack={() => {}} />);
    expect(screen.getByTestId("passives-lattice-condition")).toHaveTextContent(/nothing in the world teaches this yet/i);
    for (let tier = 1; tier <= 10; tier++) {
      expect(screen.getByTestId(`lattice-tier-condition-${tier}`)).toHaveTextContent(/nothing in the world teaches this yet/i);
    }
    const container = screen.getByTestId("passives-lattice");
    expect(container.textContent).not.toMatch(/coming soon/i);
    expect(container.textContent).not.toMatch(/unlock/i);
    expect(screen.queryByTestId(/^lattice-tier-need-/)).not.toBeInTheDocument();
    expect(screen.queryByTestId(/^lattice-tier-locked-reason-/)).not.toBeInTheDocument();
  });
});

describe("PathLattice — test 10/§9: a locked deep tier carries a distance, computed per actor", () => {
  it("renders a real need/have pair from THIS actor's aptitudePoints, not a stated-once constant", () => {
    render(<PathLattice tree={tree({ tierReached: 2, aptitudePoints: 15 })} soulLevelByNodeId={{}} reqScalePoints={5} onBack={() => {}} />);
    // Tier 9 needs reqScalePoints(5) * 9 * 10 / 2 = 225.
    expect(screen.getByTestId("lattice-tier-need-9")).toHaveTextContent("opens at 225 aptitude points · you have 15");
  });

  it("still shows the tier's traits in full while locked -- locked never means hidden", () => {
    render(<PathLattice tree={tree({ tierReached: 0 })} soulLevelByNodeId={{}} reqScalePoints={5} onBack={() => {}} />);
    const tier9Cells = screen.getByTestId("lattice-tier-cells-9");
    expect(tier9Cells.querySelectorAll('[data-testid^="lattice-cell-"]')).toHaveLength(4);
  });

  it("renders the actor's own current power reading on a locked tier, real per-actor data", () => {
    render(
      <PathLattice tree={tree({ tierReached: 0 })} soulLevelByNodeId={{}} reqScalePoints={5} actorTheta={42} onBack={() => {}} />
    );
    expect(screen.getByTestId("lattice-tier-need-9")).toHaveTextContent(/your power is 42 today/i);
  });
});

describe("PathLattice — test 9: a locked tier names both routes in VISIBLE TEXT, never a title", () => {
  it("is queried by text content, and names both the own-path and the lender route", () => {
    render(
      <PathLattice
        tree={tree({ tierReached: 0, aptitudePoints: 5, lenderTreeId: "fortitude" })}
        soulLevelByNodeId={{}}
        reqScalePoints={5}
        onBack={() => {}}
      />
    );
    const reason = screen.getByTestId("lattice-tier-locked-reason-2"); // needs 15, has 5, short 10
    expect(reason).toHaveTextContent(/10 more in might/i);
    expect(reason).toHaveTextContent(/10 more in fortitude/i);
    // ActionCluster.tsx:18-29's own rejected floor: a `title` attribute is not enough. The reason
    // must be real sibling text, so it must NOT be carried only in a `title` attribute anywhere.
    expect(reason).not.toHaveAttribute("title");
    expect(reason.textContent?.length ?? 0).toBeGreaterThan(0);
    // And it is real screen text, reachable by getByText -- not only by testid.
    expect(screen.getByText(/10 more in fortitude/i)).toBeInTheDocument();
  });

  it("names only the real route when there is no lender", () => {
    render(<PathLattice tree={tree({ tierReached: 0, aptitudePoints: 0 })} soulLevelByNodeId={{}} reqScalePoints={5} onBack={() => {}} />);
    const reason = screen.getByTestId("lattice-tier-locked-reason-1");
    expect(reason).toHaveTextContent(/5 more in might/i);
    expect(reason.textContent).not.toMatch(/,\s*or\s*/);
  });

  it("a reached tier carries no locked-reason element at all", () => {
    render(<PathLattice tree={tree({ tierReached: 5, aptitudePoints: 999 })} soulLevelByNodeId={{}} reqScalePoints={5} onBack={() => {}} />);
    expect(screen.queryByTestId("lattice-tier-locked-reason-3")).not.toBeInTheDocument();
  });
});

describe("PathLattice — owned cells carry real soul-level state", () => {
  it("an owned node renders its depth from soulLevelByNodeId", () => {
    const nodeId = "skill.might-off-t1-n0";
    render(
      <PathLattice
        tree={tree({ tierReached: 1, contributingNodeIds: [nodeId] })}
        soulLevelByNodeId={{ [nodeId]: 4 }}
        reqScalePoints={5}
        onBack={() => {}}
      />
    );
    const cell = screen.getByTestId(`lattice-cell-${nodeId}`);
    expect(cell).toHaveAttribute("data-state", "owned");
    expect(cell).toHaveTextContent(/depth 4/i);
  });
});

describe("PathLattice — the back affordance", () => {
  it("calls onBack when clicked", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    render(<PathLattice tree={tree()} soulLevelByNodeId={{}} reqScalePoints={5} onBack={onBack} />);
    await user.click(screen.getByTestId("passives-lattice-back"));
    expect(onBack).toHaveBeenCalled();
  });
});

describe("PathLattice — I8, §7.2 part 2: exactly one lender named on the tier row (positive attribution)", () => {
  it("renders no attribution line for a pre-I8 fixture (ownAptitudePoints undefined)", () => {
    render(<PathLattice tree={tree({ tierReached: 5, aptitudePoints: 55 })} soulLevelByNodeId={{}} reqScalePoints={5} onBack={() => {}} />);
    expect(screen.queryByTestId("tier-sources-1")).not.toBeInTheDocument();
  });

  it("no lender: own equals the whole total", () => {
    render(
      <PathLattice
        tree={tree({ tierReached: 5, aptitudePoints: 55, ownAptitudePoints: 55, lenderTreeId: null })}
        soulLevelByNodeId={{}}
        reqScalePoints={5}
        onBack={() => {}}
      />
    );
    expect(screen.getByTestId("tier-sources-1")).toHaveTextContent("55 from might");
    expect(screen.getByTestId("tier-sources-1")).not.toHaveTextContent(/lent by/i);
  });

  it("with a lender: names exactly one, the number equals the largest mate's own share, never a sum", () => {
    render(
      <PathLattice
        tree={tree({ tierReached: 5, aptitudePoints: 175, ownAptitudePoints: 55, lenderTreeId: "fortitude" })}
        soulLevelByNodeId={{}}
        reqScalePoints={5}
        onBack={() => {}}
      />
    );
    const line = screen.getByTestId("tier-sources-1");
    expect(line).toHaveTextContent("55 from might");
    expect(line).toHaveTextContent("120 lent by fortitude");
  });
});

describe("PathLattice — I8, §7.2 part 1/D28: the fiction sentence, named once where it first matters", () => {
  it("renders when this report currently benefits from a lender", () => {
    render(
      <PathLattice tree={tree({ lenderTreeId: "might" })} soulLevelByNodeId={{}} reqScalePoints={5} onBack={() => {}} />
    );
    expect(screen.getByTestId("passives-lattice-cross-unlock-fiction")).toHaveTextContent(
      /paths of the same stance help each other/i
    );
  });

  it("never renders when there is no lender", () => {
    render(<PathLattice tree={tree({ lenderTreeId: null })} soulLevelByNodeId={{}} reqScalePoints={5} onBack={() => {}} />);
    expect(screen.queryByTestId("passives-lattice-cross-unlock-fiction")).not.toBeInTheDocument();
  });

  it("never renders on a gate-less (condition) tree", () => {
    render(
      <PathLattice
        tree={tree({ gateState: "unproduced", lenderTreeId: "might" })}
        soulLevelByNodeId={{}}
        reqScalePoints={5}
        onBack={() => {}}
      />
    );
    expect(screen.queryByTestId("passives-lattice-cross-unlock-fiction")).not.toBeInTheDocument();
  });
});

describe("PathLattice — I8, §4: the Unlock verb on an 'available' cell", () => {
  it("renders Unlock with a price only on an available cell, never on owned or locked", () => {
    render(
      <PathLattice
        tree={tree({ tierReached: 1, contributingNodeIds: ["skill.might-off-t1-n0"] })}
        soulLevelByNodeId={{ "skill.might-off-t1-n0": 2 }}
        reqScalePoints={5}
        onBack={() => {}}
        nextUnlockPrice={14}
        onUnlock={() => {}}
      />
    );
    // Owned cell: no Unlock button.
    expect(screen.queryByTestId("lattice-unlock-skill.might-off-t1-n0")).not.toBeInTheDocument();
    // Available cell (tier 1 <= tierReached 1, not owned): Unlock renders with the price.
    expect(screen.getByTestId("lattice-unlock-skill.might-off-t1-n1")).toHaveTextContent(/unlock.*14 skill points/i);
    // Locked cell (tier 9 > tierReached 1): no Unlock button.
    expect(screen.queryByTestId("lattice-unlock-skill.might-off-t9-n0")).not.toBeInTheDocument();
  });

  it("clicking Unlock calls onUnlock with the node id and never also opens Level 3", async () => {
    const user = userEvent.setup();
    const onUnlock = vi.fn();
    const onOpenNode = vi.fn();
    render(
      <PathLattice
        tree={tree({ tierReached: 1 })}
        soulLevelByNodeId={{}}
        reqScalePoints={5}
        onBack={() => {}}
        onOpenNode={onOpenNode}
        onUnlock={onUnlock}
      />
    );
    await user.click(screen.getByTestId("lattice-unlock-skill.might-off-t1-n0"));
    expect(onUnlock).toHaveBeenCalledWith("skill.might-off-t1-n0");
    expect(onOpenNode).not.toHaveBeenCalled();
  });

  it("renders no Unlock button at all when onUnlock is not given", () => {
    render(<PathLattice tree={tree({ tierReached: 1 })} soulLevelByNodeId={{}} reqScalePoints={5} onBack={() => {}} />);
    expect(screen.queryByTestId(/^lattice-unlock-/)).not.toBeInTheDocument();
  });

  it("the 40-cells count is unaffected by the Unlock button's own testid prefix", () => {
    render(
      <PathLattice
        tree={tree({ tierReached: 5 })}
        soulLevelByNodeId={{}}
        reqScalePoints={5}
        onBack={() => {}}
        onUnlock={() => {}}
      />
    );
    expect(screen.getAllByTestId(/^lattice-cell-/)).toHaveLength(40);
  });
});

describe("PathLattice — I7: the push into Level 3", () => {
  it("a cell is a plain, non-interactive div when no onOpenNode is given", () => {
    render(<PathLattice tree={tree()} soulLevelByNodeId={{}} reqScalePoints={5} onBack={() => {}} />);
    const cell = screen.getByTestId("lattice-cell-skill.might-off-t1-n0");
    expect(cell.tagName).toBe("DIV");
  });

  it("clicking a cell calls onOpenNode with that exact node id, when given", async () => {
    const user = userEvent.setup();
    const onOpenNode = vi.fn();
    render(
      <PathLattice tree={tree()} soulLevelByNodeId={{}} reqScalePoints={5} onBack={() => {}} onOpenNode={onOpenNode} />
    );
    const cell = screen.getByTestId("lattice-cell-skill.might-off-t1-n0");
    expect(cell.tagName).toBe("BUTTON");
    await user.click(cell);
    expect(onOpenNode).toHaveBeenCalledWith("skill.might-off-t1-n0");
  });
});

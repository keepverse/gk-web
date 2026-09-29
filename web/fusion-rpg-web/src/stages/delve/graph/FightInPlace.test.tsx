import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { FightView } from "@/contract/types";
import { absent, known, pendingWithReason } from "@/contract/pending";
import { FightInPlace } from "./FightInPlace";

const knownFight: FightView = {
  frozen: known(false),
  dwellRemaining: known({ unit: "milliseconds", value: 1200 }),
  initiative: known([{}, {}, {}]),
  strikeFeed: known([{}, {}])
};

const pendingFight: FightView = {
  frozen: pendingWithReason("no connection state yet"),
  dwellRemaining: pendingWithReason("no dwell yet"),
  initiative: pendingWithReason("no turn order yet"),
  strikeFeed: pendingWithReason("no feed yet")
};

describe("FightInPlace — the fight drawn on the room it is in (D5.5)", () => {
  it("renders the frozen banner, verbatim spec copy, only when frozen is known true", () => {
    render(<FightInPlace fight={{ ...knownFight, frozen: known(true) }} steered={false} />);
    expect(screen.getByTestId("delve-fight-frozen")).toHaveTextContent("Your band is waiting.");
  });

  it("renders no frozen banner when frozen is known false", () => {
    render(<FightInPlace fight={knownFight} steered={false} />);
    expect(screen.queryByTestId("delve-fight-frozen")).not.toBeInTheDocument();
  });

  it("renders no frozen banner while frozen is pending or absent — never a guessed connection state", () => {
    render(<FightInPlace fight={pendingFight} steered={false} />);
    expect(screen.queryByTestId("delve-fight-frozen")).not.toBeInTheDocument();

    render(<FightInPlace fight={{ ...knownFight, frozen: absent() }} steered={false} />);
    expect(screen.queryAllByTestId("delve-fight-frozen")).toHaveLength(0);
  });

  it("dwell renders through formatMagnitude when known — never a bare number", () => {
    render(<FightInPlace fight={knownFight} steered={false} />);
    expect(screen.getByTestId("delve-fight-dwell")).toHaveTextContent("1.2 s");
  });

  it("dwell renders its own real reason when pending", () => {
    render(<FightInPlace fight={pendingFight} steered={false} />);
    expect(screen.getByTestId("delve-fight-dwell")).toHaveTextContent("no dwell yet");
  });

  it("ranks render one mark per initiative entry when known, the first one pulsing", () => {
    render(<FightInPlace fight={knownFight} steered={false} />);
    const ranks = screen.getAllByTestId("delve-fight-rank");
    expect(ranks).toHaveLength(3);
    expect(ranks[0]?.className).toContain("animate-pulse");
    expect(ranks[1]?.className).not.toContain("animate-pulse");
  });

  it("ranks render the pending reason, and no rank marks, while initiative is pending", () => {
    render(<FightInPlace fight={pendingFight} steered={false} />);
    expect(screen.queryAllByTestId("delve-fight-rank")).toHaveLength(0);
    expect(screen.getByTestId("delve-fight-ranks")).toHaveTextContent("no turn order yet");
  });

  it("the strike feed renders one entry per strikeFeed item when known", () => {
    render(<FightInPlace fight={knownFight} steered={false} />);
    expect(screen.getAllByTestId("delve-fight-strike-feed-entry")).toHaveLength(2);
  });

  it("the strike feed renders its own real reason, and no entries, while pending", () => {
    render(<FightInPlace fight={pendingFight} steered={false} />);
    expect(screen.queryAllByTestId("delve-fight-strike-feed-entry")).toHaveLength(0);
    expect(screen.getByTestId("delve-fight-strike-feed")).toHaveTextContent("no feed yet");
  });

  it("an absent field renders an honest fallback rather than throwing", () => {
    expect(() =>
      render(
        <FightInPlace
          fight={{ frozen: absent(), dwellRemaining: absent(), initiative: absent(), strikeFeed: absent() }}
          steered={false}
        />
      )
    ).not.toThrow();
    expect(screen.getByTestId("delve-fight-dwell")).not.toHaveTextContent("");
  });

  it("data-steered reflects the steered prop exactly", () => {
    const { rerender } = render(<FightInPlace fight={knownFight} steered={true} />);
    expect(screen.getByTestId("delve-room-fight")).toHaveAttribute("data-steered", "true");
    rerender(<FightInPlace fight={knownFight} steered={false} />);
    expect(screen.getByTestId("delve-room-fight")).toHaveAttribute("data-steered", "false");
  });

  it("never renders an interactive element — steered or not — the input surface is a panel, not the stage (spec §7)", () => {
    const selector = "button, a[href], input, select, textarea";
    const { container: steeredContainer } = render(<FightInPlace fight={knownFight} steered={true} />);
    expect(steeredContainer.querySelectorAll(selector)).toHaveLength(0);

    const { container: readOnlyContainer } = render(<FightInPlace fight={knownFight} steered={false} />);
    expect(readOnlyContainer.querySelectorAll(selector)).toHaveLength(0);
  });

  it("every (frozen × dwell × initiative × strikeFeed) known/pending/absent combination renders without throwing", () => {
    const frozenStates = [known(true), known(false), pendingWithReason("x"), absent()];
    const dwellStates = [known({ unit: "milliseconds" as const, value: 500 }), pendingWithReason("x"), absent()];
    const arrayStates = [known([{}]), known([]), pendingWithReason("x"), absent()];

    for (const frozen of frozenStates) {
      for (const dwellRemaining of dwellStates) {
        for (const initiative of arrayStates) {
          for (const strikeFeed of arrayStates) {
            expect(() =>
              render(<FightInPlace fight={{ frozen, dwellRemaining, initiative, strikeFeed }} steered={false} />)
            ).not.toThrow();
          }
        }
      }
    }
  });
});

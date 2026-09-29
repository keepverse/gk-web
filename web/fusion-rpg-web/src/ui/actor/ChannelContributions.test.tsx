import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChannelContributions } from "./ChannelContributions";

describe("ChannelContributions", () => {
  it("renders each source and its magnitude", () => {
    render(
      <ChannelContributions
        contributions={[
          { sourceId: "rpg.progression", op: "Replace", value: 12 },
          { sourceId: "aptitude.Might", op: "Flat", value: 8 }
        ]}
      />
    );
    expect(screen.getByTestId("channel-contribution-rpg.progression")).toHaveTextContent("+12");
    expect(screen.getByTestId("channel-contribution-aptitude.Might")).toHaveTextContent("+8");
  });

  it("renders a real reason, not a fabricated grid, when no source has contributed", () => {
    render(<ChannelContributions contributions={[]} />);
    expect(screen.getByTestId("channel-contributions-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("channel-contributions")).not.toBeInTheDocument();
  });

  it("renders a negative contribution without a leading plus", () => {
    render(<ChannelContributions contributions={[{ sourceId: "debuff.slow", op: "Flat", value: -5 }]} />);
    expect(screen.getByTestId("channel-contribution-debuff.slow")).toHaveTextContent("-5");
    expect(screen.getByTestId("channel-contribution-debuff.slow")).not.toHaveTextContent("+-5");
  });
});

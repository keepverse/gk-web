import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { known, pendingWithReason } from "@/contract/pending";
import type { MemberView } from "@/contract/types";
import { MemberRow } from "./MemberRow";

function member(overrides: Partial<MemberView> = {}): MemberView {
  return {
    instanceId: "m-1",
    pools: { hp: { unit: "count", value: 80 }, stamina: { unit: "count", value: 40 } },
    poolMax: pendingWithReason("How full a meter can get isn't shown yet"),
    poolFill: pendingWithReason("How full a meter reads isn't shown yet"),
    nerveStacks: 0,
    nerveStage: pendingWithReason("How shaken this one is isn't named yet"),
    downed: false,
    downedOnce: false,
    shield: pendingWithReason("test"),
    statuses: pendingWithReason("test"),
    ...overrides
  };
}

describe("MemberRow (D5.6)", () => {
  it("renders the six pool meters for this member", () => {
    render(<MemberRow member={member()} />);
    expect(screen.getByTestId("delve-pool-meters")).toBeInTheDocument();
    expect(screen.getByTestId("delve-pool-meter-hp")).toBeInTheDocument();
  });

  it("no Down badge for a member who is up", () => {
    render(<MemberRow member={member({ downed: false })} />);
    expect(screen.queryByTestId("delve-member-downed-m-1")).not.toBeInTheDocument();
  });

  it("a downed member carries the real 'Down' word (spec-delve-stage.md §8 row 6), not a guessed one", () => {
    render(<MemberRow member={member({ downed: true })} />);
    expect(screen.getByTestId("delve-member-downed-m-1")).toHaveTextContent("Down");
  });

  it("nerveStage known renders through nerveStageLabel, never the raw id", () => {
    render(<MemberRow member={member({ nerveStage: known("shaken") })} />);
    expect(screen.getByTestId("delve-member-nerve-m-1")).toHaveTextContent("Shaken");
    expect(screen.getByTestId("delve-member-nerve-m-1")).not.toHaveTextContent("shaken");
  });

  it("nerveStage pending: the real reason renders, matching the live adapter's own current gap", () => {
    render(<MemberRow member={member()} />);
    expect(screen.getByTestId("delve-member-nerve-pending-m-1")).toHaveTextContent(
      "How shaken this one is isn't named yet"
    );
  });
});

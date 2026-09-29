import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { absent } from "@/contract/pending";
import type { ActorChannelDetail } from "@/contract/types";
import { StatSummaryGrid } from "./StatSummaryGrid";

function channel(channelId: string, value: number): ActorChannelDetail {
  return { channelId, value, unitClass: "gameUnits", state: "active", contributions: absent() };
}

describe("StatSummaryGrid", () => {
  it("renders each channel's id and value", () => {
    render(<StatSummaryGrid channels={[channel("combat.attack", 140), channel("combat.defense", 22)]} />);
    expect(screen.getByText("combat.attack")).toBeInTheDocument();
    expect(screen.getByText("140")).toBeInTheDocument();
    expect(screen.getByText("combat.defense")).toBeInTheDocument();
    expect(screen.getByText("22")).toBeInTheDocument();
  });

  it("caps at four channels even when given more", () => {
    const channels = [1, 2, 3, 4, 5, 6].map((n) => channel(`combat.c${n}`, n));
    render(<StatSummaryGrid channels={channels} />);
    expect(screen.queryByText("combat.c5")).not.toBeInTheDocument();
    expect(screen.getByText("combat.c4")).toBeInTheDocument();
  });
});

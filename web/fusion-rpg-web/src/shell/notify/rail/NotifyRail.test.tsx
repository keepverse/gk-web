import { afterEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { NotifyRail } from "./NotifyRail";
import type { RailItem } from "./railStore";
import { clearChannelSettingsForTests } from "@/shell/notify/channelSettings";

const items: RailItem[] = [
  { id: "a", dedupKey: "a", seq: 1, category: "growth", severity: "routine", title: "First", body: "", state: "unread", worldId: "w1", worldTurn: 4, blocking: false },
  { id: "b", dedupKey: "b", seq: 2, category: "intel.new", severity: "routine", title: "Second", body: "", state: "opened", worldId: "w1", worldTurn: 4, blocking: false }
];

const noop = () => {};

afterEach(() => {
  clearChannelSettingsForTests();
});

describe("NotifyRail — band 1, right-anchored, its own bounded shell (world-stage W87)", () => {
  it("renders every item", () => {
    render(<NotifyRail items={items} onOpen={noop} onDismiss={noop} onUndoDismiss={noop} />);
    expect(screen.getByTestId("rail-item-a")).toBeInTheDocument();
    expect(screen.getByTestId("rail-item-b")).toBeInTheDocument();
  });

  it("declares no z-index of its own", () => {
    render(<NotifyRail items={items} onOpen={noop} onDismiss={noop} onUndoDismiss={noop} />);
    expect(screen.getByTestId("notify-rail").className).not.toMatch(/\bz-\d|\bz-\[/);
  });

  it("scrolls inside its own bounded shell — overflow-y-auto, not the stage", () => {
    render(<NotifyRail items={items} onOpen={noop} onDismiss={noop} onUndoDismiss={noop} />);
    expect(screen.getByTestId("notify-rail").className).toContain("overflow-y-auto");
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RailItem } from "./RailItem";
import type { RailItem as RailItemData } from "./railStore";
import { clearChannelSettingsForTests } from "@/shell/notify/channelSettings";

function make(overrides: Partial<RailItemData> = {}): RailItemData {
  return {
    id: "r-1",
    dedupKey: "r-1",
    seq: 1,
    category: "growth",
    severity: "routine",
    title: "Ash Waste grew a rootbed",
    body: "A new structure finished.",
    state: "unread",
    worldId: "w1",
    worldTurn: 4,
    blocking: false,
    ...overrides
  };
}

const noop = () => {};

afterEach(() => {
  clearChannelSettingsForTests();
});

describe("RailItem — the five states, each carried by more than colour (world-stage W87)", () => {
  it("unread: a dot, bold weight, and is clickable to open", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(<RailItem item={make({ state: "unread" })} onOpen={onOpen} onDismiss={noop} onUndoDismiss={noop} />);

    const row = screen.getByTestId("rail-item-r-1");
    expect(row).toHaveAttribute("data-item-state", "unread");
    expect(screen.getByTestId("rail-item-dot-r-1")).toBeInTheDocument();
    expect(within(row).getByText("Ash Waste grew a rootbed").className).toContain("font-bold");

    await user.click(row);
    expect(onOpen).toHaveBeenCalledWith("r-1");
  });

  it("opened: no dot, normal weight, body visible", () => {
    render(<RailItem item={make({ state: "opened" })} onOpen={noop} onDismiss={noop} onUndoDismiss={noop} />);
    expect(screen.queryByTestId("rail-item-dot-r-1")).not.toBeInTheDocument();
    expect(screen.getByText("A new structure finished.")).toBeInTheDocument();
  });

  it("dismissed: leaves the rail with an undo in its place, never erased", async () => {
    const user = userEvent.setup();
    const onUndoDismiss = vi.fn();
    render(<RailItem item={make({ state: "dismissed" })} onOpen={noop} onDismiss={noop} onUndoDismiss={onUndoDismiss} />);

    expect(screen.getByText("Dismissed")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(onUndoDismiss).toHaveBeenCalledWith("r-1");
  });

  it("minimized: one line, no body, no actions", () => {
    render(<RailItem item={make({ state: "minimized" })} onOpen={noop} onDismiss={noop} onUndoDismiss={noop} />);
    expect(screen.getByText("Ash Waste grew a rootbed")).toBeInTheDocument();
    expect(screen.queryByText("A new structure finished.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("blocking: no close control at all, and the channel control is visible but locked", () => {
    render(
      <RailItem
        item={make({ state: "blocking", blocking: true, category: "battle.result" })}
        onOpen={noop}
        onDismiss={noop}
        onUndoDismiss={noop}
      />
    );

    // Queried by role and accessible name, never by class — the control genuinely does not exist.
    expect(screen.queryByRole("button", { name: "Dismiss" })).not.toBeInTheDocument();

    const group = screen.getByRole("group", { name: "Show battle.result as" });
    const channelButtons = within(group).getAllByRole("button");
    expect(channelButtons).toHaveLength(3);
    for (const button of channelButtons) {
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute("title", "Locked while this item blocks the turn");
    }
  });
});

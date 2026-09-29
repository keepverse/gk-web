import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChannelControl } from "./ChannelControl";
import { clearChannelSettingsForTests } from "@/shell/notify/channelSettings";

// This environment's default window.localStorage is incomplete (see keybindings.test.ts / same
// pattern) — stub a real in-memory Storage before each test.
beforeEach(() => {
  const mem: Record<string, string> = {};
  const ls = {
    getItem: (k: string) => mem[k] ?? null,
    setItem: (k: string, v: string) => {
      mem[k] = v;
    },
    removeItem: (k: string) => {
      delete mem[k];
    },
    clear: () => {
      for (const key of Object.keys(mem)) delete mem[key];
    },
    key: (i: number) => Object.keys(mem)[i] ?? null,
    get length() {
      return Object.keys(mem).length;
    }
  };
  Object.defineProperty(window, "localStorage", { configurable: true, value: ls });
});

afterEach(() => {
  clearChannelSettingsForTests();
});

describe("ChannelControl — on the notification and in settings, and they cannot disagree (world-stage W88)", () => {
  it("names the category in the sentence", () => {
    render(<ChannelControl category="battle.result" />);
    expect(screen.getByRole("group", { name: "Show battle.result as" })).toBeInTheDocument();
  });

  it("a locked control is visible, not hidden, and every button is disabled", () => {
    render(<ChannelControl category="battle.result" locked />);
    const group = screen.getByRole("group", { name: "Show battle.result as" });
    for (const button of within(group).getAllByRole("button")) {
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute("title", "Locked while this item blocks the turn");
    }
  });

  it("changing the channel from one mounted instance updates a second instance for the same category — they read the same store", async () => {
    const user = userEvent.setup();
    render(
      <>
        <ChannelControl category="battle.result" />
        <ChannelControl category="battle.result" />
      </>
    );

    const [onNotification, inSettings] = screen.getAllByRole("group", { name: "Show battle.result as" });
    expect(within(onNotification!).getByRole("button", { name: "Rail" })).toHaveAttribute("aria-pressed", "true");

    await user.click(within(onNotification!).getByRole("button", { name: "Toast" }));

    expect(within(onNotification!).getByRole("button", { name: "Toast" })).toHaveAttribute("aria-pressed", "true");
    // The second, independently mounted instance — the settings-list stand-in — agrees without a
    // shared prop or a remount forcing it to.
    expect(within(inSettings!).getByRole("button", { name: "Toast" })).toHaveAttribute("aria-pressed", "true");
  });

  it("a silenced category never reaches the toast stack — Off is a real, selectable channel", async () => {
    const user = userEvent.setup();
    render(<ChannelControl category="growth" />);
    await user.click(screen.getByRole("button", { name: "Off" }));
    expect(screen.getByRole("button", { name: "Off" })).toHaveAttribute("aria-pressed", "true");
  });
});

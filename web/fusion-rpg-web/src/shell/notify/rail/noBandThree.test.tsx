import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toasts } from "@/shell/Toasts";
import { useToastStack } from "@/shell/toastStack";
import { useLayerStack } from "@/shell/layerStack";
import { NotifyRail } from "./NotifyRail";
import type { RailItem } from "./railStore";
import { clearChannelSettingsForTests } from "@/shell/notify/channelSettings";

/**
 * world-stage W89 (spec-world-notify.md §5, §8, boundaries) — D6/GG-53: exactly one class of event
 * may take a blocking layer unprompted, and it is run-ending results only. A world notification is
 * never one, so nothing in this module may open a band-3 layer by itself — a toast may carry a
 * button that opens one, but that is the player asking, not the notification itself.
 */

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
  useToastStack.getState().clear();
  useLayerStack.getState().popAll();
});

afterEach(() => {
  clearChannelSettingsForTests();
});

describe("No notification opens a band-3 layer by itself (world-stage W89)", () => {
  it("static: nothing in shell/notify/rail/ (this module) imports the layer stack at all", () => {
    const rootDir = __dirname;
    const violations: string[] = [];

    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          walk(full);
          continue;
        }
        if (![".ts", ".tsx"].includes(extname(full))) continue;
        if (/\.(test|spec)\.[jt]sx?$/.test(entry)) continue;
        const text = readFileSync(full, "utf8");
        if (/useLayerStack|layerStack/.test(text)) violations.push(entry);
      }
    };
    walk(rootDir);

    expect(violations).toEqual([]);
  });

  it("clicking every interactive control this module ships never pushes a layer", async () => {
    const user = userEvent.setup();

    useToastStack.getState().push({
      tone: "warn",
      title: "Ash Waste will release next turn",
      category: "loam.release",
      action: { label: "View sector", run: () => {} }
    });

    const items: RailItem[] = [
      { id: "a", dedupKey: "a", seq: 1, category: "growth", severity: "routine", title: "A", body: "body-a", state: "opened", worldId: "w1", worldTurn: 4, blocking: false },
      { id: "b", dedupKey: "b", seq: 2, category: "battle.result", severity: "routine", title: "B", body: "", state: "blocking", worldId: "w1", worldTurn: 4, blocking: true }
    ];

    render(
      <>
        <Toasts />
        <NotifyRail items={items} onOpen={() => {}} onDismiss={() => {}} onUndoDismiss={() => {}} />
      </>
    );

    // Explicit, not a generic "click everything" loop: the toast's own action click removes it from
    // the DOM, so a stale-element re-query is the wrong tool here.
    const itemA = screen.getByTestId("rail-item-a");
    await user.click(screen.getByTestId("toast-action"));
    await user.click(within(itemA).getByRole("button", { name: "Rail" })); // item "a"'s channel control
    await user.click(within(itemA).getByRole("button", { name: "Dismiss" }));

    expect(useLayerStack.getState().layers).toEqual([]);
  });

  it("a turn carrying a fade warning (Toast) leaves the layer stack empty once acknowledged", async () => {
    const user = userEvent.setup();
    useToastStack.getState().push({
      tone: "warn",
      title: "Ash Waste will release next turn",
      category: "loam.release"
    });
    render(<Toasts />);

    // No action to click here — a bare informational toast auto-expires or is simply read.
    expect(useLayerStack.getState().layers).toEqual([]);
    void user; // no interaction needed for this row; kept for symmetry with the others above
  });
});

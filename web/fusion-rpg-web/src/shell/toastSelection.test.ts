import { describe, expect, it } from "vitest";
import { selectVisibleToasts } from "./toastSelection";
import type { ToastEntry } from "./toastStack";

function toast(id: string, severity?: ToastEntry["severity"]): ToastEntry {
  return { id, tone: "ok", title: id, severity };
}

describe("selectVisibleToasts (notify-client spec §4, R-N4/R-N6)", () => {
  it("three routine then one Critical: the Critical is visible, one routine drops behind the count", () => {
    const toasts = [toast("r1", "routine"), toast("r2", "routine"), toast("r3", "routine"), toast("c1", "critical")];
    const { visible, hiddenCount } = selectVisibleToasts(toasts, 3);
    expect(visible.map((t) => t.id)).toEqual(["c1", "r3", "r2"]);
    expect(hiddenCount).toBe(1);
  });

  it("the same set pushed in reverse order gives the same visible set (order independence)", () => {
    // "Reverse order" varies WHEN the Critical arrives relative to the routines (last vs first);
    // the routines keep their own relative push order in both runs, so "the 2 newest routines" is
    // the same pair either way — R-N6's "a batch is one ordered set" holds regardless of where in
    // that set the Critical item sits.
    const forward = [toast("r1", "routine"), toast("r2", "routine"), toast("r3", "routine"), toast("c1", "critical")];
    const backward = [toast("c1", "critical"), toast("r1", "routine"), toast("r2", "routine"), toast("r3", "routine")];
    const a = selectVisibleToasts(forward, 3);
    const b = selectVisibleToasts(backward, 3);
    expect(a.visible.map((t) => t.id)).toEqual(["c1", "r3", "r2"]);
    expect(new Set(a.visible.map((t) => t.id))).toEqual(new Set(b.visible.map((t) => t.id)));
  });

  it("no Critical: newest-first within the cap, same as the old slice(-cap).reverse() behavior", () => {
    const toasts = [toast("a"), toast("b"), toast("c"), toast("d")];
    const { visible, hiddenCount } = selectVisibleToasts(toasts, 3);
    expect(visible.map((t) => t.id)).toEqual(["d", "c", "b"]);
    expect(hiddenCount).toBe(1);
  });

  it("multiple Criticals all preempt the cap, newest Critical first", () => {
    const toasts = [toast("r1", "routine"), toast("c1", "critical"), toast("c2", "critical")];
    const { visible, hiddenCount } = selectVisibleToasts(toasts, 2);
    expect(visible.map((t) => t.id)).toEqual(["c2", "c1"]);
    expect(hiddenCount).toBe(1);
  });

  it("fewer toasts than the cap: nothing hidden", () => {
    const toasts = [toast("a"), toast("b")];
    const { visible, hiddenCount } = selectVisibleToasts(toasts, 3);
    expect(visible.map((t) => t.id)).toEqual(["b", "a"]);
    expect(hiddenCount).toBe(0);
  });
});

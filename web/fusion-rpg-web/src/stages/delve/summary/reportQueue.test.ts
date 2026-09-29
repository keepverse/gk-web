import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useToastStack } from "@/shell/toastStack";
import { useDelveReportQueue } from "./reportQueue";

function resetStores() {
  useToastStack.getState().clear();
  useDelveReportQueue.setState({ held: false, pending: [] });
}

describe("useDelveReportQueue (D5.9, spec-delve-stage.md §7 band-4 row + §12 reveal.*)", () => {
  beforeEach(resetStores);
  afterEach(resetStores);

  it("not held: a report lands in the real toast stack (band 4) immediately", () => {
    useDelveReportQueue.getState().push({ kind: "drop", title: "Found a relic" });
    expect(useToastStack.getState().toasts).toHaveLength(1);
    expect(useToastStack.getState().toasts[0]).toMatchObject({ title: "Found a relic", tone: "ok" });
  });

  it("Reports_land_at_band_4_and_wait_behind_the_summary — held: a report does NOT land in the toast stack until release", () => {
    useDelveReportQueue.getState().hold();
    useDelveReportQueue.getState().push({ kind: "join", title: "A wild creature joined" });

    // Still waiting — nothing on band 4 yet, and the queue itself carries it instead.
    expect(useToastStack.getState().toasts).toEqual([]);
    expect(useDelveReportQueue.getState().pending).toHaveLength(1);

    useDelveReportQueue.getState().release();

    expect(useToastStack.getState().toasts).toHaveLength(1);
    expect(useToastStack.getState().toasts[0]).toMatchObject({ title: "A wild creature joined" });
    expect(useDelveReportQueue.getState().pending).toEqual([]);
    expect(useDelveReportQueue.getState().held).toBe(false);
  });

  it("held, released with nothing queued: releases cleanly, pushes nothing, throws nothing", () => {
    useDelveReportQueue.getState().hold();
    expect(() => useDelveReportQueue.getState().release()).not.toThrow();
    expect(useToastStack.getState().toasts).toEqual([]);
  });

  it("exactly reveal.maxQueued (3) held reports flush individually, in arrival order — the boundary stays uncollapsed", () => {
    useDelveReportQueue.getState().hold();
    useDelveReportQueue.getState().push({ kind: "drop", title: "Drop A" });
    useDelveReportQueue.getState().push({ kind: "drop", title: "Drop B" });
    useDelveReportQueue.getState().push({ kind: "levelUp", title: "Level up C" });
    useDelveReportQueue.getState().release();

    expect(useToastStack.getState().toasts.map((t) => t.title)).toEqual(["Drop A", "Drop B", "Level up C"]);
  });

  it("more than reveal.maxQueued (4) held reports collapse into exactly ONE combined report, not four", () => {
    useDelveReportQueue.getState().hold();
    useDelveReportQueue.getState().push({ kind: "drop", title: "Drop A" });
    useDelveReportQueue.getState().push({ kind: "drop", title: "Drop B" });
    useDelveReportQueue.getState().push({ kind: "levelUp", title: "Level up C" });
    useDelveReportQueue.getState().push({ kind: "firstClear", title: "First clear D" });
    useDelveReportQueue.getState().release();

    expect(useToastStack.getState().toasts).toHaveLength(1);
    expect(useToastStack.getState().toasts[0]!.title).toBe("4 more results from this raid");
    // None of the individual titles leak into the collapsed report — it never invents richer content
    // than it was given.
    for (const title of ["Drop A", "Drop B", "Level up C", "First clear D"]) {
      expect(useToastStack.getState().toasts[0]!.title).not.toContain(title);
    }
  });

  it("a not-held report dwells for reveal.toastMs (4000ms), not the shell's own default (5000ms)", () => {
    vi.useFakeTimers();
    try {
      useDelveReportQueue.getState().push({ kind: "drop", title: "Found a relic" });
      expect(useToastStack.getState().toasts).toHaveLength(1);

      vi.advanceTimersByTime(3999);
      expect(useToastStack.getState().toasts).toHaveLength(1);

      vi.advanceTimersByTime(1);
      expect(useToastStack.getState().toasts).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("a held-then-released report also dwells for reveal.toastMs (4000ms)", () => {
    vi.useFakeTimers();
    try {
      useDelveReportQueue.getState().hold();
      useDelveReportQueue.getState().push({ kind: "join", title: "A wild creature joined" });
      useDelveReportQueue.getState().release();
      expect(useToastStack.getState().toasts).toHaveLength(1);

      vi.advanceTimersByTime(4000);
      expect(useToastStack.getState().toasts).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("release without a prior hold is a no-op beyond clearing state — nothing to flush, nothing pushed", () => {
    expect(() => useDelveReportQueue.getState().release()).not.toThrow();
    expect(useToastStack.getState().toasts).toEqual([]);
    expect(useDelveReportQueue.getState().held).toBe(false);
  });
});

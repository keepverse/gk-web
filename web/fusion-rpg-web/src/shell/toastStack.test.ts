import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useToastStack } from "./toastStack";

beforeEach(() => {
  vi.useFakeTimers();
  useToastStack.getState().clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("toastStack", () => {
  it("push adds a toast and returns its id", () => {
    const id = useToastStack.getState().push({ tone: "ok", title: "Creature updated" });
    expect(useToastStack.getState().toasts).toHaveLength(1);
    expect(useToastStack.getState().toasts[0]!.id).toBe(id);
  });

  it("auto-expires after the default duration", () => {
    useToastStack.getState().push({ tone: "ok", title: "Creature updated" });
    expect(useToastStack.getState().toasts).toHaveLength(1);
    vi.advanceTimersByTime(5000);
    expect(useToastStack.getState().toasts).toHaveLength(0);
  });

  it("dismiss removes a toast before it would auto-expire", () => {
    const id = useToastStack.getState().push({ tone: "bad", title: "Failed" }, 10000);
    useToastStack.getState().dismiss(id);
    expect(useToastStack.getState().toasts).toHaveLength(0);
    vi.advanceTimersByTime(10000);
    expect(useToastStack.getState().toasts).toHaveLength(0);
  });

  it("clear removes every toast and cancels their timers", () => {
    useToastStack.getState().push({ tone: "ok", title: "A" });
    useToastStack.getState().push({ tone: "ok", title: "B" });
    useToastStack.getState().clear();
    expect(useToastStack.getState().toasts).toEqual([]);
  });

  it("multiple toasts coexist independently", () => {
    useToastStack.getState().push({ tone: "ok", title: "A" }, 1000);
    useToastStack.getState().push({ tone: "bad", title: "B" }, 3000);
    vi.advanceTimersByTime(1000);
    expect(useToastStack.getState().toasts.map((t) => t.title)).toEqual(["B"]);
    vi.advanceTimersByTime(2000);
    expect(useToastStack.getState().toasts).toEqual([]);
  });
});

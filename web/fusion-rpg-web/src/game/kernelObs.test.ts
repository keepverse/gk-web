import { afterEach, describe, expect, it, vi } from "vitest";
import {
  emitKernelObs,
  resetKernelObsForTests
} from "./kernelObs";

describe("kernelObs", () => {
  afterEach(() => {
    resetKernelObsForTests();
    vi.restoreAllMocks();
  });

  it("appends events and mirrors onto window.__fusionRpgKernelObs", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    emitKernelObs("destroyGame", { generation: 1 });
    emitKernelObs("phaser-island-host", { event: "create" });

    expect(window.__fusionRpgKernelObs).toHaveLength(2);
    expect(window.__fusionRpgKernelObs![0]!.channel).toBe("destroyGame");
    expect(window.__fusionRpgKernelObs![0]!.payload).toEqual({ generation: 1 });
    expect(window.__fusionRpgKernelObs![1]!.channel).toBe("phaser-island-host");
    expect(info).toHaveBeenCalled();
  });

  it("reset clears the ring and the window mirror", () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    emitKernelObs("x", {});
    expect(window.__fusionRpgKernelObs?.length).toBe(1);

    resetKernelObsForTests();
    expect(window.__fusionRpgKernelObs).toBeUndefined();
  });
});

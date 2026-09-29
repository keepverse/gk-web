import { describe, expect, it } from "vitest";
import {
  createStageBus,
  STAGE_BUS_REQUIRED_STEMS,
  stageEventNames
} from "./stageBus";
import {
  battleBusEmit,
  battleBusOn,
  siegeBusEmit,
  siegeBusOn
} from "./EventBus";

describe("createStageBus", () => {
  it("on/emit/clearAll — handlers removed after clear", () => {
    const bus = createStageBus<"a" | "b">();
    const seen: unknown[] = [];
    bus.on("a", (p) => seen.push(p));
    bus.emit("a", { generation: 1 });
    expect(seen).toEqual([{ generation: 1 }]);
    bus.clearAll();
    bus.emit("a", { generation: 2 });
    expect(seen).toEqual([{ generation: 1 }]);
  });

  it("unsubscribe removes a single handler", () => {
    const bus = createStageBus<"x">();
    const seen: unknown[] = [];
    const off = bus.on("x", (p) => seen.push(p));
    off();
    bus.emit("x", 1);
    expect(seen).toEqual([]);
  });

  it("required stems produce prefixed event names", () => {
    const names = stageEventNames("siege");
    expect(names).toEqual([
      "siege:model",
      "siege:select",
      "siege:interaction",
      "siege:ready",
      "siege:resized",
      "siege:destroyed"
    ]);
    expect(STAGE_BUS_REQUIRED_STEMS).toHaveLength(6);
  });
});

describe("frozen siege/battle bus names (lock 5a)", () => {
  it("siegeBusEmit / siegeBusOn resolve and carry generation", () => {
    const seen: unknown[] = [];
    const off = siegeBusOn("siege:ready", (p) => seen.push(p));
    siegeBusEmit("siege:ready", { generation: 9 });
    expect(seen).toEqual([{ generation: 9 }]);
    off();
  });

  it("battleBusEmit / battleBusOn resolve and carry generation", () => {
    const seen: unknown[] = [];
    const off = battleBusOn("battle:destroyed", (p) => seen.push(p));
    battleBusEmit("battle:destroyed", { generation: 3 });
    expect(seen).toEqual([{ generation: 3 }]);
    off();
  });
});

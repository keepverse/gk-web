import { describe, expect, it } from "vitest";
import { delveSelectionReducer, initialDelveSelection } from "./delveSelection";

describe("delveSelectionReducer (D5.4, mirrors worldSelection.ts's select-sector shape)", () => {
  it("starts with nothing selected", () => {
    expect(initialDelveSelection).toEqual({ selectedRoomId: null });
  });

  it("selects a room", () => {
    const next = delveSelectionReducer(initialDelveSelection, { type: "select-room", roomId: "s-1" });
    expect(next.selectedRoomId).toBe("s-1");
  });

  it("selecting the already-selected room again deselects it (the worldUiReducer W65 rule, reused)", () => {
    const selected = delveSelectionReducer(initialDelveSelection, { type: "select-room", roomId: "s-1" });
    const toggled = delveSelectionReducer(selected, { type: "select-room", roomId: "s-1" });
    expect(toggled.selectedRoomId).toBeNull();
  });

  it("selecting a different room replaces the selection outright, no toggle", () => {
    const selected = delveSelectionReducer(initialDelveSelection, { type: "select-room", roomId: "s-1" });
    const replaced = delveSelectionReducer(selected, { type: "select-room", roomId: "s-2" });
    expect(replaced.selectedRoomId).toBe("s-2");
  });

  it("an explicit null dispatch always clears, even mid-selection (Esc's own shape)", () => {
    const selected = delveSelectionReducer(initialDelveSelection, { type: "select-room", roomId: "s-1" });
    const cleared = delveSelectionReducer(selected, { type: "select-room", roomId: null });
    expect(cleared.selectedRoomId).toBeNull();
  });
});

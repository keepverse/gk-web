import { describe, expect, it } from "vitest";
import { DELVE_PANEL_IDS, delvePanelTitle, toDelvePanelId } from "./panelId";

describe("panelId (D5.7, spec-delve-stage.md §4/§14 — the six band-2 panel ids)", () => {
  it("declares exactly the six ids §14's own literal list names, in that order", () => {
    expect(DELVE_PANEL_IDS).toEqual(["pack", "talk", "event", "object", "supply", "fight"]);
  });

  it("every real id round-trips through toDelvePanelId unchanged", () => {
    for (const id of DELVE_PANEL_IDS) {
      expect(toDelvePanelId(id)).toBe(id);
    }
  });

  it("no panel requested (raw null) normalizes to null", () => {
    expect(toDelvePanelId(null)).toBeNull();
  });

  it("an unrecognised raw value normalizes to null, not a guess and not a throw", () => {
    expect(toDelvePanelId("bogus")).toBeNull();
    expect(toDelvePanelId("")).toBeNull();
    expect(toDelvePanelId("objectPrompt")).toBeNull(); // the longer type name is not the wire id
    expect(toDelvePanelId("Pack")).toBeNull(); // case-sensitive: not the same id as "pack"
  });

  it("every real id has its own non-empty, distinct title", () => {
    const titles = DELVE_PANEL_IDS.map(delvePanelTitle);
    expect(titles.every((t) => t.trim().length > 0)).toBe(true);
    expect(new Set(titles).size).toBe(titles.length);
  });
});

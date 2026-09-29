import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { surfaceFootFactory } from "./chrome";

const bus = { emit: vi.fn() } as never;

/**
 * `surface-foot` is a **shared** kit piece: the derived console is its only live consumer today, but
 * it is registered under `storyScene`-style groups and any recipe may bind it.
 *
 * It used to default `note` / `deferred` to the derived console's own developer wording
 * (`"expand×join · UnitClass closed"`, `"Deferred in FE v1: live build compare · full xyflow calc
 * graph"`). That is another surface's copy — and engine vocabulary on a player surface — leaking to
 * whoever binds the piece without passing its own. The piece's job is to print what it is handed.
 */
describe("surface-foot — the note and the deferred line belong to the caller", () => {
  it("renders the payload's note and deferred line verbatim", () => {
    const { container } = render(
      <>
        {surfaceFootFactory({
          payload: {
            piece: "surface-foot",
            instanceId: "foot:x",
            phase: "ready",
            hiddenCount: 4,
            note: "expand×join · UnitClass closed",
            deferred: "Deferred in FE v1: a caller-supplied line"
          },
          slots: {},
          bus
        })}
      </>
    );
    // The live derived console's own copy still renders — this fix changes the fallback, not the
    // payload path (the idea doc's instruction: fix the default, do not rewrite the piece).
    expect(container.textContent).toContain("expand×join · UnitClass closed");
    expect(container.textContent).toContain("Deferred in FE v1: a caller-supplied line");
    expect(container.querySelector('[data-testid="derived-hidden-count"]')?.textContent).toBe("4");
  });

  it("invents no copy when the payload omits both, so no other surface inherits the wording", () => {
    const { container } = render(
      <>
        {surfaceFootFactory({
          payload: { piece: "surface-foot", instanceId: "foot:x", phase: "ready", hiddenCount: 2 },
          slots: {},
          bus
        })}
      </>
    );
    const text = container.textContent ?? "";
    expect(text).toContain("Hidden unchanged: 2");
    expect(text).not.toContain("·");
    expect(text).not.toContain("expand×join");
    expect(text).not.toContain("UnitClass");
    expect(text).not.toContain("xyflow");
    // No empty second span either: the caller's line is a sibling, not a permanent slot.
    expect(container.querySelectorAll("footer > span")).toHaveLength(1);
  });

  it("holds no surface's player copy in its own source", () => {
    // The regression this pins, in the shape the sibling pieces use: the wording reappearing as a
    // default. The strings' source of truth is the producing fold + the approved design draft.
    const source = readFileSync(join(__dirname, "chrome.tsx"), "utf8");
    expect(source).not.toContain("UnitClass");
    expect(source).not.toContain("xyflow");
    expect(source).not.toContain("Deferred in FE v1");
  });
});

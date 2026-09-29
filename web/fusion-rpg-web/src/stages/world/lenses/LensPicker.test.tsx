import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { dispatchGlobalVerb, resetKeymapForTests } from "@/shell/keymap";
import { LensPicker } from "./LensPicker";
import { LENSES, HOME_LENS_ID, lensLabel, type LensId } from "./lensCatalog";

describe("LensPicker (world-stage W96, spec-world-lenses.md §1)", () => {
  it("the active lens's name is on screen at all times", () => {
    resetKeymapForTests();
    render(<LensPicker active="danger" onSelect={() => {}} />);
    expect(screen.getByTestId("lens-picker-readout")).toHaveTextContent(lensLabel("danger"));
  });

  it("clicking a chip selects it directly", async () => {
    resetKeymapForTests();
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<LensPicker active={HOME_LENS_ID} onSelect={onSelect} />);

    await user.click(screen.getByTestId("lens-picker-supply"));
    expect(onSelect).toHaveBeenCalledWith("supply");
  });

  it("1-6 select each lens directly via the real global verb dispatch", () => {
    resetKeymapForTests();
    const onSelect = vi.fn();
    render(<LensPicker active={HOME_LENS_ID} onSelect={onSelect} />);

    for (const lens of LENSES) {
      onSelect.mockClear();
      expect(dispatchGlobalVerb(lens.key)).toBe(true);
      expect(onSelect).toHaveBeenCalledWith(lens.id as LensId);
    }
  });

  it("mounting the stage twice in one session does not throw, and unmounting frees the digits for the next stage's hotbar", () => {
    resetKeymapForTests();
    const first = render(<LensPicker active={HOME_LENS_ID} onSelect={() => {}} />);
    first.unmount();

    // A second, later stage mount registering the same 1-6 digits must not collide with a
    // leftover registration from the first mount — registerGlobalVerb throws on any duplicate key.
    expect(() => render(<LensPicker active={HOME_LENS_ID} onSelect={() => {}} />)).not.toThrow();
  });

  it("declares no z-index of its own — plain in-flow chrome, never a layer", () => {
    const text = readFileSync(join(__dirname, "LensPicker.tsx"), "utf8");
    expect(text).not.toMatch(/zIndex\s*[:=]|z-index\s*:/);
  });

  it("W97 — the lens-4 chip alone carries the pending treatment while its own fetch is in flight", () => {
    resetKeymapForTests();
    render(<LensPicker active={HOME_LENS_ID} onSelect={() => {}} isLensFourLoading />);

    expect(screen.getByTestId("lens-picker-supply")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByTestId("lens-picker-supply-pending")).toBeInTheDocument();
    for (const lens of LENSES.filter((l) => l.id !== "supply")) {
      expect(screen.getByTestId(`lens-picker-${lens.id}`)).toHaveAttribute("aria-busy", "false");
    }
  });

  it("carries no pending treatment on any chip when lens 4 isn't loading", () => {
    resetKeymapForTests();
    render(<LensPicker active={HOME_LENS_ID} onSelect={() => {}} />);

    expect(screen.queryByTestId("lens-picker-supply-pending")).not.toBeInTheDocument();
    expect(screen.getByTestId("lens-picker-supply")).toHaveAttribute("aria-busy", "false");
  });
});

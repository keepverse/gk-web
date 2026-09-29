import { describe, expect, it } from "vitest";
import { contrastRatio } from "./contrast";

/**
 * The token pair matrix docs/design/_kit/tokens.css claims is AA — verified
 * here rather than trusted from the comment (this repo's own "a comment is
 * not evidence" rule, DESIGN-GATE.md §3.2, applies to design tokens too).
 * Two of these (warn, bad) are accessibility fixes the kit had already
 * worked out but the shipped app never received until T7's regeneration —
 * see the kit's own "FIXED" annotations on those two lines.
 */
const AA_NORMAL_TEXT = 4.5;
const AA_UI_COMPONENT = 3.0;

const soil = "#16120e";
const panel = "#2a231b";
const lawn = "#3d6b45";
const lawnHot = "#5a8f62";
const text = "#f2ead8";
const muted = "#a89880";
const inkDark = "#16120e";
const sun = "#e0b44b";
const ok = "#6fbf73";
const warn = "#d8a94f";
const bad = "#d97b7b";
const badSolid = "#a33c3c";
const borderControl = "#7a6d59";
const border = "#4a4034";

describe("contrastRatio", () => {
  it("is 1 for identical colors and >1 otherwise", () => {
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
  });

  it("is symmetric", () => {
    expect(contrastRatio(text, panel)).toBeCloseTo(contrastRatio(panel, text), 5);
  });
});

describe("token pair matrix — WCAG AA (text pairs >= 4.5:1)", () => {
  it.each([
    ["text on soil (page background)", text, soil],
    ["text on panel", text, panel],
    ["muted on panel", muted, panel],
    ["text on lawn", text, lawn],
    ["ink-dark on lawn-hot", inkDark, lawnHot],
    ["sun on panel", sun, panel],
    ["ok on panel", ok, panel],
    ["warn on panel (accessibility fix ported by T7)", warn, panel],
    ["bad on panel (accessibility fix ported by T7 — was 3.71, below AA)", bad, panel],
    ["text on bad-solid (the filled-danger banner)", text, badSolid]
  ])("%s meets 4.5:1", (_label, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });
});

describe("token pair matrix — WCAG 1.4.11 UI components (>= 3:1)", () => {
  it("border-control on panel meets the non-text/UI-component minimum", () => {
    expect(contrastRatio(borderControl, panel)).toBeGreaterThanOrEqual(AA_UI_COMPONENT);
  });
});

describe("the one deliberate exception", () => {
  it("border-on-panel is documented as decorative-only and is not held to a contrast minimum — it separates nothing interactive", () => {
    const ratio = contrastRatio(border, panel);
    expect(ratio).toBeLessThan(AA_UI_COMPONENT); // proves this pair genuinely needs the exemption, not that nobody checked
  });
});

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { BlockedTarget } from "./BlockedTarget";
import { isInertVerb, placementFor } from "./blockedPlacement";

/** The full 41-token drop-reason inventory `world-playback` W72 audited — restated here so this
 * task's own "table test over the whole token set" walks the real vocabulary, not a sample. */
const DROP_REASONS = [
  "kind.unknown",
  "command.id-missing",
  "command.id-too-long",
  "commander.unknown",
  "entity.unknown",
  "entity.not-yours",
  "sector.unknown",
  "entity.missing",
  "stance.unknown",
  "sector.missing",
  "sector.not-yours",
  "warden.missing",
  "amount.invalid",
  "slot.unknown",
  "structure.unknown",
  "lane.unknown",
  "entity.routed",
  "entity.held",
  "entity.gone",
  "claim.elsewhere",
  "claim.contested",
  "claim.guarded",
  "build.elsewhere",
  "build.not-yours",
  "build.occupied",
  "build.wrong-slot-kind",
  "build.out-of-range",
  "build.cannot-afford",
  "sector.gone",
  "warden.not-yours",
  "sustain.not-standing",
  "sustain.not-yours",
  "sustain.nothing-carried",
  "slot.elsewhere",
  "guard.already-cleared",
  "path.empty",
  "path.not-contiguous",
  "lane.no-heading",
  "lane.severed",
  "lane.one-way",
  "lane.gated"
];

describe("blockedPlacement — every one of the 41 drop reasons has a real placement (world-stage W70)", () => {
  it("names exactly 41 reasons, no duplicates", () => {
    expect(DROP_REASONS).toHaveLength(41);
    expect(new Set(DROP_REASONS).size).toBe(41);
  });

  it("every reason maps to one of the four subjects — road / sector / slot / marker", () => {
    for (const reason of DROP_REASONS) {
      const placement = placementFor(reason);
      expect(placement, `${reason} has no placement`).not.toBeNull();
      expect(["road", "sector", "slot", "marker"]).toContain(placement);
    }
  });

  it("sustain and build are no longer inert — world-stage W66 already wired their fields", () => {
    expect(isInertVerb("sustain")).toBe(false);
    expect(isInertVerb("build")).toBe(false);
  });

  it("ward is the one verb still genuinely inert — no admission arm, no wire field", () => {
    expect(isInertVerb("ward")).toBe(true);
  });
});

describe("BlockedTarget — three visually distinct treatments, table test over the whole set (world-stage W70)", () => {
  it("available renders nothing at all — the caller's normal control shows instead", () => {
    const { container } = render(<BlockedTarget state={{ kind: "available" }} placement="sector" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("every one of the 41 drop reasons renders blocked (hatched, crossed, captioned), never a raw token", () => {
    for (const reason of DROP_REASONS) {
      const placement = placementFor(reason)!;
      const { unmount } = render(<BlockedTarget state={{ kind: "blocked", reason }} placement={placement} />);
      const target = screen.getByTestId("blocked-target");
      expect(target).toHaveAttribute("data-kind", "blocked");
      expect(target).toHaveAttribute("data-pattern", "hatched");
      expect(target).toHaveAttribute("data-placement", placement);
      const caption = screen.getByTestId("blocked-target-caption");
      expect(caption.textContent).not.toContain(reason);
      expect(caption.textContent!.length).toBeGreaterThan(0);
      unmount();
    }
  });

  it("blocked is never merely dimmed — it carries a real crossed glyph, not just an opacity change", () => {
    render(<BlockedTarget state={{ kind: "blocked", reason: "claim.contested" }} placement="sector" />);
    expect(screen.getByTestId("blocked-target").querySelector('[aria-hidden="true"]')).toHaveTextContent("✕");
  });

  it("inert reads as a third, calmer treatment — no hatch, no cross, distinct from blocked", () => {
    render(<BlockedTarget state={{ kind: "inert", explanation: "The game cannot carry this order yet." }} placement="road" />);
    const target = screen.getByTestId("blocked-target");
    expect(target).toHaveAttribute("data-kind", "inert");
    expect(target).not.toHaveAttribute("data-pattern");
    expect(screen.getByTestId("blocked-target-caption")).toHaveTextContent("cannot carry this order yet");
  });

  it("the sentence is attached to the right subject via the placement attribute — road / sector / slot / marker", () => {
    render(<BlockedTarget state={{ kind: "blocked", reason: "lane.severed" }} placement="road" />);
    expect(screen.getByTestId("blocked-target")).toHaveAttribute("data-placement", "road");
  });
});

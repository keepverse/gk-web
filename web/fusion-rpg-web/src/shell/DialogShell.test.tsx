import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DialogShell } from "./DialogShell";

/** Renders the shell open with a stable testId so the root and body can be inspected. */
function renderShell(props: { size?: "default" | "scene" } = {}) {
  render(
    <DialogShell open onOpenChange={() => {}} title="The Rift is opening" testId="t" {...props}>
      Body content
    </DialogShell>
  );
  return {
    root: screen.getByTestId("t"),
    body: screen.getByTestId("t-body")
  };
}

/**
 * Owner decision S1: a story scene is full-bleed. It must fill the **viewport** (not a phone
 * browser's static chrome) and must **never scroll** — a scene's content is a fixed-aspect art
 * bed plus one line, so overflow is a content defect, not something a scrollbar absorbs.
 *
 * GG-61 exemption, scoped to `size="scene"` only: GG-61 forbids a band-2/3 shell growing to
 * swallow the viewport, because a DENSE ENTITY (an actor's sheet, an item's affix list) needs a
 * bounded box so its body can scroll internally. A scene is not a dense entity and does not
 * scroll, so the failure GG-61 prevents cannot occur here. Every other caller keeps the bounded
 * card unchanged and GG-61 still governs them.
 */
describe("DialogShell size contract", () => {
  it("keeps today's bounded card when `size` is omitted", () => {
    const { root, body } = renderShell();
    expect(root.className).toContain("w-[min(440px,92vw)]");
    expect(root.className).toContain("max-h-[min(720px,82vh)]");
    expect(root.className).not.toContain("100dvh");
    // The default body is the one scrolling region (GG-61).
    expect(body.className).toContain("overflow-y-auto");
  });

  it("keeps today's bounded card for an explicit `size=\"default\"`", () => {
    const { root } = renderShell({ size: "default" });
    expect(root.className).toContain("w-[min(440px,92vw)]");
    expect(root.className).not.toContain("100dvh");
  });

  it("fills the viewport with dynamic viewport units for `size=\"scene\"`", () => {
    const { root } = renderShell({ size: "scene" });
    // 100dvh, never 100vh: mobile browser chrome must not clip the scene.
    expect(root.className).toContain("100dvh");
    expect(root.className).not.toContain("100vh");
    expect(root.className).not.toContain("w-[min(440px,92vw)]");
    expect(root.className).not.toContain("max-h-[min(720px,82vh)]");
  });

  it("introduces no scroll container in a scene", () => {
    const { root, body } = renderShell({ size: "scene" });
    // A scrollbar anywhere in a scene is a defect (spec §"A scene never scrolls").
    expect(root.className).not.toContain("overflow-y-auto");
    expect(body.className).not.toContain("overflow-y-auto");
    expect(body.className).toContain("overflow-hidden");
  });

  it("still renders its normal chrome in a scene", () => {
    renderShell({ size: "scene" });
    expect(screen.getByRole("heading", { name: "The Rift is opening" })).toBeInTheDocument();
    expect(screen.getByTestId("t-body")).toHaveTextContent("Body content");
  });
});

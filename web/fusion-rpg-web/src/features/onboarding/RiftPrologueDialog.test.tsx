import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { RiftPrologueDialog } from "./RiftPrologueDialog";

const mutateAsync = vi.fn();

vi.mock("@/lib/bus", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/bus")>();
  return { ...actual, useAcknowledgeOnboardingStory: () => ({ mutateAsync, isPending: false }) };
});

beforeEach(() => {
  mutateAsync.mockReset();
  mutateAsync.mockResolvedValue({ ok: true });
});

describe("RiftPrologueDialog", () => {
  it("walks the four beats and acknowledges completed exactly once", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onCue = vi.fn();
    const onContinueToLawn = vi.fn();
    renderWithProviders(
      <RiftPrologueDialog open playerId={1} onClose={onClose} onCue={onCue} onContinueToLawn={onContinueToLawn} />
    );

    expect(screen.getByLabelText("Beat 1 of 4")).toBeInTheDocument();
    expect(onCue).toHaveBeenLastCalledWith("rift.portal.open");
    const next = screen.getByRole("button", { name: "Next" });
    await user.click(next);
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("button", { name: "Anchor the lawn" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Anchor the lawn" }));
    await user.click(screen.getByRole("button", { name: "Anchor the lawn" }));

    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(mutateAsync).toHaveBeenCalledWith({ storyId: "rift-prologue", version: 1, outcome: "completed" });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onContinueToLawn).toHaveBeenCalledTimes(1);
    expect(onCue).toHaveBeenCalledTimes(4);
  });

  it("supports skip and keeps a failed acknowledgement bypassable", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onContinueToLawn = vi.fn();
    mutateAsync.mockRejectedValueOnce(new Error("offline"));
    renderWithProviders(
      <RiftPrologueDialog open playerId={1} onClose={onClose} onContinueToLawn={onContinueToLawn} />
    );

    await user.click(screen.getByRole("button", { name: "Skip intro" }));
    expect(await screen.findByRole("status")).toHaveTextContent("try again next time");
    expect(screen.getByRole("button", { name: "Continue to lawn" })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Continue to lawn" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onContinueToLawn).toHaveBeenCalledTimes(1);
  });

  /**
   * Band compliance (T4, re-expressed at cutover in the piece vocabulary). The rim used to be a
   * `::after` pseudo-element, which paints **after** the element's children, so the art needed a
   * private `z-index: 1` to sit on top. The band guard (GG-5) forbids any `z-index` outside
   * `theme/tokens.css`, so paint order is explicit: the decorative backdrop is a real element
   * placed **before** the art in document order.
   *
   * The two `rift-prologue-rim` spans this test used to query were the retired dialog's own
   * markup; the cutover moved the decorative layer into the `scene-stage` piece as
   * `.story-scene-stage__backdrop`, so the assertions follow it there. The contract is unchanged
   * and still asserted here at the assembled surface (not only at the piece): normal flow paints
   * the art above the decoration with no stacking tier.
   *
   * This is why the assertion is on DOM order rather than on a class name — DOM order *is* the
   * stacking mechanism now, so this test guards the thing that actually replaces the z-index.
   */
  it("paints the scene art above its rim without a private stacking tier", () => {
    renderWithProviders(
      <RiftPrologueDialog open playerId={1} onClose={() => {}} onContinueToLawn={() => {}} />
    );

    const scene = document.querySelector(".story-scene-stage");
    expect(scene).not.toBeNull();

    const backdrop = scene!.querySelector(".story-scene-stage__backdrop");
    const art = scene!.querySelector(".story-scene-stage__art");
    expect(backdrop).not.toBeNull();
    expect(art).not.toBeNull();

    const children = Array.from(scene!.children);
    const backdropIndex = children.indexOf(backdrop as Element);
    const artIndex = children.indexOf(art as Element);
    expect(backdropIndex).toBeGreaterThanOrEqual(0);
    expect(artIndex).toBeGreaterThanOrEqual(0);
    // The art must follow the decoration, so normal flow paints it on top.
    expect(backdropIndex).toBeLessThan(artIndex);
  });

  it("keeps the decorative rims out of the accessibility tree and out of the pointer path", () => {
    renderWithProviders(
      <RiftPrologueDialog open playerId={1} onClose={() => {}} onContinueToLawn={() => {}} />
    );
    // Same vocabulary move as above: the retired dialog's two rim spans are the stage piece's
    // single backdrop now. The pointer-path half lives in CSS (`pointer-events: none` on the
    // backdrop rule, `sceneStage.css`), which jsdom cannot evaluate — the DOM half, exclusion
    // from the accessibility tree, is asserted here.
    const backdrop = document.querySelector(".story-scene-stage__backdrop");
    expect(backdrop).not.toBeNull();
    expect(backdrop!.getAttribute("aria-hidden")).toBe("true");
  });
});

import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import type { PiecePayload } from "@/features/gui-lego/types";
import { actorPortraitFactory } from "./actorPortrait";
import { actorSpriteFactory } from "./actorSprite";

/**
 * `actor-portrait` carries `speaking | inactive` state for one actor in a slot array. Speaking is
 * structural (size, lift, ring weight, opacity) so it survives without color; the inactive actor
 * stays visible; variant continuity belongs to the fold, which this piece never touches.
 */
const bus = { emit: () => {}, on: () => () => {} };

function spriteNode(variantId = "default", spriteUrl: string | null = null) {
  return actorSpriteFactory({
    payload: {
      piece: "actor-sprite",
      instanceId: "scene:actor:dave:sprite",
      phase: "ready",
      actorId: "dave",
      displayName: "Dave",
      initial: "D",
      variantId,
      spriteUrl,
      themeRef: { kind: "actor", id: "dave" }
    } as unknown as PiecePayload,
    slots: {},
    bus
  });
}

function renderPortrait(over: Record<string, unknown> = {}, body?: React.ReactNode) {
  const payload = {
    piece: "actor-portrait",
    instanceId: "scene:actor:dave",
    phase: "ready",
    actorId: "dave",
    speaking: true,
    variantId: "default",
    spriteUrl: null,
    themeRef: { kind: "actor", id: "dave" },
    ...over
  } as unknown as PiecePayload;
  return render(
    <>{actorPortraitFactory({ payload, slots: { body: body ?? spriteNode() }, bus })}</>
  );
}

describe("actor-portrait — speaking state is structural", () => {
  it("marks the speaking actor with data-speaking=true and the lift posture", () => {
    const { container } = renderPortrait({ speaking: true });
    const root = container.querySelector(".story-actor-portrait");
    expect(root?.getAttribute("data-speaking")).toBe("true");
    expect(container.querySelector(".story-actor-portrait__lift")).not.toBeNull();
    expect(container.querySelector(".story-actor-portrait__settle")).toBeNull();
  });

  it("marks the inactive actor with data-speaking=false and the settle posture, still visible", () => {
    const { container } = renderPortrait({ speaking: false });
    const root = container.querySelector<HTMLElement>(".story-actor-portrait");
    expect(root?.getAttribute("data-speaking")).toBe("false");
    expect(container.querySelector(".story-actor-portrait__settle")).not.toBeNull();
    // Inactive is dimmed, never removed: the sprite node is still in the DOM and readable.
    expect(container.querySelector(".story-actor-sprite__placeholder")).not.toBeNull();
    expect(root?.style.display).not.toBe("none");
    expect(root?.hidden).toBe(false);
  });

  it("treats a non-true speaking value as settled", () => {
    const { container } = renderPortrait({ speaking: undefined });
    expect(container.querySelector(".story-actor-portrait")?.getAttribute("data-speaking")).toBe(
      "false"
    );
  });
});

describe("actor-portrait — variant continuity belongs to the fold", () => {
  it("a speaker change does not reset the other actor's variant", () => {
    // Same variantId across a speaking flip must render the identical sprite subtree: the piece
    // never computes, defaults, or resets a variant — the fold owns continuity. (Ren'Py's failure
    // mode is re-showing by tag and silently dropping attributes.) Only the sprite subtree is
    // compared, because the root's own data-speaking hook legitimately changes.
    const before = renderPortrait({ speaking: false, variantId: "alarmed" }, spriteNode("alarmed"));
    const after = renderPortrait({ speaking: true, variantId: "alarmed" }, spriteNode("alarmed"));
    expect(before.container.querySelector(".story-actor-sprite")?.outerHTML).toBe(
      after.container.querySelector(".story-actor-sprite")?.outerHTML
    );
    before.unmount();
    after.unmount();
  });
});

describe("actor-portrait — not a focus target", () => {
  it("exposes no tabIndex and no button or link role", () => {
    const { container } = renderPortrait({ speaking: true });
    const root = container.querySelector(".story-actor-portrait") as HTMLElement;
    expect(root.tabIndex).toBe(-1);
    expect(root.hasAttribute("tabindex")).toBe(false);
    expect(container.querySelector('[role="button"], [role="link"], button, a')).toBeNull();
  });
});

describe("actor-portrait — fallback through actor-sprite", () => {
  it("spriteUrl null still renders the labelled fallback", () => {
    const { container } = renderPortrait({ spriteUrl: null }, spriteNode("default", null));
    expect(container.querySelector(".story-actor-sprite__placeholder")).not.toBeNull();
    expect(container.querySelector(".story-actor-sprite__name")?.textContent).toBe("Dave");
  });
});

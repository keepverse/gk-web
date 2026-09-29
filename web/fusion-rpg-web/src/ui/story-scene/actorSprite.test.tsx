import { afterEach, describe, expect, it } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { clearPieceRegistryForTests } from "@/features/gui-lego/pieceRegistry";
import type { PiecePayload } from "@/features/gui-lego/types";
import { actorSpriteFactory } from "./actorSprite";

/**
 * `actor-sprite` renders an actor's art, and when art (or the requested variant) is missing it renders
 * an **honest labelled shape carrying the actor's name**.
 *
 * Owner decision 2, and the concrete replacement for the bug: the old fallback was one `◈` plus one
 * shared manifest label for every actor, so two missing actors were indistinguishable and the
 * fallback told neither the player nor the developer *who* was missing.
 *
 * The genre precedent for a labelled shape rather than a nicer blank: Ren'Py's `Placeholder` draws a
 * stand-in body with the image name written on it, and its `config.missing_image_callback` is the
 * documented failure hook; Dialogic degrades a missing portrait to the character's default. Community
 * practice exists specifically because a shared stand-in conflates people.
 */
const bus = { emit: () => {}, on: () => () => {} };

function renderPiece(over: Partial<PiecePayload> = {}) {
  const payload = {
    piece: "actor-sprite",
    instanceId: "scene:actor:penny",
    phase: "empty" as const,
    actorId: "penny",
    displayName: "Penny",
    initial: "P",
    variantId: "default",
    spriteUrl: null,
    themeRef: { kind: "actor", id: "penny" },
    themeResolved: {
      themeId: "actor.penny",
      css: { "--piece-accent": "#6fb7d4" },
      paint: { accent: "#6fb7d4", accentMuted: "#3f7f99", onAccent: "#07161c" },
      vfx: { select: null, idle: null }
    },
    ...over
  } as unknown as PiecePayload;
  return render(<>{actorSpriteFactory({ payload, slots: {}, bus })}</>);
}

describe("actor-sprite — art present", () => {
  it("renders the image when a URL resolved", () => {
    const { container } = renderPiece({ phase: "ready", spriteUrl: "/art/penny.png" });
    const img = container.querySelector("img.story-actor-sprite__art");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toBe("/art/penny.png");
    // No placeholder when art exists.
    expect(container.querySelector(".story-actor-sprite__placeholder")).toBeNull();
  });

  it("marks spoken-beat art decorative, because the dialogue line carries the meaning", () => {
    const { container } = renderPiece({ phase: "ready", spriteUrl: "/art/penny.png" });
    const img = container.querySelector("img.story-actor-sprite__art");
    expect(img?.getAttribute("alt")).toBe("");
    expect(img?.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("actor-sprite — the honest labelled fallback", () => {
  it("renders no <img> at all when the URL is null, so no empty src reaches the DOM", () => {
    const { container } = renderPiece({ spriteUrl: null });
    expect(container.querySelector("img")).toBeNull();
    const emptySrc = Array.from(container.querySelectorAll("[src]")).filter(
      (el) => !el.getAttribute("src")?.trim()
    );
    expect(emptySrc).toHaveLength(0);
  });

  it("treats null, undefined and a blank string alike — none renders an image", () => {
    // The guard is on the *value*, not on the presence of the key: a whitespace-only string would
    // otherwise reach the DOM as `<img src="   ">`, which is a broken image in all but name.
    for (const spriteUrl of [null, undefined, "", "   "]) {
      const { container } = renderPiece({ spriteUrl: spriteUrl as string | null });
      expect(container.querySelector("img"), `spriteUrl=${JSON.stringify(spriteUrl)}`).toBeNull();
      expect(
        container.querySelector(".story-actor-sprite__placeholder"),
        `spriteUrl=${JSON.stringify(spriteUrl)}`
      ).not.toBeNull();
    }
  });

  it("carries the actor's name in the visible text and the accessible name", () => {
    // No `spriteLabel` in the payload: the piece falls back to the (host-localized) display name,
    // so the labelled `role="img"` is never empty; the span list stays short rather than printing
    // an English literal, which is what this piece used to do.
    const { container } = renderPiece({
      displayName: "Penny",
      initial: "P",
      spriteUrl: null
    } as Partial<PiecePayload>);
    const placeholder = container.querySelector(".story-actor-sprite__placeholder");
    expect(placeholder).not.toBeNull();
    // Visible: the point is that a human sees *who* is missing.
    expect(placeholder?.textContent).toContain("Penny");
    expect(placeholder?.textContent).toContain("P");
    expect(placeholder?.getAttribute("role")).toBe("img");
    // Accessible: the same fact for a screen reader.
    expect(placeholder?.getAttribute("aria-label")).toBe("Penny");
    expect(container.querySelector(".story-actor-sprite__hint")).toBeNull();
  });

  it("renders the host-resolved hint and accessible label, and holds no player string of its own", () => {
    // The piece renders payload text verbatim (`spec-piece-contract.md:82`): both strings arrive
    // resolved, so a locale can change them. Under the pseudo locale this is what makes the
    // placeholder pseudo-marked instead of English.
    const { container } = renderPiece({
      displayName: "[!!Penny!!]",
      hintLabel: "[!!art not yet authored!!]",
      spriteLabel: "[!!Penny — art not yet available!!]",
      spriteUrl: null
    } as Partial<PiecePayload>);
    const placeholder = container.querySelector(".story-actor-sprite__placeholder");
    expect(placeholder?.querySelector(".story-actor-sprite__hint")?.textContent).toBe(
      "[!!art not yet authored!!]"
    );
    expect(placeholder?.getAttribute("aria-label")).toBe("[!!Penny — art not yet available!!]");

    // The regression this pins: an English literal reappearing in the piece. Assert on the piece's
    // own module source, so a new hard-coded player string fails here rather than in a locale.
    const source = readFileSync(join(__dirname, "actorSprite.tsx"), "utf8");
    for (const literal of ["art not yet authored", "art not yet available"]) {
      expect(source, `English literal \"${literal}\" is back in the piece`).not.toContain(literal);
    }
  });

  it("makes two missing actors distinguishable, not one shared glyph", () => {
    // The old defect: a single `◈` and one shared `fallbackLabel` for everyone. Asserted on the
    // rendered output, so a regression to a shared placeholder fails here.
    const penny = renderPiece({ actorId: "penny", displayName: "Penny", initial: "P" });
    const pennyLabel = penny.container.querySelector(".story-actor-sprite__placeholder")?.getAttribute("aria-label");
    const pennyText = penny.container.querySelector(".story-actor-sprite__placeholder")?.textContent;
    penny.unmount();

    const dave = renderPiece({
      actorId: "dave",
      displayName: "Dave",
      initial: "D",
      instanceId: "scene:actor:dave",
      themeRef: { kind: "actor", id: "dave" },
      themeResolved: {
        themeId: "actor.dave",
        css: { "--piece-accent": "#d9a15c" },
        paint: { accent: "#d9a15c", accentMuted: "#8f6a3a", onAccent: "#1b1208" },
        vfx: { select: null, idle: null }
      }
    });
    const daveLabel = dave.container.querySelector(".story-actor-sprite__placeholder")?.getAttribute("aria-label");
    const daveText = dave.container.querySelector(".story-actor-sprite__placeholder")?.textContent;

    expect(pennyLabel).not.toBe(daveLabel);
    expect(pennyText).not.toBe(daveText);
    expect(pennyText).toContain("Penny");
    expect(daveText).toContain("Dave");
  });

  it("renders each actor's own initial, so the shape differs by letter too", () => {
    // Asserted separately from the whole-text inequality: a shared glyph in the initial slot would
    // still leave the name distinct, so the text comparison alone does not pin this.
    const penny = renderPiece({ actorId: "penny", displayName: "Penny", initial: "P" });
    const pennyInitial = penny.container.querySelector(".story-actor-sprite__initial")?.textContent;
    penny.unmount();

    const dave = renderPiece({
      actorId: "dave",
      displayName: "Dave",
      initial: "D",
      instanceId: "scene:actor:dave"
    });
    const daveInitial = dave.container.querySelector(".story-actor-sprite__initial")?.textContent;

    expect(pennyInitial).toBe("P");
    expect(daveInitial).toBe("D");
    expect(pennyInitial).not.toBe(daveInitial);
  });

  it("uses `phase: empty` for not-yet-authored art, not `error`", () => {
    // "Not authored" is an expected development state; `error` is reserved for a genuine failure.
    const { container } = renderPiece({ phase: "empty", spriteUrl: null });
    expect(container.querySelector(".story-actor-sprite__placeholder")).not.toBeNull();
  });

  it("still labels the actor when its pack is missing (neutral fallback)", () => {
    // Rule 2: a missing pack must not silently unlabel a person.
    const { container } = renderPiece({
      themeResolved: {
        themeId: "neutral",
        css: {},
        paint: { accent: "#888888", accentMuted: "#555555", onAccent: "#111111" },
        vfx: { select: null, idle: null }
      }
    });
    const placeholder = container.querySelector(".story-actor-sprite__placeholder");
    expect(placeholder?.textContent).toContain("Penny");
  });
});

describe("actor-sprite — runtime load failure", () => {
  afterEach(() => clearPieceRegistryForTests());

  it("degrades to the placeholder when the image fails to load, so a broken URL never paints a broken glyph", () => {
    const { container } = renderPiece({ phase: "ready", spriteUrl: "/art/missing.png" });
    const img = container.querySelector("img.story-actor-sprite__art");
    expect(img).not.toBeNull();

    fireEvent.error(img as Element);

    const placeholder = container.querySelector(".story-actor-sprite__placeholder");
    expect(placeholder).not.toBeNull();
    expect(placeholder?.textContent).toContain("Penny");
    // The broken <img> is gone entirely — the placeholder is the terminal state.
    expect(container.querySelector("img")).toBeNull();
  });
});

describe("actor-sprite — paint and theming", () => {
  it("applies the pack's css custom properties and vfx class to its landmark root", () => {
    // `RecipeMount` themes only factory-free pieces, so a registered factory must apply both itself.
    const { container } = renderPiece({
      phase: "ready",
      spriteUrl: "/art/penny.png",
      themeResolved: {
        themeId: "actor.penny",
        css: { "--piece-accent": "#6fb7d4" },
        paint: { accent: "#6fb7d4", accentMuted: "#3f7f99", onAccent: "#07161c" },
        vfx: { select: "vfx.actor-penny", idle: null }
      }
    });
    const root = container.querySelector(".story-actor-sprite") as HTMLElement;
    expect(root.style.getPropertyValue("--piece-accent")).toBe("#6fb7d4");
    expect(root.className).toContain("vfx-actor-penny");
  });

  it("contains no hard-coded actor hex in its own source — accent comes from the pack", () => {
    // The rendered DOM *legitimately* carries the pack's hex as an inline custom property — that is
    // precisely how pack paint reaches a themed piece. The rule is about the piece's own source: a
    // literal there would make one actor's colour a component concern instead of a pack's, which is
    // the same defect as the old hard-coded `text-ok` speaker label.
    const source = readFileSync(join(__dirname, "actorSprite.tsx"), "utf8");
    const hexLiterals = source.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
    expect(hexLiterals).toEqual([]);
  });

  it("never tints by the faction `side` axis", () => {
    // Neither actor is a plant or a zombie; `ActorFrame`'s side tint is exactly what this piece must
    // not borrow. Asserted on the DOM so a copy-paste from ActorFrame fails here.
    const { container } = renderPiece();
    expect(container.querySelector("[data-side]")).toBeNull();
    expect(container.innerHTML).not.toMatch(/side-(plant|zombie)/);
  });
});

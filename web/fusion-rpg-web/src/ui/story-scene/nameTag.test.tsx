import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PiecePayload } from "@/features/gui-lego/types";
import { nameTagFactory } from "./nameTag";

/**
 * `name-tag` labels the current speaker with **pack-owned paint**, and is **absent** on a narration
 * beat.
 *
 * The bug it replaces is one line: `RiftPrologueDialog.tsx`'s
 * `<p className="… text-ok">{beat.speaker}</p>` — a hard-coded identity colour (which is the same
 * defect as a hard-coded hex) over a free string that could not tell an actor from a synthetic label.
 *
 * **Absence is the contract for narration**: no empty tag, no placeholder name, no fake "Narrator".
 * Ren'Py's say screen behaves the same way — the `who` text appears only when a character spoke, and
 * a single-argument say is narration.
 */
const bus = { emit: () => {}, on: () => () => {} };

function renderTag(over: Partial<PiecePayload> = {}) {
  const payload = {
    piece: "name-tag",
    instanceId: "scene:name-tag",
    phase: "ready" as const,
    displayName: "Penny",
    themeRef: { kind: "actor", id: "penny" },
    themeResolved: {
      themeId: "actor.penny",
      css: { "--piece-accent": "#6fb7d4" },
      paint: { accent: "#6fb7d4", accentMuted: "#3f7f99", onAccent: "#07161c" },
      vfx: { select: null, idle: null }
    },
    ...over
  } as unknown as PiecePayload;
  return render(<>{nameTagFactory({ payload, slots: {}, bus })}</>);
}

describe("name-tag — the speaker label", () => {
  it("renders the speaker's name as visible text", () => {
    const { container } = renderTag({ displayName: "Penny" });
    const label = container.querySelector(".story-name-tag__label");
    expect(label).not.toBeNull();
    expect(label?.textContent).toBe("Penny");
    // Spoken-beat copy is real content, so it is announced, not hidden.
    expect(container.querySelector(".story-name-tag")).not.toBeNull();
  });
});

describe("name-tag — narration renders nothing", () => {
  it("renders no tag node at all when displayName is empty", () => {
    // The fold already omits the slot on a narration beat; this piece guards too, so an upstream
    // mistake cannot ship an empty tag. Asserted as *absence* of the node, not a hidden class.
    const { container } = renderTag({ displayName: "" });
    expect(container.querySelector(".story-name-tag")).toBeNull();
    expect(container.querySelector(".story-name-tag__label")).toBeNull();
    expect(container.textContent).toBe("");
  });

  it("renders nothing for a whitespace-only name, rather than a blank tag", () => {
    const { container } = renderTag({ displayName: "   " });
    expect(container.querySelector(".story-name-tag")).toBeNull();
    expect(container.textContent).toBe("");
  });

  it("never invents a narrator label when there is no speaker", () => {
    // A fake speaker is explicitly banned: the honest rendering of narration is *no tag*.
    const { container } = renderTag({ displayName: "" });
    expect(container.textContent).not.toMatch(/narrator|unknown|speaker/i);
  });
});

describe("name-tag — paint is pack-owned", () => {
  it("applies the pack's css custom properties and vfx class to its landmark root", () => {
    // A registered factory gets no theme from `RecipeMount` (it applies `themeStyle`/`vfxClass` only
    // on the factory-free path), so the factory must apply both itself or the pack never reaches the DOM.
    const { container } = renderTag({
      themeResolved: {
        themeId: "actor.penny",
        css: { "--piece-accent": "#6fb7d4" },
        paint: { accent: "#6fb7d4", accentMuted: "#3f7f99", onAccent: "#07161c" },
        vfx: { select: "vfx.actor-penny", idle: null }
      }
    });
    const root = container.querySelector(".story-name-tag") as HTMLElement;
    expect(root.style.getPropertyValue("--piece-accent")).toBe("#6fb7d4");
    expect(root.className).toContain("vfx-actor-penny");
  });

  it("renders two actors differently, without either being a hard-coded colour", () => {
    const penny = renderTag({ displayName: "Penny" });
    const pennyRoot = penny.container.querySelector(".story-name-tag") as HTMLElement;
    const pennyAccent = pennyRoot.style.getPropertyValue("--piece-accent");
    penny.unmount();

    const dave = renderTag({
      displayName: "Dave",
      themeRef: { kind: "actor", id: "dave" },
      themeResolved: {
        themeId: "actor.dave",
        css: { "--piece-accent": "#d9a15c" },
        paint: { accent: "#d9a15c", accentMuted: "#8f6a3a", onAccent: "#1b1208" },
        vfx: { select: null, idle: null }
      }
    });
    const daveAccent = (dave.container.querySelector(".story-name-tag") as HTMLElement).style.getPropertyValue(
      "--piece-accent"
    );

    expect(pennyAccent).toBe("#6fb7d4");
    expect(daveAccent).toBe("#d9a15c");
    expect(pennyAccent).not.toBe(daveAccent);
  });

  it("contains no hard-coded identity colour in its own source", () => {
    // The point of the task: a literal here (or a `text-ok` utility) would make one speaker's colour a
    // component concern instead of a pack's. Scanned on source with comments stripped — the rendered
    // DOM legitimately carries the pack's hex as an inline custom property, and the file's own
    // doc comment quotes the old `text-ok` to explain what it replaced, which is not a paint value.
    // (Same discipline `vocabularyGuard` uses: it skips comments so prose about a leak is not a leak.)
    const source = readFileSync(join(__dirname, "nameTag.tsx"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(source.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
    expect(source).not.toMatch(/text-ok|text-side-plant|text-side-zombie/);
  });

  it("leaves styling to the pack — no identity utility class in the markup", () => {
    const { container } = renderTag();
    const markup = container.innerHTML;
    expect(markup).not.toMatch(/text-ok/);
    // Colour arrives as a custom property, so the class list carries no colour token.
    expect(markup).not.toMatch(/text-(side|el|rarity)-/);
  });

  it("still labels the speaker when the pack is missing (neutral fallback)", () => {
    // A missing pack must not silently unlabel a person; the tag renders with neutral paint.
    const { container } = renderTag({
      themeResolved: {
        themeId: "neutral",
        css: {},
        paint: { accent: "#888888", accentMuted: "#555555", onAccent: "#111111" },
        vfx: { select: null, idle: null }
      }
    });
    expect(container.querySelector(".story-name-tag__label")?.textContent).toBe("Penny");
  });
});

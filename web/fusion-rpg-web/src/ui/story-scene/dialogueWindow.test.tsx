import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PiecePayload } from "@/features/gui-lego/types";
import { dialogueWindowFactory } from "./dialogueWindow";
import { nameTagFactory } from "./nameTag";

/**
 * `dialogue-window` is the say window: the speaker's line, an optional teaching sentence, and the
 * narration variant. It owns **readability**, not colour — the `name-tag` inside it owns the speaker's
 * identity paint.
 *
 * Ren'Py separates these the same way (a `window` containing the `who` text and the line, with the
 * speaker region as its own optional id), and Dialogic separates the portrait/label from the viewport.
 * So a narration beat is the **same window** with the `nameTag` slot empty — never a second component
 * and never a fake speaker.
 *
 * The rules that matter here:
 *
 * - **The line is the live region**, and only the line. Wrapping the whole window re-announces the
 *   name tag and the teaching sentence on every beat.
 * - **A text wall is unrepresentable**: one line plus at most one teaching sentence, no paragraph
 *   array, no pagination, no scroll — the beat cap catches an over-long script, not this piece.
 * - **A line is never truncated.**
 */
const bus = { emit: () => {}, on: () => () => {} };

function renderWindow(over: Record<string, unknown> = {}, withNameTag = false) {
  const payload = {
    piece: "dialogue-window",
    instanceId: "scene:window",
    phase: "ready" as const,
    line: "Temporal signal unstable.",
    teaching: "The fracture is new, and something inside it is changing.",
    narration: false,
    themeRef: { kind: "scene", id: "rift-portal" },
    themeResolved: {
      themeId: "scene.rift-portal",
      css: { "--piece-accent": "#c46bff" },
      paint: { accent: "#c46bff", accentMuted: "#7d43a8", onAccent: "#120821" },
      vfx: { select: null, idle: null }
    },
    ...over
  } as unknown as PiecePayload;

  // The `nameTag` slot is filled by the fold via `bindSurface`; here it is supplied directly so the
  // window can be tested without the recipe.
  const slots = withNameTag
    ? {
        nameTag: nameTagFactory({
          payload: {
            piece: "name-tag",
            instanceId: "scene:name-tag",
            phase: "ready",
            displayName: "Penny",
            themeResolved: {
              themeId: "actor.penny",
              css: { "--piece-accent": "#6fb7d4" },
              paint: { accent: "#6fb7d4", accentMuted: "#3f7f99", onAccent: "#07161c" },
              vfx: { select: null, idle: null }
            }
          } as unknown as PiecePayload,
          slots: {},
          bus
        })
      }
    : {};

  return render(<>{dialogueWindowFactory({ payload, slots, bus })}</>);
}

describe("dialogue-window — the line and teaching", () => {
  it("renders the line verbatim", () => {
    const { container } = renderWindow({ line: "Uh-oh. That lawn is doing the wrong kind of wobbly." });
    expect(container.querySelector(".story-dialogue-window__line")?.textContent).toBe(
      "Uh-oh. That lawn is doing the wrong kind of wobbly."
    );
  });

  it("renders the teaching sentence only when present", () => {
    const withTeaching = renderWindow({ teaching: "A sentence." });
    expect(withTeaching.container.querySelector(".story-dialogue-window__teaching")?.textContent).toBe(
      "A sentence."
    );
    withTeaching.unmount();

    const withoutTeaching = renderWindow({ teaching: undefined });
    expect(withoutTeaching.container.querySelector(".story-dialogue-window__teaching")).toBeNull();
  });

  it("never renders an empty teaching node", () => {
    const { container } = renderWindow({ teaching: "   " });
    // Whitespace is not content: an empty paragraph would space the window for nothing.
    expect(container.querySelector(".story-dialogue-window__teaching")).toBeNull();
  });

  it("accepts no paragraph array — a text wall is unrepresentable", () => {
    // The payload type has `line: string`, and the piece reads no array. Passing one through must not
    // become a list of paragraphs.
    const { container } = renderWindow({ line: ["one", "two", "three"] as unknown as string });
    const lines = container.querySelectorAll(".story-dialogue-window__line");
    expect(lines).toHaveLength(1);
    expect(container.querySelectorAll("li, .story-dialogue-window__paragraph")).toHaveLength(0);
  });
});

describe("dialogue-window — the name-tag slot", () => {
  it("hosts the name tag when the beat has a speaker", () => {
    const { container } = renderWindow({ narration: false }, true);
    expect(container.querySelector(".story-dialogue-window__nameTag")).not.toBeNull();
    expect(container.querySelector(".story-name-tag__label")?.textContent).toBe("Penny");
  });

  it("renders the SAME window with no tag on a narration beat", () => {
    // Not a second component, and not a fake speaker: the narration variant is the same window with
    // an empty slot.
    const { container } = renderWindow({ narration: true }, false);
    expect(container.querySelector(".story-dialogue-window")).not.toBeNull();
    expect(container.querySelector(".story-dialogue-window__line")).not.toBeNull();
    expect(container.querySelector(".story-dialogue-window__nameTag")).toBeNull();
    expect(container.querySelector(".story-name-tag")).toBeNull();
    expect(container.textContent).not.toMatch(/narrator/i);
  });

  it("suppresses a supplied tag on a narration beat, so an upstream mistake cannot print a speaker", () => {
    // The guard that matters: a caller who *passes* a nameTag to a narration beat must not get a
    // speaker printed over a line nobody spoke. Passing `true` for the slot here is deliberate —
    // the fold omits it, but the piece must not rely on that.
    const { container } = renderWindow({ narration: true }, true);
    expect(container.querySelector(".story-dialogue-window")).not.toBeNull();
    expect(container.querySelector(".story-dialogue-window__nameTag")).toBeNull();
    expect(container.querySelector(".story-name-tag")).toBeNull();
    expect(container.textContent).not.toContain("Penny");
  });
});

describe("dialogue-window — the live region", () => {
  it("scopes aria-live to the line only", () => {
    // Wrapping the whole window re-announces the tag and teaching on every beat.
    const { container } = renderWindow({}, true);
    const line = container.querySelector(".story-dialogue-window__line");
    expect(line?.getAttribute("aria-live")).toBe("polite");
    // The window root and the teaching line are NOT live regions.
    expect(container.querySelector(".story-dialogue-window")?.getAttribute("aria-live")).toBeNull();
    expect(
      container.querySelector(".story-dialogue-window__teaching")?.getAttribute("aria-live")
    ).toBeNull();
    expect(
      container.querySelector(".story-dialogue-window__nameTag")?.getAttribute("aria-live")
    ).toBeNull();
  });
});

describe("dialogue-window — paint and source hygiene", () => {
  it("applies the pack's css custom properties and vfx class to its landmark root", () => {
    const { container } = renderWindow({
      themeResolved: {
        themeId: "scene.quarantine",
        css: { "--piece-accent": "#8fb8c9" },
        paint: { accent: "#8fb8c9", accentMuted: "#54707d", onAccent: "#0a1013" },
        vfx: { select: "vfx.quarantine-seal", idle: null }
      }
    });
    const root = container.querySelector(".story-dialogue-window") as HTMLElement;
    expect(root.style.getPropertyValue("--piece-accent")).toBe("#8fb8c9");
    expect(root.className).toContain("vfx-quarantine-seal");
  });

  it("carries no hard-coded colour literal in its own source", () => {
    const source = readFileSync(join(__dirname, "dialogueWindow.tsx"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(source.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
  });

  it("truncates nothing and adds no scroll container in its own CSS", () => {
    // A truncated line is a defect, not a design choice; a scrolling say window is the text-wall
    // failure the design exists to prevent. Scanned with comments stripped — this file's own CSS
    // comment names the banned properties to explain their absence, which is prose, not a rule.
    const css = readFileSync(join(__dirname, "dialogueWindow.css"), "utf8").replace(
      /\/\*[\s\S]*?\*\//g,
      ""
    );
    expect(css).not.toMatch(/text-overflow\s*:\s*ellipsis/);
    expect(css).not.toMatch(/overflow-y\s*:\s*(auto|scroll)/);
    expect(css).not.toMatch(/white-space\s*:\s*nowrap/);

    // Absence alone would pass if the wrapping declarations were deleted, so assert they are present:
    // `overflow-wrap: anywhere` is what breaks a long unbroken token (a URL), and `white-space:
    // normal` is what allows wrapping at spaces at all.
    expect(css).toMatch(/overflow-wrap\s*:\s*anywhere/);
    expect(css).toMatch(/white-space\s*:\s*normal/);
  });

  it("takes the window tint from the pack's real variable name", () => {
    // The scene packs declare `--scene-window`. Reading a differently-named variable (e.g.
    // `--piece-scene-window`) resolves to nothing and silently drops to the fallback, so the pack's
    // tint never reaches the DOM while every other assertion still passes. Pinned here.
    const css = readFileSync(join(__dirname, "dialogueWindow.css"), "utf8").replace(
      /\/\*[\s\S]*?\*\//g,
      ""
    );
    expect(css).toMatch(/var\(--scene-window\b/);
    expect(css).not.toMatch(/--piece-scene-window/);

    // And confirm the variable the CSS reads is the one the packs actually define.
    for (const pack of ["scene-rift-portal", "scene-quarantine"]) {
      const json = readFileSync(
        join(__dirname, "..", "..", "features", "gui-lego", "themes", `${pack}.json`),
        "utf8"
      );
      expect(json, `${pack} must declare --scene-window`).toContain('"--scene-window"');
    }
  });
});

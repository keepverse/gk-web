import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PiecePayload } from "@/features/gui-lego/types";
import { sceneProgressFactory } from "./sceneProgress";

/**
 * `scene-progress` shows where the player is in the scene — beat `n of m` — as pips plus an accessible
 * label. It replaces an inline span that assembled its own `Beat ${i + 1} of ${n}` string.
 *
 * Two rules carry the design:
 *
 * - **The label is authored by the fold and rendered verbatim**, so there is one place to translate and
 *   one place to test. The piece assembles no string.
 * - **A one-beat scene renders nothing.** That rule is what lets a reveal reuse this piece (decision 4:
 *   a reveal is a one-beat scene) with no meaningless "1 of 1".
 *
 * `total` is the script's own length, read from the payload — never a hard-coded constant, and never
 * asserted here as a literal count of the shipped script.
 */
const bus = { emit: () => {}, on: () => () => {} };

function renderProgress(over: Record<string, unknown> = {}) {
  const payload = {
    piece: "scene-progress",
    instanceId: "scene:progress",
    phase: "ready" as const,
    index: 1,
    total: 4,
    label: "Beat 2 of 4",
    showPips: true,
    themeRef: { kind: "scene", id: "rift-portal" },
    themeResolved: {
      themeId: "scene.rift-portal",
      css: { "--piece-accent": "#c46bff" },
      paint: { accent: "#c46bff", accentMuted: "#7d43a8", onAccent: "#120821" },
      vfx: { select: null, idle: null }
    },
    ...over
  } as unknown as PiecePayload;
  return render(<>{sceneProgressFactory({ payload, slots: {}, bus })}</>);
}

describe("scene-progress — the label", () => {
  it("renders the payload's label verbatim", () => {
    // Verbatim, not templated: the fold owns the wording so a translator has one message id.
    const { container } = renderProgress({ index: 1, total: 4, label: "Beat 2 of 4" });
    expect(container.querySelector(".story-scene-progress__label")?.textContent).toBe("Beat 2 of 4");
  });

  it("renders a differently-worded label unchanged, proving it assembles no string", () => {
    // A translator's reordering ("2 / 4 beats") must survive untouched.
    const { container } = renderProgress({ label: "2 / 4 beats" });
    expect(container.querySelector(".story-scene-progress__label")?.textContent).toBe("2 / 4 beats");
  });
});

describe("scene-progress — the one-beat rule", () => {
  it("renders no node at all when the scene has one beat", () => {
    // A reveal is a one-beat scene; "1 of 1" would be meaningless chrome.
    const { container } = renderProgress({ index: 0, total: 1, label: "Beat 1 of 1" });
    expect(container.querySelector(".story-scene-progress")).toBeNull();
    expect(container.textContent).toBe("");
  });

  it("renders no node for a degenerate zero-beat total", () => {
    const { container } = renderProgress({ index: 0, total: 0, label: "" });
    expect(container.querySelector(".story-scene-progress")).toBeNull();
  });

  it("renders for a two-beat scene, so the rule is `<= 1` and not `< 2`", () => {
    const { container } = renderProgress({ index: 0, total: 2, label: "Beat 1 of 2" });
    expect(container.querySelector(".story-scene-progress")).not.toBeNull();
  });
});

describe("scene-progress — pips", () => {
  it("renders one pip per beat, derived from the payload's total", () => {
    // Derived from `total`, so a longer scene needs no code change and no test edit.
    for (const total of [2, 3, 4, 7]) {
      const view = renderProgress({ index: 0, total, label: `Beat 1 of ${total}` });
      const pips = view.container.querySelectorAll(".story-scene-progress__pip");
      expect(pips.length, `total=${total}`).toBe(total);
      view.unmount();
    }
  });

  it("marks the current pip without relying on colour alone", () => {
    // Colour-only state fails for a colour-blind player; the current pip carries a distinct attribute
    // and the CSS elongates it.
    const { container } = renderProgress({ index: 2, total: 4 });
    const pips = Array.from(container.querySelectorAll(".story-scene-progress__pip"));
    const current = pips.filter((p) => p.getAttribute("data-current") === "true");
    expect(current).toHaveLength(1);
    expect(pips.indexOf(current[0])).toBe(2);
  });

  it("keeps the pips decorative — the label carries the semantics", () => {
    const { container } = renderProgress();
    expect(container.querySelector(".story-scene-progress__pips")?.getAttribute("aria-hidden")).toBe(
      "true"
    );
  });

  it("omits the pips when showPips is false, keeping the label", () => {
    const { container } = renderProgress({ showPips: false });
    expect(container.querySelector(".story-scene-progress__pips")).toBeNull();
    expect(container.querySelector(".story-scene-progress__label")?.textContent).toBe("Beat 2 of 4");
  });
});

describe("scene-progress — paint comes from the pack", () => {
  it("applies the pack's css custom properties and vfx class to its landmark root", () => {
    const { container } = renderProgress({
      themeResolved: {
        themeId: "scene.quarantine",
        css: { "--piece-accent": "#8fb8c9" },
        paint: { accent: "#8fb8c9", accentMuted: "#54707d", onAccent: "#0a1013" },
        vfx: { select: "vfx.quarantine-seal", idle: null }
      }
    });
    const root = container.querySelector(".story-scene-progress") as HTMLElement;
    expect(root.style.getPropertyValue("--piece-accent")).toBe("#8fb8c9");
    expect(root.className).toContain("vfx-quarantine-seal");
  });

  it("carries no hard-coded colour literal in its own source", () => {
    const source = readFileSync(join(__dirname, "sceneProgress.tsx"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(source.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
  });

  it("persists nothing — beat position is session UI state", () => {
    // A tab closed before acknowledgement restarts at beat 1, so no storage may be touched here.
    const source = readFileSync(join(__dirname, "sceneProgress.tsx"), "utf8");
    expect(source).not.toMatch(/localStorage|sessionStorage|document\.cookie/);
  });
});

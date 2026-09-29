import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PiecePayload } from "@/features/gui-lego/types";
import { sceneStageFactory } from "./sceneStage";

/**
 * `scene-stage` is the compose root: full-bleed art bed, band-utility stacking, the cue state the
 * whole scene reads, and the two-actor responsive layout. It owns composition and geometry — never
 * actor identity, copy, or paint.
 */
const bus = { emit: () => {}, on: () => () => {} };

function renderStage(
  over: Record<string, unknown> = {},
  slots: Record<string, React.ReactNode> = {}
) {
  const payload = {
    piece: "scene-stage",
    instanceId: "scene:stage",
    phase: "ready",
    sceneId: "test-scene-xyz",
    cueId: "rift.portal.open",
    title: "The Rift is opening",
    themeRef: { kind: "scene", id: "rift-portal" },
    ...over
  } as unknown as PiecePayload;
  return render(<>{sceneStageFactory({ payload, slots, bus })}</>);
}

const actors = (names: string[]) =>
  names.map((name) => <div key={name} data-testid={`actor-${name}`} />);

describe("scene-stage — cue state and identity hygiene", () => {
  it("sets data-cue from cueId", () => {
    const { container } = renderStage({ cueId: "rift.quarantine.seal" });
    expect(container.querySelector(".story-scene-stage")?.getAttribute("data-cue")).toBe(
      "rift.quarantine.seal"
    );
  });

  it("omits data-cue when the beat has none", () => {
    const { container } = renderStage({ cueId: null });
    expect(container.querySelector(".story-scene-stage")?.hasAttribute("data-cue")).toBe(false);
  });

  it("never renders sceneId or cueId as player text", () => {
    // sceneId is deliberately unguessable here so a leak cannot hide behind familiar words.
    const { container } = renderStage({ sceneId: "test-scene-xyz", cueId: "rift.portal.open" });
    const text = container.textContent ?? "";
    expect(text).not.toContain("test-scene-xyz");
    expect(text).not.toContain("rift.portal.open");
  });

  it("renders title and subtitle as the shell text", () => {
    const { container } = renderStage({ title: "The Rift is opening", subtitle: "Stay calm" });
    expect(container.textContent).toContain("The Rift is opening");
    expect(container.textContent).toContain("Stay calm");
  });
});

describe("scene-stage — actors array", () => {
  it("renders 1..n actors in the order given", () => {
    const { container } = renderStage({}, { actors: actors(["dave", "penny"]) });
    const rendered = Array.from(
      container.querySelectorAll(".story-scene-stage__actors > [data-testid]")
    ).map((el) => el.getAttribute("data-testid"));
    expect(rendered).toEqual(["actor-dave", "actor-penny"]);
  });

  it("renders a single actor without requiring two", () => {
    const { container } = renderStage({}, { actors: actors(["penny"]) });
    expect(container.querySelectorAll(".story-scene-stage__actors > [data-testid]")).toHaveLength(1);
  });

  it("renders an empty actors region when no actors are passed", () => {
    const { container } = renderStage({});
    expect(container.querySelector(".story-scene-stage__actors")).not.toBeNull();
    expect(container.querySelectorAll(".story-scene-stage__actors > *")).toHaveLength(0);
  });
});

describe("scene-stage — slots", () => {
  it("renders window, progress and advance when present", () => {
    const { container } = renderStage(
      {},
      {
        window: <div data-testid="w" />,
        progress: <div data-testid="p" />,
        advance: <div data-testid="a" />
      }
    );
    expect(container.querySelector('[data-testid="w"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="p"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="a"]')).not.toBeNull();
  });

  it("omits absent slots without empty wrappers", () => {
    const { container } = renderStage({});
    expect(container.querySelector(".story-scene-stage__window")).toBeNull();
    expect(container.querySelector(".story-scene-stage__progress")).toBeNull();
    expect(container.querySelector(".story-scene-stage__advance")).toBeNull();
  });
});

describe("scene-stage — art bed semantics", () => {
  it("paints the art bed above the decorative backdrop by document order, never a stacking tier", () => {
    // Band compliance: the old dialog needed a private z-index because its rim was a ::after
    // pseudo-element (painted after children). Here the backdrop is a real element placed before
    // the art in document order, so normal flow paints the art on top — DOM order IS the stacking
    // mechanism, and the no-z-index rule below is the other half of the same guarantee.
    const { container } = renderStage({}, { window: <div data-testid="w" /> });
    const stage = container.querySelector(".story-scene-stage");
    expect(stage).not.toBeNull();
    const backdrop = stage!.querySelector(".story-scene-stage__backdrop");
    const art = stage!.querySelector(".story-scene-stage__art");
    expect(backdrop).not.toBeNull();
    expect(art).not.toBeNull();
    const children = Array.from(stage!.children);
    expect(children.indexOf(backdrop as Element)).toBeLessThan(
      children.indexOf(art as Element)
    );
  });

  it("keeps the decorative backdrop out of the accessibility tree", () => {
    const { container } = renderStage({}, { window: <div data-testid="w" /> });
    expect(
      container.querySelector(".story-scene-stage__backdrop")?.getAttribute("aria-hidden")
    ).toBe("true");
  });

  it("hides the art bed from assistive tech when a dialogue line is present", () => {
    const { container } = renderStage({}, { window: <div data-testid="w" /> });
    expect(
      container.querySelector(".story-scene-stage__art")?.getAttribute("aria-hidden")
    ).toBe("true");
  });

  it("does not hide the art bed when there is no window to carry the meaning", () => {
    const { container } = renderStage({});
    expect(
      container.querySelector(".story-scene-stage__art")?.hasAttribute("aria-hidden")
    ).toBe(false);
  });
});

describe("scene-stage — motion branch", () => {
  const realMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = realMatchMedia;
  });

  function mockMatchMedia(matches: boolean) {
    window.matchMedia = vi.fn().mockReturnValue({
      matches,
      addEventListener: () => {},
      removeEventListener: () => {}
    }) as unknown as typeof window.matchMedia;
  }

  it("marks instant when the OS prefers reduced motion", () => {
    mockMatchMedia(true);
    const { container } = renderStage({});
    expect(container.querySelector(".story-scene-stage")?.getAttribute("data-motion")).toBe(
      "instant"
    );
  });

  it("marks animated otherwise", () => {
    mockMatchMedia(false);
    const { container } = renderStage({});
    expect(container.querySelector(".story-scene-stage")?.getAttribute("data-motion")).toBe(
      "animated"
    );
  });
});

describe("scene-stage — tuning-read transition (gap G3)", () => {
  it("reads beatTransitionMs from the tuning file, never a literal", async () => {
    // The value is compared against the JSON source itself, so the test pins "read, not written"
    // without pinning 220 as a constant a rebalance would then have to update.
    const tuning = await import("../../../../../data/tuning/story-scene-ui.v1.json");
    const expected = tuning.scene.beatTransitionMs;
    expect(typeof expected).toBe("number");
    const { container } = renderStage({});
    expect(container.querySelector(".story-scene-stage__art")?.getAttribute("style")).toContain(
      `transition-duration: ${expected}ms`
    );
  });
});

describe("scene-stage — Enter/Space advance contract (gap G4)", () => {
  function renderWithBus() {
    const emitted: Array<{ event: string; payload?: unknown }> = [];
    const testBus = { emit: (event: string, payload?: unknown) => void emitted.push({ event, payload }), on: () => () => {} };
    const payload = {
      piece: "scene-stage",
      instanceId: "scene:stage",
      phase: "ready",
      sceneId: "test-scene-xyz",
      cueId: "rift.portal.open",
      title: "T",
      themeRef: { kind: "scene", id: "rift-portal" }
    } as unknown as PiecePayload;
    const utils = render(
      <>
        {sceneStageFactory({
          payload,
          slots: { window: <div data-testid="w" />, advance: <button type="button">Next</button> },
          bus: testBus
        })}
      </>
    );
    return { ...utils, emitted };
  }

  it("Enter on the stage surface emits story-scene.advance", async () => {
    const { container, emitted } = renderWithBus();
    const { fireEvent } = await import("@testing-library/react");
    fireEvent.keyDown(container.querySelector(".story-scene-stage")!, { key: "Enter" });
    expect(emitted.map((e) => e.event)).toContain("story-scene.advance");
  });

  it("Space on the stage surface emits story-scene.advance", async () => {
    const { container, emitted } = renderWithBus();
    const { fireEvent } = await import("@testing-library/react");
    fireEvent.keyDown(container.querySelector(".story-scene-stage")!, { key: " " });
    expect(emitted.map((e) => e.event)).toContain("story-scene.advance");
  });

  it("does not double-fire when a button handles the key itself", async () => {
    // The shipped guard this preserves: a focused Next/Skip keeps native behavior.
    const { container, emitted } = renderWithBus();
    const { fireEvent } = await import("@testing-library/react");
    const button = container.querySelector(".story-scene-stage__advance button")!;
    fireEvent.keyDown(button, { key: "Enter" });
    expect(emitted).toHaveLength(0);
  });

  it("other keys do nothing", async () => {
    const { container, emitted } = renderWithBus();
    const { fireEvent } = await import("@testing-library/react");
    fireEvent.keyDown(container.querySelector(".story-scene-stage")!, { key: "Tab" });
    expect(emitted).toHaveLength(0);
  });
});

describe("scene-stage — window is the focus target", () => {
  it("focuses the dialogue window on mount", () => {
    const { container } = renderStage({}, { window: <div data-testid="w" /> });
    expect(document.activeElement?.closest(".story-scene-stage__window")).not.toBeNull();
  });

  it("window wrapper is programmatically focusable but out of tab order", () => {
    const { container } = renderStage({}, { window: <div data-testid="w" /> });
    expect(container.querySelector(".story-scene-stage__window")?.getAttribute("tabindex")).toBe(
      "-1"
    );
  });
});

describe("scene-stage — CSS contract (file content, since jsdom cannot measure layout)", () => {
  const css = readFileSync(join(__dirname, "sceneStage.css"), "utf8");
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");

  it("collapses the cast below 720px and never hides an actor", () => {
    // The breakpoint the owner accepted: side by side ≥720px, stacked below. jsdom cannot apply
    // media queries, so the test pins the rule's presence; the draft HTML proves it renders.
    expect(stripped).toContain("@media (max-width: 719px)");
    expect(stripped).toContain("flex-direction: column");
    expect(stripped).not.toMatch(/display\s*:\s*none/);
  });

  it("never scrolls: the stage fits the viewport and the bed yields first", () => {
    // Full-bleed scenes never scroll (spec boundary). The bed shrinks (flex) while the window and
    // the advance control are pinned (flex: none) — an unreachable advance control would trap the
    // player, so this ordering is the S1 risk made structural.
    expect(stripped).toContain("overflow: hidden");
    expect(stripped).not.toMatch(/overflow-y\s*:\s*(auto|scroll)/);
    expect(stripped).toContain("min-height: 0");
  });

  it("carries no stacking tier of its own", () => {
    expect(stripped).not.toMatch(/z-index\s*:/);
    expect(stripped).not.toMatch(/z-\[/);
  });

  it("carries the reduced-motion kill-switch for real browsers", () => {
    expect(stripped).toContain("@media (prefers-reduced-motion: reduce)");
  });
});

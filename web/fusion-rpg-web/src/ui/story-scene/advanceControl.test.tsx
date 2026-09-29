import { describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen
} from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PiecePayload } from "@/features/gui-lego/types";
import { advanceControlFactory } from "./advanceControl";
import { STORY_SCENE_TOUCH_TARGET_MIN_PX } from "./storySceneTokens";

/**
 * `advance-control` owns **both** verbs of a scene — advance and skip — plus their pending and error
 * states. It replaces a raw footer fragment that lived inline in the consumer's JSX, including an
 * inline error-recovery branch.
 *
 * The binding rules this pins, and why:
 *
 * - **Skip is present on every beat, including the last** (owner decision 5). The narrative source's
 *   own rule is that *"skipping never loses Souls, grants, content, or future story access"*, so
 *   gating skip behind anything would be dishonest.
 * - **One terminal path.** `advance` and `skip` resolve through the same host action, so a skip can
 *   never leave half-written state — the failure practitioners name when a skip merely stops the
 *   sequence and softlocks the game.
 * - **`pending` disables both verbs** and the primary shows the in-flight label. That is the visible
 *   half of the double-click guard.
 * - **The error branch is a variant, not a fork**: the player can still reach the lawn without a
 *   successful acknowledgement.
 * - **No keybinding.** Enter/Space advance belongs to the stage on the focused body; the keymap owns
 *   verbs (including the reserved hotkey `keymapGuard` polices), and a piece-level global listener
 *   would be a second, invisible input path.
 *
 * The verbs are emitted on the surface's **closed bus** (`story-scene.advance` / `.skip` /
 * `.ack.retry` / `.ack.bypass`), matching the shipped pieces' `bus.emit(...)` convention and the
 * recipe-wire spec's rule that *"pieces never fetch and never call the mutation directly — they emit,
 * the host acts"*.
 */
function renderControl(over: Record<string, unknown> = {}) {
  const emit = vi.fn();
  const payload = {
    piece: "advance-control",
    instanceId: "scene:advance",
    phase: "ready" as const,
    isLastBeat: false,
    nextLabel: "Next",
    finalLabel: "Anchor the lawn",
    skipLabel: "Skip intro",
    pendingLabel: "Saving…",
    pending: false,
    retryLabel: "Retry",
    bypassLabel: "Continue to lawn",
    ackFailedLabel: "We couldn't save that just now — try again next time, or carry on to the lawn.",
    themeRef: { kind: "scene", id: "rift-portal" },
    themeResolved: {
      themeId: "scene.rift-portal",
      css: { "--piece-accent": "#c46bff" },
      paint: { accent: "#c46bff", accentMuted: "#7d43a8", onAccent: "#120821" },
      vfx: { select: null, idle: null }
    },
    ...over
  } as unknown as PiecePayload;
  const view = render(
    <>{advanceControlFactory({ payload, slots: {}, bus: { emit, on: () => () => {} } })}</>
  );
  return { ...view, emit };
}

describe("advance-control — the two verbs", () => {
  it("shows the next label on a normal beat and the final label on the last", () => {
    const normal = renderControl({ isLastBeat: false });
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
    normal.unmount();

    renderControl({ isLastBeat: true });
    expect(screen.getByRole("button", { name: "Anchor the lawn" })).toBeInTheDocument();
  });

  it("renders skip on every beat, including the last", () => {
    // Owner decision 5 and the narrative source's own rule: skip is never gated.
    for (const isLastBeat of [false, true]) {
      const view = renderControl({ isLastBeat });
      expect(
        screen.getByRole("button", { name: "Skip intro" }),
        `skip missing at isLastBeat=${isLastBeat}`
      ).toBeInTheDocument();
      view.unmount();
    }
  });

  it("emits advance and skip as distinct closed-bus events", () => {
    const { emit } = renderControl();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip intro" }));
    expect(emit).toHaveBeenCalledWith("story-scene.advance", expect.anything());
    expect(emit).toHaveBeenCalledWith("story-scene.skip", expect.anything());
  });

  it("emits the same advance event on the last beat, so the host has one terminal path", () => {
    // The host decides completion from the beat index, not the piece: that keeps `finish(outcome)` a
    // single code path for watched and skipped alike.
    const { emit } = renderControl({ isLastBeat: true });
    fireEvent.click(screen.getByRole("button", { name: "Anchor the lawn" }));
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit.mock.calls[0][0]).toBe("story-scene.advance");
  });

  it("names the primary verb for its current state, and stays untitled when unnamed", () => {
    // T26: the reveal pins its saved-state explanation on the button itself.
    renderControl({ pending: true, pendingTitle: "Saving reward…" });
    expect(screen.getByRole("button", { name: "Saving…" })).toHaveAttribute(
      "title",
      "Saving reward…"
    );
    cleanup();
    renderControl({ pending: false, primaryTitle: "Acknowledge this reward" });
    expect(screen.getByRole("button", { name: "Next" })).toHaveAttribute(
      "title",
      "Acknowledge this reward"
    );
    cleanup();
    renderControl();
    expect(screen.getByRole("button", { name: "Next" })).not.toHaveAttribute("title");
  });
});

describe("advance-control — pending", () => {
  it("disables both verbs and shows the in-flight label", () => {
    renderControl({ pending: true });
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Skip intro" })).toBeDisabled();
    // The pending label replaces the primary label rather than sitting beside it.
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
  });

  it("does not emit while pending, even if a click slips through", () => {
    const { emit } = renderControl({ pending: true });
    const primary = screen.getByRole("button", { name: "Saving…" });
    fireEvent.click(primary);
    fireEvent.click(primary);
    expect(emit).not.toHaveBeenCalled();
  });
});

describe("advance-control — the error variant", () => {
  it("offers retry and a bypass, and never hides the path to the lawn", () => {
    // A failed acknowledgement must not be a dead end: the inline behaviour being replaced kept the
    // player able to reach the lawn, and that is the contract to preserve.
    const { emit } = renderControl({ error: true });
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    const bypass = screen.getByRole("button", { name: "Continue to lawn" });
    fireEvent.click(bypass);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(emit).toHaveBeenCalledWith("story-scene.ack.bypass", expect.anything());
    expect(emit).toHaveBeenCalledWith("story-scene.ack.retry", expect.anything());
  });

  it("does not also render the normal verbs while in the error state", () => {
    // The variant replaces the normal footer; showing both would offer competing terminal paths.
    renderControl({ error: true });
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Skip intro" })).toBeNull();
  });

  it("shows the failure as status text so it is announced, not silent", () => {
    renderControl({ error: true });
    expect(screen.getByRole("status").textContent?.trim().length).toBeGreaterThan(0);
  });
});

describe("advance-control — labels and paint come from the payload", () => {
  it("hard-codes no player-visible label", () => {
    // Every string is a payload field, so a second scene can relabel without touching the piece.
    const { container } = renderControl({
      nextLabel: "Continue",
      finalLabel: "Begin",
      skipLabel: "Leave",
      pendingLabel: "Working…"
    });
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Leave" })).toBeInTheDocument();
    expect(container.textContent).not.toContain("Next");
    expect(container.textContent).not.toContain("Skip intro");
    expect(container.textContent).not.toContain("Saving");
  });

  it("applies the pack's css custom properties and vfx class to its landmark root", () => {
    const { container } = renderControl({
      themeResolved: {
        themeId: "scene.rift-portal",
        css: { "--piece-accent": "#c46bff" },
        paint: { accent: "#c46bff", accentMuted: "#7d43a8", onAccent: "#120821" },
        vfx: { select: "vfx.rift-portal-surge", idle: null }
      }
    });
    const root = container.querySelector(".story-advance-control") as HTMLElement;
    expect(root.style.getPropertyValue("--piece-accent")).toBe("#c46bff");
    expect(root.className).toContain("vfx-rift-portal-surge");
  });

  it("carries no hard-coded colour literal in its own source", () => {
    const source = readFileSync(join(__dirname, "advanceControl.tsx"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(source.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
  });

  it("wires the target-size floor from the token module, so the number has one home", () => {
    // The CSS consumes `--story-touch-target-min`; the piece sets it from
    // `storySceneTokens.STORY_SCENE_TOUCH_TARGET_MIN_PX`, so 44 is not written in two places and a
    // later change to the floor cannot leave the CSS behind.
    const { container } = renderControl();
    const root = container.querySelector(".story-advance-control") as HTMLElement;
    expect(root.style.getPropertyValue("--story-touch-target-min")).toBe(
      `${STORY_SCENE_TOUCH_TARGET_MIN_PX}px`
    );
    const css = readFileSync(join(__dirname, "advanceControl.css"), "utf8");
    expect(css).toContain("min-height: var(--story-touch-target-min");
    // No literal copy of the floor in the CSS.
    expect(css).not.toContain("min-height: 44px");
  });

  it("registers no keybinding — Enter/Space advance belongs to the stage", () => {
    // A piece-level global listener would be a second, invisible input path; the keymap owns verbs.
    const source = readFileSync(join(__dirname, "advanceControl.tsx"), "utf8");
    expect(source).not.toMatch(/addEventListener|registerGlobalVerb|useEffect\(/);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { StorySceneHost } from "./StorySceneHost";
import { RIFT_PROLOGUE_SCRIPT, type SceneScript } from "@/features/story-scene/sceneScript";
import { ACTOR_IDS, actorDefinition } from "@/features/story-scene/actorCast";

const mutateAsync = vi.fn();

vi.mock("@/lib/bus", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/bus")>();
  return { ...actual, useAcknowledgeOnboardingStory: () => ({ mutateAsync, isPending: false }) };
});

beforeEach(() => {
  mutateAsync.mockReset();
  mutateAsync.mockResolvedValue({ ok: true });
});

function renderHost(over: Partial<Parameters<typeof StorySceneHost>[0]> = {}) {
  const onClose = vi.fn();
  const onCue = vi.fn();
  const onContinue = vi.fn();
  renderWithProviders(
    <StorySceneHost
      script={RIFT_PROLOGUE_SCRIPT}
      open
      playerId={1}
      onClose={onClose}
      onContinue={onContinue}
      onCue={onCue}
      {...over}
    />
  );
  return { onClose, onCue, onContinue };
}

/** A second scene: one beat, one actor, no cue. If the host needs an edit for this, it is not reusable. */
const SYNTHETIC_SCRIPT: SceneScript = {
  sceneId: "synthetic-check",
  version: 1,
  beats: [{ speakerId: "penny", line: "Synthetic line." }]
};

describe("StorySceneHost", () => {
  it("renders no scene markup of its own — every pixel is a piece", () => {
    // DialogShell portals into document.body, so all queries are document-wide (screen), never
    // container-scoped — container.innerHTML is always empty here.
    renderWithProviders(
      <StorySceneHost script={RIFT_PROLOGUE_SCRIPT} open playerId={1} onClose={() => {}} />
    );
    // The host contributes shell chrome only; the scene surface is mounted pieces.
    expect(document.querySelector(".story-scene-stage")).not.toBeNull();
    expect(document.body.textContent).toContain("The Rift is opening");
  });

  it("walks beats and acknowledges completed exactly once (double-click safe)", async () => {
    const user = userEvent.setup();
    const { onCue } = renderHost();
    expect(screen.getByText("Beat 1 of 4")).toBeInTheDocument();
    expect(onCue).toHaveBeenLastCalledWith("rift.portal.open");
    const next = screen.getByRole("button", { name: "Next" });
    // Double-click the primary: the advance guard makes it exactly one transition.
    await user.click(next);
    await user.click(next);
    expect(screen.getByText("Beat 2 of 4")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("button", { name: "Anchor the lawn" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Anchor the lawn" }));
    await user.click(screen.getByRole("button", { name: "Anchor the lawn" }));

    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(mutateAsync).toHaveBeenCalledWith({
      storyId: "rift-prologue",
      version: 1,
      outcome: "completed"
    });
  });

  it("advance-on-last and skip share one terminal path", async () => {
    const user = userEvent.setup();
    renderHost();
    await user.click(screen.getByRole("button", { name: "Skip intro" }));
    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(mutateAsync).toHaveBeenCalledWith({
      storyId: "rift-prologue",
      version: 1,
      outcome: "skipped"
    });
  });

  it("an acknowledgement failure shows retry + destination, and the destination works without ack", async () => {
    const user = userEvent.setup();
    mutateAsync.mockRejectedValueOnce(new Error("no ledger"));
    const { onContinue } = renderHost();
    await user.click(screen.getByRole("button", { name: "Skip intro" }));
    expect(await screen.findByRole("status")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continue to lawn" }));
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(mutateAsync).toHaveBeenCalledTimes(1);
  });

  it("resets beat index to 0 when open flips true", async () => {
    const user = userEvent.setup();
    const { rerender } = renderWithProviders(
      <StorySceneHost script={RIFT_PROLOGUE_SCRIPT} open playerId={1} onClose={() => {}} />
    );
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Beat 2 of 4")).toBeInTheDocument();
    rerender(
      <StorySceneHost script={RIFT_PROLOGUE_SCRIPT} open={false} playerId={1} onClose={() => {}} />
    );
    rerender(
      <StorySceneHost script={RIFT_PROLOGUE_SCRIPT} open playerId={1} onClose={() => {}} />
    );
    expect(screen.getByText("Beat 1 of 4")).toBeInTheDocument();
  });

  it("a second synthetic script renders through the same host with no host edit", async () => {
    const user = userEvent.setup();
    renderHost({ script: SYNTHETIC_SCRIPT });
    // One beat: no progress (fold omits it), advance completes immediately.
    expect(screen.queryByLabelText(/Beat \d+ of/)).toBeNull();
    expect(screen.getByText("Synthetic line.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Anchor the lawn" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Anchor the lawn" }));
    expect(mutateAsync).toHaveBeenCalledWith({
      storyId: "synthetic-check",
      version: 1,
      outcome: "completed"
    });
  });

  it("renders each portrait's sprite through the per-item body slot", () => {
    // End-to-end proof that the fold's body objects reach a mounted sprite: fold → bind → mount →
    // sprite node. Without the body field plus the recipe's per-item slot, portraits mount empty
    // (the sprite renders nothing and no error surfaces) — this test fails on exactly that shape.
    renderHost();
    const sprites = document.querySelectorAll(".story-actor-sprite");
    expect(sprites).toHaveLength(2);
    const names = Array.from(document.querySelectorAll(".story-actor-sprite__name")).map((el) =>
      el.textContent?.trim()
    );
    // The registry owns the words, so the expectation is built from the cast rather than pinned.
    expect(names.sort()).toEqual([...ACTOR_IDS].map((id) => actorDefinition(id).displayName).sort());
  });

  it("emits the cue once per beat, and tolerates no consumer", async () => {
    const user = userEvent.setup();
    const { onCue } = renderHost();
    expect(onCue).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(onCue).toHaveBeenCalledTimes(2);
    expect(onCue).toHaveBeenLastCalledWith("rift.portal.surge");
  });
});

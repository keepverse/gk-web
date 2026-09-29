import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlaybackTransport } from "./PlaybackTransport";

describe("PlaybackTransport (world-stage W75)", () => {
  it("shows an honest position, and a plain statement rather than 0/0 when there is nothing to step through", () => {
    render(<PlaybackTransport current={0} total={0} onStep={() => {}} />);
    expect(screen.getByTestId("playback-transport-position")).toHaveTextContent("Nothing to play back");
  });

  it("shows the 1-based position out of the real total", () => {
    render(<PlaybackTransport current={2} total={5} onStep={() => {}} />);
    expect(screen.getByTestId("playback-transport-position")).toHaveTextContent("3 / 5");
  });

  it("steps back and forward by exactly one, never re-deriving the delta itself", async () => {
    const user = userEvent.setup();
    const onStep = vi.fn();
    render(<PlaybackTransport current={2} total={5} onStep={onStep} />);

    await user.click(screen.getByTestId("playback-transport-back"));
    expect(onStep).toHaveBeenCalledWith(-1);

    await user.click(screen.getByTestId("playback-transport-forward"));
    expect(onStep).toHaveBeenCalledWith(1);
  });

  it("jumps to either end on ⏮/⏭, an infinite delta the caller's own clamp resolves", async () => {
    const user = userEvent.setup();
    const onStep = vi.fn();
    render(<PlaybackTransport current={2} total={5} onStep={onStep} />);

    await user.click(screen.getByTestId("playback-transport-first"));
    expect(onStep).toHaveBeenCalledWith(-Infinity);

    await user.click(screen.getByTestId("playback-transport-last"));
    expect(onStep).toHaveBeenCalledWith(Infinity);
  });

  it("disables back/first at the start and forward/last at the end, rather than stepping past silently", () => {
    render(<PlaybackTransport current={0} total={3} onStep={() => {}} />);
    expect(screen.getByTestId("playback-transport-back")).toBeDisabled();
    expect(screen.getByTestId("playback-transport-first")).toBeDisabled();
    expect(screen.getByTestId("playback-transport-forward")).not.toBeDisabled();

    render(<PlaybackTransport current={2} total={3} onStep={() => {}} />);
    expect(screen.getAllByTestId("playback-transport-forward").at(-1)).toBeDisabled();
    expect(screen.getAllByTestId("playback-transport-last").at(-1)).toBeDisabled();
  });
});

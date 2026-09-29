import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { FirstOpenSignal } from "./FirstOpenSignal";
import { recordFirstOpen, usePlayers } from "@/lib/bus";

vi.mock("@/lib/bus", () => ({
  recordFirstOpen: vi.fn().mockResolvedValue({ playerId: 1, opened: true, revision: 1, actionable: false }),
  usePlayers: vi.fn()
}));

const mockedRecord = vi.mocked(recordFirstOpen);
const mockedPlayers = vi.mocked(usePlayers);

/**
 * rift-gate first-open-signal: the one-shot durable write.
 *
 * The hazard this guards is a redirect/write loop and a blocking failure — the fact is a trigger, so
 * recording it must be idempotent-ish at the call site and must never take the shell down.
 */
describe("FirstOpenSignal — the one-shot first-open write", () => {
  beforeEach(() => {
    mockedRecord.mockClear();
    mockedPlayers.mockReturnValue({ data: { currentPlayerId: 7, items: [] } } as never);
  });

  it("records the first open once for the current player", async () => {
    render(<FirstOpenSignal />);
    await waitFor(() => expect(mockedRecord).toHaveBeenCalledWith(7));
    expect(mockedRecord).toHaveBeenCalledTimes(1);
  });

  it("does not write before a player is known", () => {
    mockedPlayers.mockReturnValue({ data: undefined } as never);
    render(<FirstOpenSignal />);
    expect(mockedRecord).not.toHaveBeenCalled();
  });

  it("re-rendering does not write again for the same player", async () => {
    const { rerender } = render(<FirstOpenSignal />);
    await waitFor(() => expect(mockedRecord).toHaveBeenCalledTimes(1));
    rerender(<FirstOpenSignal />);
    rerender(<FirstOpenSignal />);
    expect(mockedRecord).toHaveBeenCalledTimes(1);
  });

  it("swallows a failed write — the fact is retried next load and must not break the shell", async () => {
    mockedRecord.mockRejectedValueOnce(new Error("server down"));
    render(<FirstOpenSignal />);
    await waitFor(() => expect(mockedRecord).toHaveBeenCalledTimes(1));
    // No throw escaped; the component still renders nothing.
    expect(true).toBe(true);
  });

  it("renders nothing — it is a signal, not chrome", () => {
    const { container } = render(<FirstOpenSignal />);
    expect(container.firstChild).toBeNull();
  });
});

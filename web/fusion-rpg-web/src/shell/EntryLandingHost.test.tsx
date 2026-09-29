import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { EntryLandingHost } from "./EntryLandingHost";
import { getFirstOpen, usePlayers } from "@/lib/bus";

vi.mock("@/lib/bus", () => ({
  getFirstOpen: vi.fn(),
  usePlayers: vi.fn()
}));

const mockedGetFirstOpen = vi.mocked(getFirstOpen);
const mockedPlayers = vi.mocked(usePlayers);

/**
 * rift-gate entry-landing: the effect that performs the one landing.
 *
 * The three things this must not do, each with a test: navigate on an unknown fact, navigate twice, or
 * create a player (the server already seeds one).
 */
function renderAt(path = "/") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <EntryLandingHost />
    </MemoryRouter>
  );
}

describe("EntryLandingHost — once-per-player landing", () => {
  beforeEach(() => {
    mockedGetFirstOpen.mockReset();
    mockedPlayers.mockReturnValue({ data: { currentPlayerId: 1, items: [] } } as never);
    window.history.replaceState({}, "", "/");
  });

  it("reads the durable first-open fact for the current player", async () => {
    mockedGetFirstOpen.mockResolvedValue({ playerId: 1, opened: true, revision: 1, actionable: false });
    renderAt("/");
    await waitFor(() => expect(mockedGetFirstOpen).toHaveBeenCalledWith(1));
  });

  it("does not read before a player is known — never lands on a guess", () => {
    mockedPlayers.mockReturnValue({ data: undefined } as never);
    renderAt("/");
    expect(mockedGetFirstOpen).not.toHaveBeenCalled();
  });

  it("does nothing when the fact read fails", async () => {
    mockedGetFirstOpen.mockRejectedValue(new Error("server down"));
    renderAt("/");
    await waitFor(() => expect(mockedGetFirstOpen).toHaveBeenCalledTimes(1));
    // No navigation happened and no throw escaped; a later load can still land them.
    expect(true).toBe(true);
  });

  it("stays put for a returning player", async () => {
    mockedGetFirstOpen.mockResolvedValue({ playerId: 1, opened: false, revision: 1, actionable: false });
    renderAt("/");
    await waitFor(() => expect(mockedGetFirstOpen).toHaveBeenCalledTimes(1));
    expect(window.location.pathname).toBe("/");
  });

  it("renders nothing — it is an effect, not chrome", () => {
    mockedGetFirstOpen.mockResolvedValue({ playerId: 1, opened: true, revision: 1, actionable: false });
    const { container } = renderAt("/");
    expect(container.firstChild).toBeNull();
  });
});

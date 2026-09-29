import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { PlaybackPanel } from "./PlaybackPanel";

function wrapper(client: QueryClient) {
  return function W({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const REPORT = {
  worldId: "w",
  turn: 0,
  phases: ["Movement", "Growth"],
  entries: [
    { phase: "Movement", kind: "event", subject: "e-1", detail: "arrival:homeworld", sectorId: "homeworld" }
  ],
  dropped: []
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("PlaybackPanel — hosting the already-built rail/transport against a real report", () => {
  it("folds the fetched report and lets the transport step through it", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => REPORT });
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const user = userEvent.setup();

    render(<PlaybackPanel worldId="w" turn={0} />, { wrapper: wrapper(client) });

    await waitFor(() => expect(screen.getByTestId("playback-rail")).toBeInTheDocument());
    expect(screen.getByTestId("playback-phase-Growth")).toHaveTextContent("Nothing grew this night.");
    expect(screen.getByTestId("playback-transport-position")).toHaveTextContent("1 / 1");

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/world/w/turn/0");

    await user.click(screen.getByTestId("playback-transport-forward"));
    // Only one keyframe exists, so stepping forward stays clamped at it.
    expect(screen.getByTestId("playback-transport-position")).toHaveTextContent("1 / 1");
  });

  it("renders the empty state for a negative turn (nothing has completed yet)", () => {
    vi.stubGlobal("fetch", vi.fn());
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(<PlaybackPanel worldId="w" turn={-1} />, { wrapper: wrapper(client) });

    expect(screen.getByTestId("playback-rail-empty")).toBeInTheDocument();
  });
});

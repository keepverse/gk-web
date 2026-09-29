import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import type { PendingOrder } from "@/stages/world/worldSelection";
import { TurnCluster } from "./TurnCluster";
import { FORCE_END_KEYBOARD_BLOCKED_REASON } from "./forceEnd";
import { TEN_LEGIONS } from "./fixtures/legions";

function wrapper(client: QueryClient) {
  return function W({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("The force-end hatch — reachable by pointer (world-stage W83)", () => {
  it("ends the turn from a hard-blocked state using the pointer alone", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, reason: "", advanced: true, stateHash: "h", currentTurn: 4 })
    });
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const user = userEvent.setup();
    const navigate = vi.fn();

    render(
      <TurnCluster
        worldId="w"
        currentTurn={3}
        commanderId="dave"
        legions={TEN_LEGIONS}
        pending={[]}
        onOrdersFiled={() => {}}
        blockers={[{ sentence: "A siege is still resolving at ember-hollow", navigate }]}
      />,
      { wrapper: wrapper(client) }
    );

    const hatch = screen.getByTestId("turn-cluster-force-end");
    expect(hatch).toHaveTextContent("End anyway");
    // The reason it has no keyboard binding lives on the control itself, not only in a code comment.
    expect(hatch).toHaveAttribute("title", FORCE_END_KEYBOARD_BLOCKED_REASON);

    await user.click(hatch);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/world/w/commit");
    // "Take me there" is untouched — the hatch is a second, separate control, not a relabel of it.
    expect(navigate).not.toHaveBeenCalled();
  });

  it("file-orders renders an acknowledged-but-not-filed state between the click and the response", async () => {
    let resolveFetch!: (value: unknown) => void;
    const fetchMock = vi.fn().mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const user = userEvent.setup();

    render(
      <TurnCluster
        worldId="w"
        currentTurn={3}
        commanderId="dave"
        legions={TEN_LEGIONS}
        pending={[{ commandId: "c-e-1", kind: "stand-fast", entityId: "e-1", label: "stand fast" }]}
        onOrdersFiled={() => {}}
      />,
      { wrapper: wrapper(client) }
    );

    await user.click(screen.getByTestId("turn-cluster-file-orders"));

    // Acknowledged instantly — before the server has said anything at all.
    expect(screen.getByTestId("turn-cluster-file-orders-acknowledged")).toHaveTextContent("Filing 1 order…");
    expect(screen.queryByTestId("turn-cluster-file-orders")).not.toBeInTheDocument();

    resolveFetch({ ok: true, json: async () => ({ turn: 3, commanderId: "dave", results: [] }) });
    await waitFor(() =>
      expect(screen.queryByTestId("turn-cluster-file-orders-acknowledged")).not.toBeInTheDocument()
    );
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import type { PendingOrder } from "@/stages/world/worldSelection";
import { TurnCluster } from "./TurnCluster";
import { TEN_LEGIONS } from "./fixtures/legions";

function wrapper(client: QueryClient) {
  return function W({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const orderFor = (entityId: string): PendingOrder => ({
  commandId: "c-" + entityId,
  kind: "stand-fast",
  entityId,
  label: "stand fast"
});

/** Every legion in the fixture named as having filed an order — the Ready state's own fixture. */
const ALL_ORDERED = TEN_LEGIONS.map((l) => orderFor(l.entityId));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("TurnCluster — the four End Turn states (world-stage W79, spec-world-turn.md §1)", () => {
  it("Ready: renders the noun phrase, never a bare digit, when nothing is unresolved", () => {
    vi.stubGlobal("fetch", vi.fn());
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });

    render(
      <TurnCluster
        worldId="w"
        currentTurn={3}
        commanderId="dave"
        legions={TEN_LEGIONS}
        pending={ALL_ORDERED}
        onOrdersFiled={() => {}}
      />,
      { wrapper: wrapper(client) }
    );

    const state = screen.getByTestId("turn-cluster-state");
    expect(state).toHaveAttribute("data-turn-state", "ready");
    expect(state).toHaveTextContent("0 legions waiting on you");
    expect(screen.getByRole("button", { name: "End turn" })).toBeInTheDocument();
  });

  it("Nag: names the count and relabels the button, and does not stop the player", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, reason: "", advanced: true, stateHash: "h", currentTurn: 4 })
    });
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const user = userEvent.setup();

    render(
      <TurnCluster
        worldId="w"
        currentTurn={3}
        commanderId="dave"
        legions={TEN_LEGIONS}
        pending={[]}
        onOrdersFiled={() => {}}
      />,
      { wrapper: wrapper(client) }
    );

    const state = screen.getByTestId("turn-cluster-state");
    expect(state).toHaveAttribute("data-turn-state", "nag");
    expect(state).toHaveTextContent("7 legions with moves left and no orders");

    const anyway = screen.getByRole("button", { name: "End turn anyway" });
    await user.click(anyway);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/world/w/commit");
  });

  it("Hard-blocked: the button navigates to the blocker and carries its own sentence", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const navigate = vi.fn();
    const user = userEvent.setup();

    render(
      <TurnCluster
        worldId="w"
        currentTurn={3}
        commanderId="dave"
        legions={TEN_LEGIONS}
        pending={ALL_ORDERED}
        onOrdersFiled={() => {}}
        blockers={[{ sentence: "A siege is still resolving at ember-hollow", navigate }]}
      />,
      { wrapper: wrapper(client) }
    );

    const state = screen.getByTestId("turn-cluster-state");
    expect(state).toHaveAttribute("data-turn-state", "hard-blocked");
    expect(state).toHaveTextContent("A siege is still resolving at ember-hollow");

    await user.click(screen.getByRole("button", { name: "Take me there" }));
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it("Committed — waiting: a commit whose response has advanced === false leaves the cluster waiting", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, reason: "", advanced: false, stateHash: null, currentTurn: 3 })
    });
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const user = userEvent.setup();

    render(
      <TurnCluster
        worldId="w"
        currentTurn={3}
        commanderId="dave"
        legions={TEN_LEGIONS}
        pending={ALL_ORDERED}
        onOrdersFiled={() => {}}
      />,
      { wrapper: wrapper(client) }
    );

    await user.click(screen.getByRole("button", { name: "End turn" }));

    const state = await screen.findByTestId("turn-cluster-state");
    expect(state).toHaveAttribute("data-turn-state", "committed");
    expect(state).toHaveTextContent("Waiting on other commanders");
    expect(state).toHaveTextContent("no deadline");
    // Never a local timer or an optimistic advance — the words never claim the turn moved.
    expect(state).not.toHaveTextContent("Turn 4");
  });

  it("files the pending queue as one batch through toRequests, then clears it", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ turn: 3, commanderId: "dave", results: [] })
    });
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const onOrdersFiled = vi.fn();
    const user = userEvent.setup();

    render(
      <TurnCluster
        worldId="w"
        currentTurn={3}
        commanderId="dave"
        legions={TEN_LEGIONS}
        pending={[orderFor("e-1")]}
        onOrdersFiled={onOrdersFiled}
      />,
      { wrapper: wrapper(client) }
    );

    await user.click(screen.getByRole("button", { name: "File 1 order" }));

    await waitFor(() => expect(onOrdersFiled).toHaveBeenCalledTimes(1));
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/world/w/commands");
  });
});

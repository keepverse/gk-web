import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { HubProvider } from "./hub-provider";
import { queryKeys } from "./keys";
import {
  clearLogEvents,
  getLawnMatchKey,
  getLawnMembershipRing,
  getLawnRecoveryState
} from "./log-store";

const handlers: Record<string, (...args: unknown[]) => void> = {};
const lifecycleHandlers: Record<string, () => void> = {};
const invokes: unknown[][] = [];

vi.mock("./hub", () => ({
  getHubConnection: () => ({
    on: (ev: string, fn: (...args: unknown[]) => void) => {
      handlers[ev] = fn;
    },
    off: () => undefined,
    start: async () => undefined,
    stop: async () => undefined,
    invoke: async (...args: unknown[]) => {
      invokes.push(args);
    },
    onreconnecting: (fn: () => void) => {
      lifecycleHandlers.reconnecting = fn;
    },
    onreconnected: (fn: () => void) => {
      lifecycleHandlers.reconnected = fn;
    },
    onclose: (fn: () => void) => {
      lifecycleHandlers.close = fn;
    }
  })
}));

function wrap(client: QueryClient) {
  return function W({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

afterEach(() => {
  vi.clearAllMocks();
  clearLogEvents();
  invokes.length = 0;
  for (const k of Object.keys(handlers)) delete handlers[k];
  for (const k of Object.keys(lifecycleHandlers)) delete lifecycleHandlers[k];
});

describe("hub-provider PvzStats", () => {
  it("PvzStatsUpdated_invalidates_pvzStats_and_channel_keys", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    render(
      <HubProvider>
        <div />
      </HubProvider>,
      { wrapper: wrap(client) }
    );
    await Promise.resolve();
    expect(handlers.PvzStatsUpdated).toBeTypeOf("function");
    handlers.PvzStatsUpdated!({ playerId: 7 });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.pvzStats(7) });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["pvzStats"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["pvzStatsChannel"] });
  });

  it("PvzActivityUpdated_invalidates_activity_keys", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    render(
      <HubProvider>
        <div />
      </HubProvider>,
      { wrapper: wrap(client) }
    );
    await Promise.resolve();
    handlers.PvzActivityUpdated!({ playerId: 4 });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.pvzActivity(4) });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["pvzActivity"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["pvzActivityFacts"] });
  });

  it("RpgProgressionUpdated_invalidates_progression_keys", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    render(
      <HubProvider>
        <div />
      </HubProvider>,
      { wrapper: wrap(client) }
    );
    await Promise.resolve();
    handlers.RpgProgressionUpdated!({ playerId: 9 });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.rpgProgressionSummary(9) });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.rpgProgressionStats(9) });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["rpgProgressionLedger", 9] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["rpgProgressionActors", 9] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["rpgProgressionActor", 9] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["rpgProgressionSummary"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["rpgProgressionStats"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["rpgProgressionActors"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["rpgProgressionLedger"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["rpgProgressionActor"] });
  });

  it("CommandersUpdated_invalidates_commanders_keys", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    render(
      <HubProvider>
        <div />
      </HubProvider>,
      { wrapper: wrap(client) }
    );
    await Promise.resolve();
    expect(handlers.CommandersUpdated).toBeTypeOf("function");
    handlers.CommandersUpdated!({ playerId: 3 });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.commanders(3) });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["commanders"] });
  });

  it("AlmanacTextUpdated_invalidates_almanac_progression_and_types", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    render(
      <HubProvider>
        <div />
      </HubProvider>,
      { wrapper: wrap(client) }
    );
    await Promise.resolve();
    expect(handlers.AlmanacTextUpdated).toBeTypeOf("function");
    handlers.AlmanacTextUpdated!({ side: "plant", typeId: 0, created: true, fieldCount: 3 });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["almanacDumps"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["rpgProgressionActors"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["rpgProgressionActor"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["rpgProgressionSummary"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["types"] });
  });

  it("LawnRecovery_ready_invalidates_binding_dependent_queries", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    render(
      <HubProvider>
        <div />
      </HubProvider>,
      { wrapper: wrap(client) }
    );
    await Promise.resolve();
    expect(handlers.LawnRecovery).toBeTypeOf("function");
    handlers.LawnRecovery!({ state: "ready", matchKey: "m1", snapshotId: 42 });
    expect(getLawnRecoveryState()).toMatchObject({ kind: "ready", matchKey: "m1", snapshotId: 42 });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["uniqueActor"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["uniqueActors"] });
  });

  it("reconnect marks the prior view stale and re-joins the web group", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <HubProvider>
        <div />
      </HubProvider>,
      { wrapper: wrap(client) }
    );
    await Promise.resolve();
    handlers.Event!({
      id: 1,
      t: "2026-01-01T00:00:00Z",
      game: "pvzrh-3.8.1",
      kind: "board.start",
      matchKey: "m1",
      payload: {}
    });
    handlers.Event!({
      id: 2,
      t: "2026-01-01T00:00:01Z",
      game: "pvzrh-3.8.1",
      kind: "plant.spawn",
      matchKey: "m1",
      payload: { ptr: "P1", type: 1 }
    });
    lifecycleHandlers.reconnecting!();
    expect(getLawnRecoveryState().kind).toBe("stale");
    lifecycleHandlers.reconnected!();
    await Promise.resolve();
    expect(invokes.some(([method, role]) => method === "Join" && role === "web")).toBe(true);
  });

  it("opens the next scope only after an authoritative terminal snapshot", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <HubProvider>
        <div />
      </HubProvider>,
      { wrapper: wrap(client) }
    );
    await Promise.resolve();
    handlers.Event!({
      id: 1,
      t: "2026-01-01T00:00:00Z",
      game: "pvzrh-3.8.1",
      kind: "board.start",
      matchKey: "m1",
      payload: {}
    });
    handlers.Event!({
      id: 2,
      t: "2026-01-01T00:00:01Z",
      game: "pvzrh-3.8.1",
      kind: "debug.snapshot",
      matchKey: "m1",
      payload: { match: { phase: "Idle", matchKey: "m1", bindings: [] } }
    });
    expect(getLawnRecoveryState().kind).toBe("empty");
    handlers.LawnRecovery!({ state: "ready", matchKey: "m1", snapshotId: 2 });
    expect(getLawnRecoveryState().kind).toBe("empty");
    handlers.Event!({
      id: 3,
      t: "2026-01-01T00:00:02Z",
      game: "pvzrh-3.8.1",
      kind: "board.start",
      matchKey: "m2",
      payload: {}
    });
    expect(getLawnMatchKey()).toBe("m2");
  });

  it("foreign recovery snapshot cannot change the isolated match scope", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <HubProvider>
        <div />
      </HubProvider>,
      { wrapper: wrap(client) }
    );
    await Promise.resolve();
    handlers.Event!({
      id: 1,
      t: "2026-01-01T00:00:00Z",
      game: "pvzrh-3.8.1",
      kind: "board.start",
      matchKey: "m1",
      payload: {}
    });
    handlers.Event!({
      id: 2,
      t: "2026-01-01T00:00:01Z",
      game: "pvzrh-3.8.1",
      kind: "plant.spawn",
      matchKey: "m1",
      payload: { ptr: "P1", type: 1 }
    });
    handlers.Event!({
      id: 3,
      t: "2026-01-01T00:00:02Z",
      game: "pvzrh-3.8.1",
      kind: "debug.snapshot",
      matchKey: "m2",
      payload: { match: { phase: "Idle", matchKey: "m2", bindings: [] } }
    });
    handlers.Event!({
      id: 4,
      t: "2026-01-01T00:00:03Z",
      game: "pvzrh-3.8.1",
      kind: "combat.hit",
      matchKey: "m1",
      payload: { ptr: "P1" }
    });
    expect(getLawnMembershipRing().some((event) => event.kind === "combat.hit")).toBe(false);
    expect(getLawnMatchKey()).toBe("m1");
    expect(getLawnRecoveryState().kind).not.toBe("empty");
    handlers.LawnRecovery!({ state: "empty", matchKey: "m2", snapshotId: 3 });
    expect(getLawnMatchKey()).toBe("m1");
    expect(getLawnRecoveryState().kind).not.toBe("empty");
  });
});

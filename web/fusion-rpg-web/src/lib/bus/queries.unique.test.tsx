import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { useUniqueActor, useUniqueActors, useUniqueEquipment } from "./queries";
import {
  useAwardUniqueActorXp,
  useClearUniqueEquipment,
  useCreateUniqueActor,
  useDeployUniqueActor,
  usePutUniqueEquipment,
  useRetireUniqueActor
} from "./mutations";
import { queryKeys } from "./keys";

function wrapper(client: QueryClient) {
  return function W({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useUniqueActor", () => {
  it("is disabled when instanceId empty", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useUniqueActor(""), { wrapper: wrapper(client) });
    expect(result.current.fetchStatus).toBe("idle");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("GETs unique actor and returns body", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        instanceId: "id/with space",
        playerId: 1,
        side: "plant",
        typeId: 3,
        phase: "ActiveBound",
        level: 2,
        xp: 10,
        revision: 1
      })
    });
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useUniqueActor("id/with space"), {
      wrapper: wrapper(client)
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      `/api/unique/actors/${encodeURIComponent("id/with space")}`
    );
    expect(result.current.data?.phase).toBe("ActiveBound");
    expect(result.current.data?.typeId).toBe(3);
  });

  it("returns null on 404", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({})
    });
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useUniqueActor("missing"), {
      wrapper: wrapper(client)
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });
});

describe("useUniqueActors roster", () => {
  it("is disabled when playerId <= 0", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useUniqueActors(0), { wrapper: wrapper(client) });
    expect(result.current.fetchStatus).toBe("idle");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lists actors for playerId", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        playerId: 1,
        items: [
          {
            instanceId: "a1",
            playerId: 1,
            side: "zombie",
            typeId: 0,
            phase: "Roster",
            level: 1,
            xp: 0,
            revision: 0
          }
        ]
      })
    });
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useUniqueActors(1), { wrapper: wrapper(client) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/unique/actors?playerId=1");
    expect(result.current.data?.items).toHaveLength(1);
  });
});

describe("unique actor mutations", () => {
  it("create posts and invalidates list", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        instanceId: "new1",
        playerId: 2,
        side: "plant",
        typeId: 1,
        phase: "Roster",
        level: 1,
        xp: 0,
        revision: 0
      })
    });
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useCreateUniqueActor(), { wrapper: wrapper(client) });
    await result.current.mutateAsync({ side: "plant", typeId: 1 });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/unique/actors");
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.uniqueActors(2) });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.uniqueActor("new1") });
  });

  it("deploy posts to instance path and can omit col/row", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        reason: "",
        queued: true,
        correlationId: "c1",
        actor: {
          instanceId: "a1",
          playerId: 1,
          side: "zombie",
          typeId: 0,
          phase: "Deploying",
          level: 1,
          xp: 0,
          revision: 1
        }
      })
    });
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { result } = renderHook(() => useDeployUniqueActor(), { wrapper: wrapper(client) });
    await result.current.mutateAsync({ instanceId: "a1", playerId: 1 });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/unique/actors/a1/deploy");
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.col).toBeUndefined();
    expect(body.row).toBeUndefined();
  });

  it("deploy surfaces 409 reason", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ ok: false, reason: "phase.activebound" })
    });
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { result } = renderHook(() => useDeployUniqueActor(), { wrapper: wrapper(client) });
    await expect(
      result.current.mutateAsync({ instanceId: "a1", playerId: 1 })
    ).rejects.toThrow("phase.activebound");
  });

  it("retire posts and invalidates", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        instanceId: "a1",
        playerId: 1,
        side: "zombie",
        typeId: 0,
        phase: "Retired",
        level: 1,
        xp: 0,
        revision: 2
      })
    });
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useRetireUniqueActor(), { wrapper: wrapper(client) });
    await result.current.mutateAsync({ instanceId: "a1", playerId: 1 });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/unique/actors/a1/retire");
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.uniqueActors(1) });
  });
});

describe("useUniqueEquipment", () => {
  it("is disabled when instanceId empty", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useUniqueEquipment(""), { wrapper: wrapper(client) });
    expect(result.current.fetchStatus).toBe("idle");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("GETs equipment for instance", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        instanceId: "a1",
        phase: "Roster",
        items: [{ slot: "weapon", itemId: "stub.atk_ring" }],
        modsJson: '{"grants":[]}'
      })
    });
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useUniqueEquipment("a1"), { wrapper: wrapper(client) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/unique/actors/a1/equipment");
    expect(result.current.data?.items[0]?.itemId).toBe("stub.atk_ring");
  });
});

describe("equipment + xp mutations", () => {
  it("put equipment PUTs slot and invalidates", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        instanceId: "a1",
        phase: "Roster",
        items: [{ slot: "weapon", itemId: "stub.atk_ring" }],
        modsJson: "{}"
      })
    });
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => usePutUniqueEquipment(), { wrapper: wrapper(client) });
    await result.current.mutateAsync({
      instanceId: "a1",
      slot: "weapon",
      itemId: "stub.atk_ring",
      playerId: 1
    });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "/api/unique/actors/a1/equipment/weapon"
    );
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("PUT");
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      itemId: "stub.atk_ring"
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.uniqueEquipment("a1") });
  });

  it("put equipment surfaces phase.not_roster on 409", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ ok: false, reason: "phase.not_roster" })
    });
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { result } = renderHook(() => usePutUniqueEquipment(), { wrapper: wrapper(client) });
    await expect(
      result.current.mutateAsync({
        instanceId: "a1",
        slot: "armor",
        itemId: "stub.hp_charm",
        playerId: 1
      })
    ).rejects.toThrow("phase.not_roster");
  });

  it("put equipment surfaces unknown_item on 400", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ ok: false, reason: "unknown_item" })
    });
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { result } = renderHook(() => usePutUniqueEquipment(), { wrapper: wrapper(client) });
    await expect(
      result.current.mutateAsync({
        instanceId: "a1",
        slot: "weapon",
        itemId: "stub.nope",
        playerId: 1
      })
    ).rejects.toThrow("unknown_item");
  });

  it("clear equipment DELETEs slot without body and invalidates", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        instanceId: "a1",
        phase: "Roster",
        items: [],
        modsJson: "{}"
      })
    });
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useClearUniqueEquipment(), { wrapper: wrapper(client) });
    await result.current.mutateAsync({ instanceId: "a1", slot: "trinket", playerId: 1 });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "/api/unique/actors/a1/equipment/trinket"
    );
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("DELETE");
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBeUndefined();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.uniqueEquipment("a1") });
  });

  it("award xp posts body and invalidates list", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        instanceId: "a1",
        playerId: 1,
        side: "plant",
        typeId: 1,
        phase: "Roster",
        level: 2,
        xp: 50,
        revision: 3
      })
    });
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useAwardUniqueActorXp(), { wrapper: wrapper(client) });
    await result.current.mutateAsync({
      instanceId: "a1",
      delta: 150,
      reason: "roster-fe",
      playerId: 1
    });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/unique/actors/a1/xp");
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      delta: 150,
      reason: "roster-fe"
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.uniqueActors(1) });
  });

  it("award xp surfaces phase.retired on 409", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ ok: false, reason: "phase.retired" })
    });
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { result } = renderHook(() => useAwardUniqueActorXp(), { wrapper: wrapper(client) });
    await expect(
      result.current.mutateAsync({ instanceId: "a1", delta: 10, playerId: 1 })
    ).rejects.toThrow("phase.retired");
  });
});

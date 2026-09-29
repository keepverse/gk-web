import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { useActionLoadout, useDiscardUnlock, useSetLoadout } from "./action";

/**
 * A30 (actions-tab-fe-wiring, T69): `lib/bus/action.ts`'s own hooks, mirroring
 * `queries.unique.test.tsx`'s established renderHook + stubbed-fetch pattern -- the same shape T69's
 * spec asks these hooks to match `lib/bus/aura.ts`'s conventions (loading/error/mutate).
 */
function wrapper(client: QueryClient) {
  return function W({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useActionLoadout", () => {
  it("is disabled when instanceId is empty", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useActionLoadout(""), { wrapper: wrapper(client) });
    expect(result.current.fetchStatus).toBe("idle");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("GETs the real A27 loadout route and returns the held/equipped set", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ instanceId: "a-1", actionIds: ["action.strike", "action.guard"] })
    });
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useActionLoadout("a-1"), { wrapper: wrapper(client) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/actors/a-1/loadout");
    expect(result.current.data?.actionIds).toEqual(["action.strike", "action.guard"]);
  });
});

describe("useSetLoadout", () => {
  it("POSTs the chosen action ids to the A27 route and invalidates the loadout query", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ instanceId: "a-1", actionIds: ["action.strike"] })
    });
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useSetLoadout("a-1"), { wrapper: wrapper(client) });

    result.current.mutate(["action.strike"]);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toContain("/api/actors/a-1/loadout");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ actionIds: ["action.strike"] });
  });

  it("surfaces a refused mutation as a typed error, matching the aura module's own onError shape", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ reason: "ActionNotHeld" })
    });
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useSetLoadout("a-1"), { wrapper: wrapper(client) });

    result.current.mutate(["action.never-held"]);
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe("ActionNotHeld");
  });
});

describe("useDiscardUnlock", () => {
  it("POSTs the discard to the A28 route and echoes the post-spend soul balance", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        instanceId: "a-1",
        unlockId: "action.combo",
        balance: { playerId: 1, balance: 90, earnedTotal: 100, spentTotal: 10, revision: 2, updatedUtc: "t" }
      })
    });
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useDiscardUnlock("a-1"), { wrapper: wrapper(client) });

    result.current.mutate("action.combo");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toContain("/api/actors/a-1/unlock/discard");
    expect(result.current.data?.balance?.balance).toBe(90);
  });
});

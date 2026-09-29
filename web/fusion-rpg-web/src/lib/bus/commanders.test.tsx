import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { useCommanders, useSetDefaultCommander } from "./commanders";
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

describe("useCommanders", () => {
  it("is disabled when playerId is zero", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useCommanders(0), { wrapper: wrapper(client) });
    expect(result.current.fetchStatus).toBe("idle");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("GETs commander list and adapts rows", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        defaultLawnCommanderId: "commander:dave",
        commanders: [
          {
            id: "commander:dave",
            displayName: "Crazy Dave",
            isDefault: true,
            activeAuraId: "Might",
            activeAuraName: "Might",
            locationStub: null,
            legionStub: null
          }
        ]
      })
    });
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useCommanders(1), { wrapper: wrapper(client) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/commanders/1");
    expect(result.current.data?.defaultLawnCommanderId).toBe("commander:dave");
    expect(result.current.data?.commanders[0]?.displayName).toBe("Crazy Dave");
    expect(result.current.data?.commanders[0]?.activeAuraId).toBe("Might");
  });
});

describe("useSetDefaultCommander", () => {
  it("POSTs default and invalidates the commander list query", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ defaultLawnCommanderId: "commander:penny" })
    });
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useSetDefaultCommander(1), { wrapper: wrapper(client) });
    await result.current.mutateAsync("commander:penny");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/commanders/default");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({ playerId: 1, commanderId: "commander:penny" })
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.commanders(1) });
  });
});

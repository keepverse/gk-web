import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { useToastStack } from "@/shell/toastStack";
import { useExpeditionReturnWatcher } from "./expeditionReturnWatcher";

function wrapper(client: QueryClient) {
  return function W({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function listPayload(serverUtc: string, items: { id: number; state: string; dueUtc: string }[]) {
  return {
    serverUtc,
    tiers: [],
    items: items.map((i) => ({ ...i, tierId: "scout-30m", squadInstanceIds: [], dispatchedUtc: serverUtc }))
  };
}

beforeEach(() => {
  useToastStack.setState({ toasts: [] });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useExpeditionReturnWatcher (T17)", () => {
  it("counts an expedition as returned once its dueUtc has passed, not before", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () =>
        listPayload("2026-01-01T12:00:00Z", [
          { id: 1, state: "Dispatched", dueUtc: "2026-01-01T10:00:00Z" }, // due
          { id: 2, state: "Dispatched", dueUtc: "2026-01-01T14:00:00Z" } // not due yet
        ])
    });
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient();
    const { result } = renderHook(() => useExpeditionReturnWatcher(1), { wrapper: wrapper(client) });
    await waitFor(() => expect(result.current.returnedCount).toBe(1));
  });

  it("does not toast for expeditions already returned before this session started", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => listPayload("2026-01-01T12:00:00Z", [{ id: 1, state: "Dispatched", dueUtc: "2026-01-01T10:00:00Z" }])
    });
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient();
    const { result } = renderHook(() => useExpeditionReturnWatcher(1), { wrapper: wrapper(client) });
    await waitFor(() => expect(result.current.returnedCount).toBe(1));
    expect(useToastStack.getState().toasts).toHaveLength(0);
  });

  it("toasts exactly once for an expedition that newly returns after the first observation", async () => {
    // A mutable flag the test flips explicitly, rather than an internal call counter — react-query's
    // default staleTime (0) means an extra implicit fetch can legitimately race a test-driven
    // refetchQueries() call, so ordering must be controlled by content, not by call count.
    let due = false;
    const fetchMock = vi.fn().mockImplementation(async () => {
      const payload = due
        ? listPayload("2026-01-01T15:00:00Z", [{ id: 1, state: "Dispatched", dueUtc: "2026-01-01T14:00:00Z" }])
        : listPayload("2026-01-01T12:00:00Z", [{ id: 1, state: "Dispatched", dueUtc: "2026-01-01T14:00:00Z" }]);
      return { ok: true, json: async () => payload };
    });
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient();
    const { result } = renderHook(() => useExpeditionReturnWatcher(1), { wrapper: wrapper(client) });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    // Settle on the not-due state before flipping — every poll up to here must have seen `due`
    // false, so there's nothing yet for the watcher to announce.
    await waitFor(() => expect(result.current.returnedCount).toBe(0));
    expect(useToastStack.getState().toasts).toHaveLength(0);

    due = true;
    await client.refetchQueries({ queryKey: ["expeditions", 1] });
    await waitFor(() => expect(result.current.returnedCount).toBe(1));
    await waitFor(() => expect(useToastStack.getState().toasts).toHaveLength(1));
    expect(useToastStack.getState().toasts[0]!.title).toBe("Expedition returned");

    // A further poll with the same (now-due) data must not toast again.
    await client.refetchQueries({ queryKey: ["expeditions", 1] });
    await waitFor(() => expect(result.current.returnedCount).toBe(1));
    expect(useToastStack.getState().toasts).toHaveLength(1);
  });
});

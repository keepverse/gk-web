import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { resetNotificationFeedForTests, useNotificationFeed } from "@/shell/notify/feed/feedStore";

const handlers: Record<string, (...args: unknown[]) => void> = {};
const offSpy = vi.fn();

vi.mock("./hub", () => ({
  getHubConnection: () => ({
    on: (ev: string, fn: (...args: unknown[]) => void) => {
      handlers[ev] = fn;
    },
    off: (...args: unknown[]) => offSpy(...args)
  })
}));

import {
  fetchNotificationsSince,
  nextHistoryPageParam,
  subscribeNotificationBatch,
  subscribeNotificationStateChanged,
  useNotificationHistory,
  useSetNotificationState
} from "./notifications";

function wrapper(client: QueryClient) {
  return function W({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client }, children);
  };
}

function client() {
  return new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
}

function okFetch(body: unknown) {
  return vi.fn().mockResolvedValue({ ok: true, json: async () => body });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  for (const k of Object.keys(handlers)) delete handlers[k];
  resetNotificationFeedForTests();
});

describe("subscribeNotificationBatch / subscribeNotificationStateChanged", () => {
  it("registers on the hub connection and the unsubscribe calls off with the same handler", () => {
    const seen: unknown[] = [];
    const unsub = subscribeNotificationBatch((b) => seen.push(b));
    expect(handlers.NotificationBatch).toBeTypeOf("function");
    handlers.NotificationBatch!({ playerId: 1, delivery: "live", items: [] });
    expect(seen).toHaveLength(1);
    unsub();
    expect(offSpy).toHaveBeenCalledWith("NotificationBatch", expect.any(Function));
  });

  it("subscribeNotificationStateChanged wires NotificationStateChanged", () => {
    const seen: unknown[] = [];
    subscribeNotificationStateChanged((e) => seen.push(e));
    handlers.NotificationStateChanged!({ playerId: 1, state: "read", changes: [] });
    expect(seen).toHaveLength(1);
  });
});

describe("fetchNotificationsSince — pages until hasMore is false", () => {
  it("concatenates every page and returns the final cursor", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [{ seq: 1, rev: 1 }], nextSince: 1, hasMore: true })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [{ seq: 2, rev: 2 }], nextSince: 2, hasMore: false })
      });
    vi.stubGlobal("fetch", fetchMock);

    const page = await fetchNotificationsSince(7, 0);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]![0]).toContain("/api/notifications/7?since=0");
    expect(fetchMock.mock.calls[1]![0]).toContain("since=1");
    expect(page.items.map((i: { seq: number }) => i.seq)).toEqual([1, 2]);
    expect(page.nextSince).toBe(2);
    expect(page.hasMore).toBe(false);
  });

  it("a single non-paged response with hasMore false stops after one call", async () => {
    vi.stubGlobal("fetch", okFetch({ items: [], nextSince: 5, hasMore: false }));
    const page = await fetchNotificationsSince(7, 5);
    expect(page.items).toHaveLength(0);
    expect(page.nextSince).toBe(5);
  });
});

describe("useSetNotificationState", () => {
  it("posts seqs and state to the save's state endpoint", async () => {
    const fetchMock = okFetch({ changed: [{ seq: 1, rev: 2 }] });
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useSetNotificationState(), { wrapper: wrapper(client()) });

    await result.current.mutateAsync({ playerId: 7, seqs: [1], state: "read" });

    expect(fetchMock.mock.calls[0]![0]).toContain("/api/notifications/7/state");
    expect(fetchMock.mock.calls[0]![1].method).toBe("POST");
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body as string)).toEqual({ seqs: [1], state: "read" });
  });

  it("on success, applies the change to the notification feed (F6, same path as F5)", async () => {
    useNotificationFeed.getState().resetForPlayer(7);
    useNotificationFeed.getState().applyItems(
      [
        {
          seq: 1,
          rev: 1,
          dedupKey: "k1",
          category: "c",
          severity: "routine",
          sourceId: "s",
          messageKey: "m",
          args: [],
          state: "unread",
          createdUtc: "2026-01-01T00:00:00Z"
        }
      ],
      7
    );
    vi.stubGlobal("fetch", okFetch({ changed: [{ seq: 1, rev: 2 }] }));
    const { result } = renderHook(() => useSetNotificationState(), { wrapper: wrapper(client()) });

    await result.current.mutateAsync({ playerId: 7, seqs: [1], state: "dismissed" });

    expect(useNotificationFeed.getState().byKey.k1!.state).toBe("dismissed");
    expect(useNotificationFeed.getState().byKey.k1!.rev).toBe(2);
  });
});

function historyPage(seqs: number[], hasMore: boolean) {
  return {
    items: seqs.map((seq) => ({
      seq,
      rev: seq,
      dedupKey: `k${seq}`,
      category: "growth",
      severity: "routine",
      sourceId: "s",
      messageKey: "m",
      args: [],
      state: "unread",
      createdUtc: "2026-01-01T00:00:00Z"
    })),
    nextSince: seqs.length > 0 ? seqs[seqs.length - 1] : 0,
    hasMore
  };
}

describe("useNotificationHistory (notify-centre spec §2 step 4)", () => {
  it("pages GET …/history?category=…, no before on the first page", async () => {
    const fetchMock = okFetch(historyPage([10, 9, 8], false));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useNotificationHistory(7, "growth"), { wrapper: wrapper(client()) });

    await waitFor(() => expect(result.current.status).toBe("success"));

    expect(fetchMock.mock.calls[0]![0]).toContain("/api/notifications/7/history?category=growth");
    expect(fetchMock.mock.calls[0]![0]).not.toContain("before=");
  });

  it("load-older (fetchNextPage) passes the last item's seq as before", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => historyPage([10, 9, 8], true) })
      .mockResolvedValueOnce({ ok: true, json: async () => historyPage([7, 6], false) });
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useNotificationHistory(7, "growth"), { wrapper: wrapper(client()) });
    await waitFor(() => expect(result.current.status).toBe("success"));

    void result.current.fetchNextPage();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    expect(fetchMock.mock.calls[1]![0]).toContain("before=8"); // 8 is the last (oldest-so-far) seq of page 1
  });

  it("nextHistoryPageParam: hasMore true yields the last item's seq, hasMore false yields undefined", () => {
    expect(nextHistoryPageParam(historyPage([10, 9, 8], true))).toBe(8);
    expect(nextHistoryPageParam(historyPage([7, 6], false))).toBeUndefined();
    expect(nextHistoryPageParam(historyPage([], true))).toBeUndefined(); // no items -> no cursor to continue from
  });

  it("a failed page surfaces the error state (GG-17)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }));
    const { result } = renderHook(() => useNotificationHistory(7, "growth"), { wrapper: wrapper(client()) });

    await waitFor(() => expect(result.current.status).toBe("error"));
  });

  it("never fetches before a player is shown (playerId null)", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderHook(() => useNotificationHistory(null, "growth"), { wrapper: wrapper(client()) });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

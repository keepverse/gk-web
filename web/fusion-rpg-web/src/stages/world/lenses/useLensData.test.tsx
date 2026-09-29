import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import type { WorldStateDto } from "@/lib/bus/world";
import fixture from "@/stages/world/fixtures/first-light.json";
import { useLensData } from "./useLensData";

function wrapper(client: QueryClient) {
  return function W({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

/** Same byte-pinned real fixture `adaptWorld.test.ts` exercises against — `useLensData` only ever
 * sees `query.data` through inference (never names `WorldStateDto`, per `contractGuard.ts`), but
 * this test file is exempt from that guard, so it can build fixtures directly. The first sector's
 * id is the one distinguishing marker mutated per variant below, since `AdaptedWorldState` carries
 * no `currentTurn` of its own — only sectors/lanes survive the adapter. */
function stateWithFirstSectorId(id: string): WorldStateDto {
  const base = fixture as WorldStateDto;
  return { ...base, sectors: base.sectors.map((s, i) => (i === 0 ? { ...s, sectorId: id } : s)) };
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useLensData (world-stage W97, spec-world-lenses.md)", () => {
  it("selecting lens 4 changes the query and issues a request carrying ?lifelines=true", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => stateWithFirstSectorId("ownership-sector") });
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 5_000 } } });

    const { result, rerender } = renderHook(({ lens }: { lens: "ownership" | "supply" }) => useLensData("w", lens), {
      wrapper: wrapper(client),
      initialProps: { lens: "ownership" }
    });
    await waitFor(() => expect(result.current.displayed).toBeDefined());
    expect(String(fetchMock.mock.calls[0]?.[0])).not.toContain("lifelines");

    rerender({ lens: "supply" });
    await waitFor(() => expect(fetchMock.mock.calls.length).toBe(2));
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("lifelines=true");
  });

  it("the map keeps drawing the previous lens for the whole in-flight window — the canvas is never empty", async () => {
    const supplyDeferred = deferred<{ ok: true; json: () => Promise<WorldStateDto> }>();
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("lifelines")) return supplyDeferred.promise;
      return Promise.resolve({ ok: true, json: async () => stateWithFirstSectorId("ownership-sector") });
    });
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 5_000 } } });

    const { result, rerender } = renderHook(({ lens }: { lens: "ownership" | "supply" }) => useLensData("w", lens), {
      wrapper: wrapper(client),
      initialProps: { lens: "ownership" }
    });
    await waitFor(() => expect(result.current.displayed?.sectors[0]?.sectorId).toBe("ownership-sector"));

    rerender({ lens: "supply" });
    await waitFor(() => expect(result.current.isLensFourLoading).toBe(true));
    // Still drawing the old lens's data — never undefined mid-fetch.
    expect(result.current.displayed?.sectors[0]?.sectorId).toBe("ownership-sector");

    supplyDeferred.resolve({ ok: true, json: async () => stateWithFirstSectorId("supply-sector") });
    await waitFor(() => expect(result.current.displayed?.sectors[0]?.sectorId).toBe("supply-sector"));
    expect(result.current.isLensFourLoading).toBe(false);
  });

  it("leaving lens 4 and returning within staleTime issues no second request", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) =>
      Promise.resolve({
        ok: true,
        json: async () => stateWithFirstSectorId(String(url).includes("lifelines") ? "supply-sector" : "ownership-sector")
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 5_000 } } });

    const { result, rerender } = renderHook(
      ({ lens }: { lens: "ownership" | "supply" | "danger" }) => useLensData("w", lens),
      { wrapper: wrapper(client), initialProps: { lens: "ownership" } }
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    rerender({ lens: "supply" });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    // "danger" carries the same `lifelines: false` query key as "ownership" — no lens outside
    // lens 4 ever forces its own cache entry, so this reuses ownership's already-fresh fetch.
    rerender({ lens: "danger" });
    await waitFor(() => expect(result.current.displayed?.sectors[0]?.sectorId).toBe("ownership-sector"));
    expect(fetchMock).toHaveBeenCalledTimes(2);

    rerender({ lens: "supply" });
    await waitFor(() => expect(result.current.displayed?.sectors[0]?.sectorId).toBe("supply-sector"));
    expect(fetchMock).toHaveBeenCalledTimes(2); // no new request — lens 4's own entry is still fresh
  });

  it("the other five lenses carry no loading state, even while their own fetch is in flight", async () => {
    const ownershipDeferred = deferred<{ ok: true; json: () => Promise<WorldStateDto> }>();
    const fetchMock = vi.fn().mockReturnValue(ownershipDeferred.promise);
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 5_000 } } });

    const { result } = renderHook(() => useLensData("w", "danger"), { wrapper: wrapper(client) });
    expect(result.current.isLensFourLoading).toBe(false);
    expect(result.current.displayed).toBeUndefined(); // no prior data exists yet — this is not lens 4's job to fix

    ownershipDeferred.resolve({ ok: true, json: async () => stateWithFirstSectorId("ownership-sector") });
    await waitFor(() => expect(result.current.displayed).toBeDefined());
    expect(result.current.isLensFourLoading).toBe(false);
  });
});

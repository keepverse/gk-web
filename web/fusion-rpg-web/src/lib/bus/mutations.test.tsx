import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  useCheatAction,
  useClearCheatField,
  useCreatePlayer,
  useDeleteArchives,
  useDeleteClosedRuns,
  usePurgeRunCapture,
  useResetSim,
  useSaveCheats,
  useSaveStats,
  useSelectPlayer,
  useSetCheatFloat,
  useSimCommand,
  useToggleCheat,
  useSeedPvzStatsDemo,
  useResetPvzStats,
  useWithdrawPvzStat,
  useSeedPvzActivityDemo,
  useSpawnExtraIntent,
  useLawnDebugPost,
  useSeedRpgProgressionDemo,
  useClearRpgDemotion,
  useTrimHotTails
} from "./mutations";
import {
  clearCheatFloatDirty,
  markCheatFloatDirty,
  mergeCheatsPreservingDirty
} from "./cheat-dirty";
import { emptyMod } from "./types";
import { queryKeys } from "./keys";
import { clearLogEvents, getLogEvents, appendLogEvent } from "./log-store";

function wrapper(client: QueryClient) {
  return function W({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  clearLogEvents();
});

describe("mutations", () => {
  it("saveStats puts then reloads", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { result } = renderHook(() => useSaveStats(), { wrapper: wrapper(client) });
    await result.current.mutateAsync({
      plants: emptyMod(),
      zombies: emptyMod(),
      logDamage: false,
      applyStats: true
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/stats");
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("/api/commands/reload-stats");
  });

  it("createPlayer and selectPlayer hit player routes", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const create = renderHook(() => useCreatePlayer(), { wrapper: wrapper(client) });
    await create.result.current.mutateAsync("Save");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/players");

    const select = renderHook(() => useSelectPlayer(), { wrapper: wrapper(client) });
    await select.result.current.mutateAsync(2);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("/api/players/current");
  });

  it("simCommand and resetSim invalidate and clear log", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    appendLogEvent({ t: "t", game: "g", kind: "board.start" });
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });

    const sim = renderHook(() => useSimCommand(), { wrapper: wrapper(client) });
    await sim.result.current.mutateAsync({ path: "/hello" });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/sim/hello");

    const invalidate = vi.spyOn(client, "invalidateQueries");
    const reset = renderHook(() => useResetSim(), { wrapper: wrapper(client) });
    await reset.result.current.mutateAsync();
    await waitFor(() => expect(getLogEvents()).toEqual([]));
    expect(String(fetchMock.mock.calls[fetchMock.mock.calls.length - 1]?.[0])).toContain("/api/test/reset");
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["pvzActivity"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["pvzActivityFacts"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["rpgProgressionSummary"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["rpgProgressionStats"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["rpgProgressionActors"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["rpgProgressionLedger"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["rpgProgressionActor"] });
  });

  it("cheat mutations hit /api/cheats routes", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });

    const save = renderHook(() => useSaveCheats(), { wrapper: wrapper(client) });
    await save.result.current.mutateAsync({ entries: [] });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/cheats");

    const tog = renderHook(() => useToggleCheat(), { wrapper: wrapper(client) });
    await tog.result.current.mutateAsync({ id: "P-GOD", enabled: true });
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("/api/cheats/toggle");

    const fl = renderHook(() => useSetCheatFloat(), { wrapper: wrapper(client) });
    await fl.result.current.mutateAsync({ id: "A-P-HP%", value: 2 });
    expect(String(fetchMock.mock.calls[2]?.[0])).toContain("/api/cheats/set-float");

    const act = renderHook(() => useCheatAction(), { wrapper: wrapper(client) });
    await act.result.current.mutateAsync({ action: "reapply" });
    expect(String(fetchMock.mock.calls[3]?.[0])).toContain("/api/cheats/action");
  });

  it("useClearCheatField_posts_and_removes_entry", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    client.setQueryData(["cheats"], {
      revision: 1,
      entries: [
        { id: "A-P-HP%", kind: "slider", enabled: true, floatValue: 3 },
        { id: "P-GOD", kind: "toggle", enabled: true, floatValue: 0 }
      ]
    });

    const { result } = renderHook(() => useClearCheatField(), { wrapper: wrapper(client) });
    await result.current.mutateAsync({ id: "A-P-HP%" });

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/cheats/clear-field");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "POST" });
  });

  it("useSeedPvzStatsDemo_posts_test_seed", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ playerId: 1, revision: 1, channels: [] }) });
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useSeedPvzStatsDemo(), { wrapper: wrapper(client) });
    await result.current.mutateAsync(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/test/seed-pvz-stats-demo");
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["pvzStats"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["pvzStatsChannel"] });
  });

  it("useResetPvzStats_posts_reset_and_invalidates", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ channels: [] }) });
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useResetPvzStats(), { wrapper: wrapper(client) });
    await result.current.mutateAsync(3);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/pvz-stats/3/modifiers/reset");
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["pvzStats", 3] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["pvzStatsChannel"] });
  });

  it("useWithdrawPvzStat_posts_withdraw_and_invalidates", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useWithdrawPvzStat(), { wrapper: wrapper(client) });
    await result.current.mutateAsync({ playerId: 2, sourceKind: "item", sourceId: "demo-curse" });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/pvz-stats/2/modifiers/withdraw");
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["pvzStats", 2] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["pvzStatsChannel"] });
  });

  it("useSeedPvzActivityDemo_posts_and_invalidates", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ playerId: 1, revision: 1 }) });
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useSeedPvzActivityDemo(), { wrapper: wrapper(client) });
    await result.current.mutateAsync(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/test/seed-pvz-activity-demo");
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["pvzActivity"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["pvzActivityFacts"] });
  });

  it("useSpawnExtraIntent_posts_intent_and_invalidates", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useSpawnExtraIntent(), { wrapper: wrapper(client) });
    await result.current.mutateAsync({
      typeId: 2,
      reason: "luck",
      row: 1,
      col: 3,
      side: "zombie"
    });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/pvz-intent/spawn-extra");
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body).toMatchObject({ typeId: 2, row: 1, col: 3, side: "zombie" });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["pvzActivity"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["pvzActivityFacts"] });
  });

  it("useLawnDebugPost_posts_debug_path", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { result } = renderHook(() => useLawnDebugPost(), { wrapper: wrapper(client) });
    await result.current.mutateAsync({ path: "kill", body: { target: "selected", ptr: "AB" } });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/debug/kill");
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body).toMatchObject({ target: "selected", ptr: "AB" });
  });

  it("useSeedRpgProgressionDemo_posts_and_invalidates", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ playerId: 1 }) });
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useSeedRpgProgressionDemo(), { wrapper: wrapper(client) });
    await result.current.mutateAsync(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/test/seed-rpg-progression-demo");
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["rpgProgressionSummary"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["rpgProgressionStats"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["rpgProgressionActors"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["rpgProgressionLedger"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["rpgProgressionActor"] });
  });

  it("useClearRpgDemotion_posts_and_invalidates", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ playerId: 1, kind: "player", typeId: 0, demotionCount: 0 })
    });
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useClearRpgDemotion(), { wrapper: wrapper(client) });
    await result.current.mutateAsync({ playerId: 1, kind: "player", typeId: 0 });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "/api/rpg/progression/1/player/0/clear-demotion"
    );
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.rpgProgressionSummary(1) });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["rpgProgressionActors", 1] });
  });

  it("storage mutations post and invalidate storage keys", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ deleted: 1, refused: 0, ok: true }) });
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidate = vi.spyOn(client, "invalidateQueries");

    const delArch = renderHook(() => useDeleteArchives(), { wrapper: wrapper(client) });
    await delArch.result.current.mutateAsync(["archive/a.sqlite"]);
    expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain("/api/storage/archives/delete");

    const purge = renderHook(() => usePurgeRunCapture(), { wrapper: wrapper(client) });
    await purge.result.current.mutateAsync([9]);
    expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain("/api/storage/runs/purge-capture");

    const delRuns = renderHook(() => useDeleteClosedRuns(), { wrapper: wrapper(client) });
    await delRuns.result.current.mutateAsync([9]);
    expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain("/api/storage/runs/delete");

    const trim = renderHook(() => useTrimHotTails(), { wrapper: wrapper(client) });
    await trim.result.current.mutateAsync();
    expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain("/api/storage/trim-tails");

    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.storageSummary });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.storageArchives });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.runs });
  });

  it("mergeCheatsPreservingDirty_keeps_dirty_float", () => {
    clearCheatFloatDirty();
    markCheatFloatDirty("A-P-HP%");
    const remote = {
      revision: 5,
      entries: [
        { id: "A-P-HP%", kind: "slider", enabled: true, floatValue: 1 },
        { id: "P-GOD", kind: "toggle", enabled: true, floatValue: 0 }
      ]
    };
    const local = {
      entries: [{ id: "A-P-HP%", kind: "slider", enabled: true, floatValue: 7 }]
    };
    const merged = mergeCheatsPreservingDirty(remote, local) as {
      entries: { id: string; floatValue?: number }[];
    };
    const hp = merged.entries.find((e) => e.id === "A-P-HP%");
    expect(hp?.floatValue).toBe(7);
    clearCheatFloatDirty();
  });
});

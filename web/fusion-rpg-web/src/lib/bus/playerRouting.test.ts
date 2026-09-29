import { afterEach, describe, expect, it, vi } from "vitest";
import { HubConnectionState, type HubConnection } from "@microsoft/signalr";

const getJsonMock = vi.fn();
vi.mock("./rest", () => ({
  getJson: (...args: unknown[]) => getJsonMock(...args)
}));

import { joinCurrentPlayer, joinShownPlayer, resetPlayerRoutingForTests, subscribePlayerJoined } from "./playerRouting";

function fakeConnection(
  joinResult: boolean | ((id: number) => boolean) = true,
  state: HubConnectionState = HubConnectionState.Connected
) {
  const invoke = vi.fn(async (_method: string, id: number) =>
    typeof joinResult === "function" ? joinResult(id) : joinResult
  );
  return { invoke, state } as unknown as HubConnection & { invoke: typeof invoke };
}

describe("playerRouting - T1/T2/T3/T5 (player-routing spec §2)", () => {
  afterEach(() => {
    resetPlayerRoutingForTests();
    getJsonMock.mockReset();
    vi.restoreAllMocks();
  });

  it("joinCurrentPlayer invokes JoinPlayer with the given id", async () => {
    const c = fakeConnection(true);
    const ok = await joinCurrentPlayer(c, 7);
    expect(ok).toBe(true);
    expect(c.invoke).toHaveBeenCalledWith("JoinPlayer", 7);
  });

  it("emits player-joined only when the server returns true", async () => {
    const seen: number[] = [];
    subscribePlayerJoined((id) => seen.push(id));

    await joinCurrentPlayer(fakeConnection(true), 3);
    expect(seen).toEqual([3]);
  });

  it("T5 - a refused id logs once and emits no player-joined", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const seen: number[] = [];
    subscribePlayerJoined((id) => seen.push(id));

    const ok = await joinCurrentPlayer(fakeConnection(false), 999);

    expect(ok).toBe(false);
    expect(seen).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("joinShownPlayer reads /api/players and joins the shown save (T1/T2)", async () => {
    getJsonMock.mockResolvedValue({ items: [], currentPlayerId: 42 });
    const c = fakeConnection(true);

    const ok = await joinShownPlayer(c);

    expect(ok).toBe(true);
    expect(getJsonMock).toHaveBeenCalledWith("/api/players");
    expect(c.invoke).toHaveBeenCalledWith("JoinPlayer", 42);
  });

  it("T2-then-T3 and T3-then-T2 both end on the shown save's id, regardless of order", async () => {
    const c = fakeConnection(true);

    // T2 (reconnect, id 1) then T3 (save switch, id 2)
    await joinCurrentPlayer(c, 1);
    await joinCurrentPlayer(c, 2);
    expect(c.invoke).toHaveBeenLastCalledWith("JoinPlayer", 2);

    // T3 (id 2) then T2 (reconnect, still id 2 - nothing switched in between)
    const c2 = fakeConnection(true);
    await joinCurrentPlayer(c2, 2);
    await joinCurrentPlayer(c2, 2);
    expect(c2.invoke).toHaveBeenLastCalledWith("JoinPlayer", 2);
  });

  it("never rejects on a disconnected connection (the regression: useSelectPlayer's onSuccess fires this fire-and-forget)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const c = fakeConnection(true, HubConnectionState.Disconnected);

    await expect(joinCurrentPlayer(c, 1)).resolves.toBe(false);
    expect(c.invoke).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("never rejects when invoke itself throws (e.g. a mid-send disconnect)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const c = fakeConnection(true);
    c.invoke.mockRejectedValueOnce(new Error("Cannot send data if the connection is not in the 'Connected' State."));

    await expect(joinCurrentPlayer(c, 1)).resolves.toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("a second session that did not switch keeps its own group (a separate connection is untouched)", async () => {
    const sessionA = fakeConnection(true);
    const sessionB = fakeConnection(true);

    await joinCurrentPlayer(sessionA, 1);
    await joinCurrentPlayer(sessionB, 2);
    // sessionA switches; sessionB never does
    await joinCurrentPlayer(sessionA, 3);

    expect(sessionA.invoke).toHaveBeenLastCalledWith("JoinPlayer", 3);
    expect(sessionB.invoke).toHaveBeenCalledTimes(1);
    expect(sessionB.invoke).toHaveBeenCalledWith("JoinPlayer", 2);
  });
});

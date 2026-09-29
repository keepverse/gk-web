import { afterEach, describe, expect, it, vi } from "vitest";
import { runAutoAssign } from "./runAutoAssign";

function okFetch(bodyJson: unknown) {
  return vi.fn().mockResolvedValue({ ok: true, json: async () => bodyJson });
}

function refusingFetch(reason: string) {
  return vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ reason }) });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * spec-assign-ladder.md (EP1.5, W1) -- `runAutoAssign` is now a thin caller of
 * `POST /api/aptitude-presets/suggest`. Testing strategy item 7: assert the route is called and
 * that no share arithmetic runs in the FE (the mirror's own unit tests, which computed shares by
 * hand, are removed with it -- see autoAssign.test.ts).
 */
describe("runAutoAssign", () => {
  const draftShares = {
    Might: 250,
    Fortitude: 0,
    Vigor: 0,
    Onslaught: 250,
    Agility: 250,
    Composure: 0,
    Pierce: 0,
    Focus: 0,
    Bulwark: 250,
    Retribution: 0,
    Precision: 0,
    Ferocity: 0
  };

  it("calls the route with scope/scopeKey/rule and applies draftShares verbatim -- never a computed share", async () => {
    const fetchMock = okFetch({
      ruleId: "posture-force",
      rows: [],
      skipped: [],
      draftShares,
      leftover: 0
    });
    vi.stubGlobal("fetch", fetchMock);

    const setValue = vi.fn();
    const result = await runAutoAssign({
      rule: "posture-force",
      mode: "unique",
      playerId: 7,
      scopeKey: "specimen-1",
      setValue
    });

    expect(result.ok).toBe(true);
    expect(result.shares).toEqual(draftShares);
    expect(result.leftover).toBe(0);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toContain("/api/aptitude-presets/suggest");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      playerId: 7,
      scope: "unique",
      scopeKey: "specimen-1",
      rule: "posture-force"
    });

    // Every id gets the response's own value verbatim, including the zeros -- pass-through, not
    // an FE re-derivation.
    for (const [id, value] of Object.entries(draftShares)) {
      expect(setValue).toHaveBeenCalledWith(id, value);
    }
  });

  it("species scope sends the speciesId as scopeKey, commander sends an empty scopeKey", async () => {
    const fetchMock = okFetch({ ruleId: "even", rows: [], skipped: [], draftShares: {}, leftover: 0 });
    vi.stubGlobal("fetch", fetchMock);

    await runAutoAssign({ rule: "even", mode: "species", playerId: 3, scopeKey: "fumeshroom", setValue: vi.fn() });
    await runAutoAssign({ rule: "even", mode: "commander", playerId: 3, scopeKey: null, setValue: vi.fn() });

    const bodies = fetchMock.mock.calls.map(([, init]: [string, RequestInit]) => JSON.parse(init.body as string));
    expect(bodies[0]).toMatchObject({ scope: "species", scopeKey: "fumeshroom" });
    expect(bodies[1]).toMatchObject({ scope: "commander", scopeKey: "" });
  });

  it("a refusal from the route surfaces the server's own named reason, unmodified", async () => {
    vi.stubGlobal("fetch", refusingFetch("autoAssign.favour.empty"));

    const result = await runAutoAssign({
      rule: "species-favour",
      mode: "species",
      playerId: 7,
      scopeKey: "no-plan-species",
      setValue: vi.fn()
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("autoAssign.favour.empty");
    expect(result.shares).toEqual({});
  });
});

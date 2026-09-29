import { afterEach, describe, expect, it, vi } from "vitest";
import { getJson, sendJson, tryGetJson } from "./rest";

describe("rest client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("getJson returns parsed JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true })
      })
    );
    await expect(getJson<{ ok: boolean }>("/health")).resolves.toEqual({ ok: true });
  });

  it("getJson throws on non-ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500
      })
    );
    await expect(getJson("/health")).rejects.toThrow("/health 500");
  });

  it("tryGetJson returns null on 404", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404
      })
    );
    await expect(tryGetJson("/api/sim/state")).resolves.toBeNull();
  });

  it("sendJson posts JSON body", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 1 })
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(sendJson("/api/players", "POST", { name: "A" })).resolves.toEqual({ id: 1 });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/players"),
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "A" })
      })
    );
  });

  it("sendJson throws Server reason on 409", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({ ok: false, reason: "phase.activebound" })
      })
    );
    await expect(
      sendJson("/api/unique/actors/a1/deploy", "POST", {})
    ).rejects.toThrow("phase.activebound");
  });

  it("sendJson falls back to path status when body empty", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error("no json");
        }
      })
    );
    await expect(sendJson("/api/x", "POST", {})).rejects.toThrow("/api/x 500");
  });
});

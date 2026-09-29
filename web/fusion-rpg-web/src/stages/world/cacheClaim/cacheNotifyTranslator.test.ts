import { describe, expect, it } from "vitest";
import { cacheNotifyTranslator } from "./cacheNotifyTranslator";
import { defaultFormatKit } from "@/shell/notify/format/kit";
import type { NotificationItem, NotifyArg } from "@/shell/notify/catalog";

function item(over: Partial<NotificationItem> & { messageKey: string; args: NotifyArg[] }): NotificationItem {
  return {
    seq: 1,
    rev: 1,
    dedupKey: "k1",
    category: "cache.created",
    severity: "routine",
    sourceId: "cache-notify-source",
    state: "unread",
    createdUtc: "2026-01-01T00:00:00Z",
    ...over
  };
}

describe("cacheNotifyTranslator (cache-notify-source spec §3)", () => {
  it("domain is corpse-cache", () => {
    expect(cacheNotifyTranslator.domain).toBe("corpse-cache");
  });

  it("cache.created over a lawn place uses fmt.count and the off-world place word", () => {
    const it1 = item({
      messageKey: "cache.created",
      args: [
        { name: "itemCount", kind: "count", value: 3 },
        { name: "place", kind: "domainToken", value: "lawn" }
      ]
    });
    const text = cacheNotifyTranslator.translate(it1, defaultFormatKit);
    expect(text).not.toBeNull();
    expect(text!.body).toContain("3");
    expect(text!.body).toContain("lawn battle");
    expect(text!.target).toBeUndefined();
  });

  it("cache.created over a world_sector place resolves the sector name and becomes the target", () => {
    const it1 = item({
      messageKey: "cache.created",
      args: [
        { name: "itemCount", kind: "count", value: 2 },
        { name: "place", kind: "ref", value: { refKind: "sector", id: "ember-hollow" } }
      ]
    });
    const text = cacheNotifyTranslator.translate(it1, defaultFormatKit);
    expect(text!.body).toContain("Ember Hollow");
    expect(text!.target).toEqual({ refKind: "sector", id: "ember-hollow" });
  });

  it("cache.created over a world_lane place renders Pending, never the raw lane id", () => {
    const it1 = item({
      messageKey: "cache.created",
      args: [
        { name: "itemCount", kind: "count", value: 1 },
        { name: "place", kind: "ref", value: { refKind: "lane", id: "l-home-ember" } }
      ]
    });
    const text = cacheNotifyTranslator.translate(it1, defaultFormatKit);
    expect(text!.body).toContain("Pending");
    expect(text!.body).not.toContain("l-home-ember");
    expect(text!.target).toBeUndefined(); // a lane is never a target either
  });

  it("cache.decayed with remaining > 0 does not claim the cache is empty", () => {
    const it1 = item({
      category: "cache.decayed",
      messageKey: "cache.decayed",
      args: [
        { name: "destroyed", kind: "count", value: 1 },
        { name: "remaining", kind: "count", value: 2 },
        { name: "place", kind: "domainToken", value: "siege" }
      ]
    });
    const text = cacheNotifyTranslator.translate(it1, defaultFormatKit);
    expect(text!.body).toContain("1");
    expect(text!.body).not.toContain("nothing is left");
  });

  it("cache.decayed with remaining == 0 says nothing is left", () => {
    const it1 = item({
      category: "cache.decayed",
      messageKey: "cache.decayed",
      args: [
        { name: "destroyed", kind: "count", value: 1 },
        { name: "remaining", kind: "count", value: 0 },
        { name: "place", kind: "domainToken", value: "delve_room" }
      ]
    });
    const text = cacheNotifyTranslator.translate(it1, defaultFormatKit);
    expect(text!.body).toContain("nothing is left");
  });

  it("an unknown message key renders nothing", () => {
    const it1 = item({ messageKey: "cache.unknown-key", args: [] });
    expect(cacheNotifyTranslator.translate(it1, defaultFormatKit)).toBeNull();
  });

  it("samples() covers every off-world place kind and a sector/lane ref for cache.created, and both remaining branches for cache.decayed", () => {
    const created = cacheNotifyTranslator.samples("cache.created");
    expect(created.length).toBeGreaterThanOrEqual(5);
    for (const s of created) {
      const text = cacheNotifyTranslator.translate(s, defaultFormatKit);
      expect(text).not.toBeNull();
      expect(text!.body.length).toBeGreaterThan(0);
    }

    const decayed = cacheNotifyTranslator.samples("cache.decayed");
    expect(decayed.length).toBeGreaterThanOrEqual(2);
    for (const s of decayed) {
      const text = cacheNotifyTranslator.translate(s, defaultFormatKit);
      expect(text).not.toBeNull();
      expect(text!.body.length).toBeGreaterThan(0);
    }
  });

  it("an unrequested message key's samples() is empty, not a throw", () => {
    expect(cacheNotifyTranslator.samples("nothing.registered")).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { worldTranslator } from "./worldTranslator";
import { defaultFormatKit } from "@/shell/notify/format/kit";
import type { NotificationItem, NotifyArg } from "@/shell/notify/catalog";

function item(over: Partial<NotificationItem> & { messageKey: string; args: NotifyArg[] }): NotificationItem {
  return {
    seq: 1,
    rev: 1,
    dedupKey: "k1",
    category: "loam.shortfall",
    severity: "routine",
    sourceId: "world-notify-source",
    state: "unread",
    createdUtc: "2026-01-01T00:00:00Z",
    ...over
  };
}

describe("worldTranslator (world-notify-source spec §3)", () => {
  it("domain is world", () => {
    expect(worldTranslator.domain).toBe("world");
  });

  it("world.turn-entry: body comes from describePlaybackEntry, never a raw token", () => {
    const it1 = item({
      messageKey: "world.turn-entry",
      args: [{ name: "entry", kind: "domainToken", value: { kind: "event", subject: "f-dave", detail: "loam.shortfall:340", sectorId: "s-weak" } }]
    });
    const text = worldTranslator.translate(it1, defaultFormatKit);
    expect(text).not.toBeNull();
    expect(text!.body).not.toContain("loam.shortfall:340");
    expect(text!.body.length).toBeGreaterThan(0);
  });

  it("world.turn-entry: a sector ref argument becomes the target", () => {
    const it1 = item({
      messageKey: "world.turn-entry",
      args: [
        { name: "entry", kind: "domainToken", value: { kind: "event", subject: "f-dave", detail: "supply.cut:s-x", sectorId: "s-x" } },
        { name: "sector", kind: "ref", value: { refKind: "sector", id: "s-x" } }
      ]
    });
    const text = worldTranslator.translate(it1, defaultFormatKit);
    expect(text!.target).toEqual({ refKind: "sector", id: "s-x" });
  });

  it("world.turn-entry: no sector argument means no target", () => {
    const it1 = item({
      messageKey: "world.turn-entry",
      args: [{ name: "entry", kind: "domainToken", value: { kind: "event", subject: "f-dave", detail: "intel.new:5", sectorId: null } }]
    });
    const text = worldTranslator.translate(it1, defaultFormatKit);
    expect(text!.target).toBeUndefined();
  });

  it("world.turn-entry: missing the entry argument throws rather than silently rendering nothing", () => {
    const it1 = item({ messageKey: "world.turn-entry", args: [] });
    expect(() => worldTranslator.translate(it1, defaultFormatKit)).toThrow();
  });

  it("world.release-forecast: names the sector and targets it", () => {
    const it1 = item({
      category: "loam.release",
      messageKey: "world.release-forecast",
      args: [{ name: "sector", kind: "ref", value: { refKind: "sector", id: "ember-hollow" } }]
    });
    const text = worldTranslator.translate(it1, defaultFormatKit);
    expect(text).not.toBeNull();
    expect(text!.body).toContain("Ember Hollow");
    expect(text!.target).toEqual({ refKind: "sector", id: "ember-hollow" });
  });

  it("an unknown message key renders nothing (falls back to render.ts's designed fallback)", () => {
    const it1 = item({ messageKey: "world.unknown-key", args: [] });
    expect(worldTranslator.translate(it1, defaultFormatKit)).toBeNull();
  });

  it("samples('world.turn-entry') covers every mapped classifier prefix and each renders without throwing", () => {
    const samples = worldTranslator.samples("world.turn-entry");
    expect(samples.length).toBeGreaterThanOrEqual(15);
    for (const s of samples) {
      const text = worldTranslator.translate(s, defaultFormatKit);
      expect(text).not.toBeNull();
      expect(text!.body.length).toBeGreaterThan(0);
    }
  });

  it("samples('world.release-forecast') renders without throwing", () => {
    const samples = worldTranslator.samples("world.release-forecast");
    expect(samples.length).toBeGreaterThan(0);
    for (const s of samples) {
      const text = worldTranslator.translate(s, defaultFormatKit);
      expect(text).not.toBeNull();
      expect(text!.body.length).toBeGreaterThan(0);
    }
  });

  it("an unrequested message key's samples() is empty, not a throw", () => {
    expect(worldTranslator.samples("nothing.registered")).toEqual([]);
  });
});

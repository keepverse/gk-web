import { afterEach, describe, expect, it, vi } from "vitest";

const domainOfMock = vi.fn<(id: string) => string | undefined>(() => undefined);
vi.mock("../catalog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../catalog")>();
  return { ...actual, domainOf: (id: string) => domainOfMock(id) };
});

import type { NotificationItem } from "../catalog";
import { renderNotification, resetRenderWarningsForTests } from "./render";
import { registerTranslator, resetTranslatorRegistryForTests } from "./registry";
import type { NotifyTranslator } from "./translator";

function item(overrides: Partial<NotificationItem> = {}): NotificationItem {
  return {
    seq: 1,
    rev: 1,
    dedupKey: "k",
    category: "unregistered.category",
    severity: "important",
    sourceId: "test",
    messageKey: "some.key",
    args: [],
    state: "unread",
    createdUtc: "2026-09-19T00:00:00Z",
    ...overrides
  };
}

describe("render - the designed fallback (notify-format spec §3, Testing 4)", () => {
  afterEach(() => {
    resetTranslatorRegistryForTests();
    resetRenderWarningsForTests();
    domainOfMock.mockReset().mockReturnValue(undefined);
    vi.restoreAllMocks();
  });

  it("an unknown domain renders categoryName + a neutral body, never the raw category id as copy", () => {
    const text = renderNotification(item());
    expect(text.body).toBe("");
    expect(text.title).not.toBe("");
  });

  it("logs once in development for a repeated unknown category", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    renderNotification(item({ category: "still.unregistered" }));
    renderNotification(item({ category: "still.unregistered" }));
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("a translator returning null also falls back to the designed shape", () => {
    domainOfMock.mockReturnValue("test-domain");
    registerTranslator({ domain: "test-domain", translate: () => null, samples: () => [] });

    const text = renderNotification(item());
    expect(text.body).toBe("");
  });

  it("a registered translator's real answer is used, not the fallback", () => {
    domainOfMock.mockReturnValue("test-domain");
    const translator: NotifyTranslator = {
      domain: "test-domain",
      translate: (i) => ({ title: `Title for ${i.messageKey}`, body: "Body text" }),
      samples: () => []
    };
    registerTranslator(translator);

    const text = renderNotification(item({ messageKey: "world.turn-entry" }));
    expect(text).toEqual({ title: "Title for world.turn-entry", body: "Body text" });
  });
});

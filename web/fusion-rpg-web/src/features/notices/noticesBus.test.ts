import { describe, expect, it, vi } from "vitest";
import { createNoticesBus, NOTICES_EVENTS, wireNoticesBus, type NoticesBusEffects } from "./noticesBus";

function fakeEffects(): NoticesBusEffects & Record<keyof NoticesBusEffects, ReturnType<typeof vi.fn>> {
  return {
    selectCategory: vi.fn(),
    markRead: vi.fn(),
    dismiss: vi.fn(),
    undoDismiss: vi.fn(),
    loadOlder: vi.fn(),
    openTarget: vi.fn(),
    setChannel: vi.fn()
  };
}

describe("noticesBus (notify-centre spec §2 step 5, Testing 2)", () => {
  it("declares exactly the seven events, no other", () => {
    expect(NOTICES_EVENTS).toHaveLength(7);
    expect(new Set(NOTICES_EVENTS).size).toBe(7);
    expect(NOTICES_EVENTS).toEqual([
      "notices.select-category",
      "notices.mark-read",
      "notices.dismiss",
      "notices.undo-dismiss",
      "notices.load-older",
      "notices.open-target",
      "notices.set-channel"
    ]);
  });

  it("each event calls exactly its own effect, none of the others", () => {
    const bus = createNoticesBus();
    const effects = fakeEffects();
    wireNoticesBus(bus, effects);

    bus.emit("notices.select-category", { category: "growth" });
    expect(effects.selectCategory).toHaveBeenCalledWith("growth");

    bus.emit("notices.mark-read", { seqs: [1, 2] });
    expect(effects.markRead).toHaveBeenCalledWith([1, 2]);

    bus.emit("notices.dismiss", { seqs: [3] });
    expect(effects.dismiss).toHaveBeenCalledWith([3]);

    bus.emit("notices.undo-dismiss", { seq: 4 });
    expect(effects.undoDismiss).toHaveBeenCalledWith(4);

    bus.emit("notices.load-older", { beforeSeq: 5 });
    expect(effects.loadOlder).toHaveBeenCalledWith(5);

    const target = { refKind: "sector" as const, id: "s-x" };
    bus.emit("notices.open-target", { target });
    expect(effects.openTarget).toHaveBeenCalledWith(target);

    bus.emit("notices.set-channel", { category: "growth", channel: "off" });
    expect(effects.setChannel).toHaveBeenCalledWith("growth", "off");

    // Exactly one call each — no event double-fires another effect.
    for (const fn of Object.values(effects)) expect(fn).toHaveBeenCalledTimes(1);
  });

  it("the returned unsubscribe stops every effect from firing again", () => {
    const bus = createNoticesBus();
    const effects = fakeEffects();
    const unwire = wireNoticesBus(bus, effects);

    unwire();
    bus.emit("notices.select-category", { category: "growth" });

    expect(effects.selectCategory).not.toHaveBeenCalled();
  });
});

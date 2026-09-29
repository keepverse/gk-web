import { describe, expect, it } from "vitest";
import { ACTOR_IDS, actorDefinition } from "./actorCast";
import { RIFT_PROLOGUE_SCRIPT, type SceneBeat, type SceneScript } from "./sceneScript";
import {
  foldStorySceneVm,
  type StorySceneLabelStrings,
  type StorySceneVmInput
} from "./foldStorySceneVm";

/**
 * The fold: one pure function from scene state + script to the surface view-model. It joins the
 * script, resolves the cast, computes speaking state, formats labels, and owns the omit rules —
 * and the recipe binds against the VM object itself (no `root`/`payloads` map anywhere).
 */
const labels: StorySceneLabelStrings = {
  next: "Next",
  final: "Anchor the lawn",
  skip: "Skip intro",
  pending: "Saving…",
  retry: "Retry",
  bypass: "Continue to lawn",
  ackFailed: "We couldn't save that just now.",
  progress: (position: number, total: number) => `Beat ${position} of ${total}`,
  spriteHint: "art not yet authored",
  spritePlaceholder: (name: string) => `${name} — art not yet available`
};

const NO_ART: Record<"penny" | "dave", Record<string, string | null>> = {
  penny: { default: null },
  dave: { default: null }
};

function input(over: Partial<StorySceneVmInput> = {}): StorySceneVmInput {
  return {
    script: RIFT_PROLOGUE_SCRIPT,
    beatIndex: 0,
    ack: { pending: false, error: false },
    art: NO_ART,
    revision: 7,
    labels,
    shellTitle: "The Rift is opening",
    shellSubtitle: "A short warning",
    ...over
  };
}

function collectPayloads(vm: ReturnType<typeof foldStorySceneVm>): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [vm as unknown as Record<string, unknown>];
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (value && typeof value === "object" && "piece" in (value as object)) {
      out.push(value as Record<string, unknown>);
      for (const child of Object.values(value)) visit(child);
    }
  };
  visit((vm as unknown as { actors: unknown }).actors);
  visit((vm as unknown as { window: unknown }).window);
  visit((vm as unknown as { progress: unknown }).progress);
  visit((vm as unknown as { advance: unknown }).advance);
  return out;
}

describe("fold — shape (no root/payloads map, audit assertion)", () => {
  it("emits the VM fields the recipe binds, and no invented map", () => {
    const vm = foldStorySceneVm(input());
    expect(vm).not.toHaveProperty("root");
    expect(vm).not.toHaveProperty("payloads");
    for (const field of ["actors", "window", "advance", "cueId", "sceneId", "themeRef"] as const) {
      expect(vm, field).toHaveProperty(field);
    }
  });

  it("reads beats.length from the input script — never a literal", () => {
    // A two-beat custom script proves the fold never assumed the shipped four.
    const twoBeat: SceneScript = {
      sceneId: "rift-prologue",
      version: 1,
      beats: [
        { speakerId: "dave", line: "One." },
        { speakerId: "penny", line: "Two." }
      ]
    };
    const vm = foldStorySceneVm(input({ script: twoBeat, beatIndex: 1 }));
    expect(vm.terminal).toEqual({ action: "advance", outcome: "completed" });
    const first = foldStorySceneVm(input({ script: twoBeat, beatIndex: 0 }));
    expect(first.terminal).toEqual({ action: "skip", outcome: "skipped" });
  });
});

describe("fold — G5: the name tag lives on the window payload", () => {
  it("a spoken beat carries nameTag on window, not on the VM root", () => {
    const vm = foldStorySceneVm(input({ beatIndex: 0 }));
    expect(vm.window.nameTag).toBeDefined();
    expect(vm.window.nameTag?.displayName).toBe(actorDefinition("dave").displayName);
    expect(vm).not.toHaveProperty("nameTag");
  });

  it("a narration beat omits the field — absent, not empty", () => {
    // Beat 3 of the shipped script has no speakerId.
    const vm = foldStorySceneVm(input({ beatIndex: 2 }));
    expect(vm.window.narration).toBe(true);
    expect("nameTag" in vm.window).toBe(false);
    expect(vm).not.toHaveProperty("nameTag");
  });
});

describe("fold — omit rules", () => {
  it("a one-beat script emits no progress field", () => {
    const oneBeat: SceneScript = {
      sceneId: "rift-prologue",
      version: 1,
      beats: [{ speakerId: "dave", line: "Only." }]
    };
    const vm = foldStorySceneVm(input({ script: oneBeat }));
    expect("progress" in vm).toBe(false);
  });

  it("a multi-beat script emits progress with the fold-formatted label", () => {
    const vm = foldStorySceneVm(input({ beatIndex: 1 }));
    expect(vm.progress).toMatchObject({ label: "Beat 2 of 4" });
  });
});

describe("fold — speaking and variants", () => {
  it("speaking is true only for the beat's speaker; narration has none", () => {
    const daveBeat = foldStorySceneVm(input({ beatIndex: 0 }));
    expect(daveBeat.actors.map((a) => [a.actorId, a.speaking])).toEqual([
      ["penny", false],
      ["dave", true]
    ]);
    const narration = foldStorySceneVm(input({ beatIndex: 2 }));
    expect(narration.actors.every((a) => a.speaking === false)).toBe(true);
  });

  it("actors stay in cast order regardless of who speaks", () => {
    for (const beatIndex of [0, 1, 2, 3]) {
      const vm = foldStorySceneVm(input({ beatIndex }));
      expect(vm.actors.map((a) => a.actorId)).toEqual([...ACTOR_IDS]);
    }
  });

  it("a variant set on beat 1 survives to beat 3 unchanged", () => {
    const beats: SceneBeat[] = [
      { speakerId: "dave", variant: "alarmed", line: "One." },
      { speakerId: "penny", line: "Two." },
      { line: "Three." }
    ];
    const script: SceneScript = { sceneId: "rift-prologue", version: 1, beats };
    const art = {
      penny: { default: null },
      dave: { default: null, alarmed: "/art/dave-alarmed.png" }
    };
    const atBeat3 = foldStorySceneVm(input({ script, art, beatIndex: 2 }));
    const dave = atBeat3.actors.find((a) => a.actorId === "dave");
    expect(dave?.variantId).toBe("alarmed");
    expect(dave?.spriteUrl).toBe("/art/dave-alarmed.png");
    // And a speaker change never invented a variant for the other actor.
    const penny = atBeat3.actors.find((a) => a.actorId === "penny");
    expect(penny?.variantId).toBe("default");
  });
});

describe("fold — terminal", () => {
  it("advance on the last beat completes; otherwise only skip ends the scene", () => {
    expect(foldStorySceneVm(input({ beatIndex: 3 })).terminal).toEqual({
      action: "advance",
      outcome: "completed"
    });
    for (const beatIndex of [0, 1, 2]) {
      expect(foldStorySceneVm(input({ beatIndex })).terminal).toEqual({
        action: "skip",
        outcome: "skipped"
      });
    }
  });

  it("advance is present on every beat, so skip is reachable on every beat", () => {
    for (const beatIndex of [0, 1, 2, 3]) {
      const vm = foldStorySceneVm(input({ beatIndex }));
      expect(vm.advance.skipLabel).toBe("Skip intro");
    }
  });
});

describe("fold — purity and revision", () => {
  it("is pure: identical inputs are deep-equal", () => {
    const a = foldStorySceneVm(input({ beatIndex: 1 }));
    const b = foldStorySceneVm(input({ beatIndex: 1 }));
    expect(a).toEqual(b);
  });

  it("stamps revision on every payload including nested ones", () => {
    const vm = foldStorySceneVm(input({ beatIndex: 0, revision: 41 }));
    for (const payload of collectPayloads(vm)) {
      expect(payload["revision"]).toBe(41);
    }
    expect(vm.revision).toBe(41);
  });

  it("defaults a missing revision without inventing one", () => {
    const { revision, ...rest } = input();
    void rest;
    const base = input();
    delete (base as Partial<StorySceneVmInput>).revision;
    expect(foldStorySceneVm(base).revision).toBe(0);
  });
});

describe("fold — actor items carry a complete sprite body", () => {
  it("each actor item embeds a body the recipe's per-item slot can mount directly", () => {
    const vm = foldStorySceneVm(input({ beatIndex: 0 }));
    for (const actor of vm.actors) {
      const body = (actor as unknown as { body?: Record<string, unknown> }).body;
      expect(body, actor.actorId).toBeDefined();
      for (const field of [
        "instanceId",
        "actorId",
        "displayName",
        "initial",
        "variantId",
        "spriteUrl",
        "themeRef",
        "phase",
        "revision"
      ]) {
        expect(body, `${actor.actorId}.${field}`).toHaveProperty(field);
      }
      expect(body!["instanceId"]).toBe(`scene:actor:${actor.actorId}:sprite`);
    }
  });
});

describe("fold — art phases", () => {
  it("missing art resolves to null with phase empty, never error", () => {
    const vm = foldStorySceneVm(input({ beatIndex: 0 }));
    for (const actor of vm.actors) {
      expect(actor.spriteUrl).toBeNull();
      expect(actor.phase).toBe("empty");
    }
    expect(vm.phase).toBe("ready");
  });

  it("present art resolves the url and marks ready", () => {
    const art = {
      penny: { default: "/art/penny.png" },
      dave: { default: null }
    };
    const vm = foldStorySceneVm(input({ beatIndex: 1, art }));
    const penny = vm.actors.find((a) => a.actorId === "penny");
    expect(penny?.spriteUrl).toBe("/art/penny.png");
    expect(penny?.phase).toBe("ready");
  });
});

describe("fold — invalid inputs fail loudly", () => {
  it("an out-of-range beatIndex throws instead of emitting a hollow VM", () => {
    expect(() => foldStorySceneVm(input({ beatIndex: 9 }))).toThrow(RangeError);
    expect(() => foldStorySceneVm(input({ beatIndex: -1 }))).toThrow(RangeError);
  });

  it("an empty script throws instead of emitting a sceneless VM", () => {
    const empty: SceneScript = { sceneId: "rift-prologue", version: 1, beats: [] };
    expect(() => foldStorySceneVm(input({ script: empty }))).toThrow(RangeError);
  });
});

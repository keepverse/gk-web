import { describe, expect, it } from "vitest";
import type { MessageDescriptor } from "@lingui/core";
import { i18n } from "@/i18n";
import {
  LEAD_TOKENS,
  leadNameValues,
  registryFor,
  type LeadNamesRegistry
} from "@/i18n/leadNames";
import { RIFT_PROLOGUE_SCRIPT } from "./sceneScript";
import { ACTOR_IDS, actorDefinition } from "./actorCast";
import {
  RIFT_PROLOGUE_BEAT_MESSAGES,
  RIFT_PROLOGUE_CHROME,
  STORY_SCENE_CHROME,
  actorNameMessageId,
  beatMessageId,
  messagesForCast,
  messagesForScript,
  progressMessageId,
  storySceneMessages
} from "./messages";

/**
 * `localization` fixes the message ids for every player-facing story string (owner S4: i18n
 * throughout, English default).
 *
 * ## Why the assertions look like this
 *
 * `@lingui/macro` compiles `msg` at build time and **requires literal text** —
 * `msg({ message: someRuntimeVariable })` is a hard error. The spec's runtime-string resolution
 * therefore cannot exist; the shape that works is one literal descriptor per string with an explicit
 * stable id. That makes duplication between the script and the catalog inherent (the catalog must
 * contain literals or nothing is extractable), so the tests below do the job the impossible runtime
 * lookup would have done: they bind the two **by assertion**, so editing one without the other fails.
 *
 * The S4 acceptance test proper — the pseudo-locale render — needs the pieces (T12–T19). These
 * assertions are the half that would otherwise fail silently.
 */
/**
 * A second name set: the same tokens, different display strings, the same tags. The round trip below
 * is the spec's own rule (`narrative-seed-ideal.md` §6.5b) — every string renders against two name
 * sets and the outputs differ exactly where the tokens are, the proof no name is baked in.
 */
const secondNameSet: LeadNamesRegistry = {
  ...registryFor("en"),
  locale: "en-test",
  names: Object.fromEntries(
    Object.entries(registryFor("en").names).map(([token, row]) => [
      token,
      { ...row, display: `Examplar ${token}` }
    ])
  )
};

describe("story-scene message ids", () => {
  it("derives a stable, positional id for a beat's line and teaching", () => {
    expect(beatMessageId("rift-prologue", 0, "line")).toBe("scene.rift-prologue.beat1.line");
    expect(beatMessageId("rift-prologue", 2, "teaching")).toBe(
      "scene.rift-prologue.beat3.teaching"
    );
    // Positional, so changing the wording does not orphan an existing translation.
    expect(beatMessageId("rift-prologue", 0, "line")).not.toContain("Uh-oh");
  });

  it("derives a stable id for an actor's name", () => {
    expect(actorNameMessageId("penny")).toBe("actor.penny.name");
    expect(actorNameMessageId("dave")).toBe("actor.dave.name");
  });

  it("gives the beat-position label its own id", () => {
    expect(progressMessageId("rift-prologue")).toBe("scene.rift-prologue.progress");
  });
});

/**
 * The anti-drift binding. This is what replaces the runtime lookup the macro forbids: the catalog
 * cannot be resolved *from* the script at runtime, so instead the script's strings and the catalog's
 * literals are asserted equal. An edit to either alone fails here.
 */
describe("catalog and script cannot drift", () => {
  it("has a descriptor for every beat, and no extra descriptor", () => {
    expect(RIFT_PROLOGUE_BEAT_MESSAGES.length).toBe(RIFT_PROLOGUE_SCRIPT.beats.length);
  });

  it("matches every beat line verbatim", () => {
    RIFT_PROLOGUE_SCRIPT.beats.forEach((beat, index) => {
      expect(RIFT_PROLOGUE_BEAT_MESSAGES[index].line.message, `beat ${index + 1} line`).toBe(
        beat.line
      );
    });
  });

  it("matches every teaching sentence verbatim, and only where the script has one", () => {
    RIFT_PROLOGUE_SCRIPT.beats.forEach((beat, index) => {
      expect(RIFT_PROLOGUE_BEAT_MESSAGES[index].teaching?.message, `beat ${index + 1} teaching`).toBe(
        beat.teaching
      );
    });
  });

  it("binds each descriptor's own id to the positional id the fold will look up", () => {
    RIFT_PROLOGUE_BEAT_MESSAGES.forEach((entry, index) => {
      expect(entry.line.id).toBe(beatMessageId("rift-prologue", index, "line"));
      if (entry.teaching) {
        expect(entry.teaching.id).toBe(beatMessageId("rift-prologue", index, "teaching"));
      }
    });
  });

  it("holds no registry display string in any catalog literal", () => {
    // Plan D2 / §6.5b: names are parameters, so a catalog literal that contains one has baked a name
    // in. The registry's own values are the reference, so a rename cannot silently re-introduce one.
    const displays = Object.values(registryFor("en").names).map((row) => row.display);
    expect(displays.length).toBeGreaterThan(0);
    for (const [id, descriptor] of Object.entries(storySceneMessages())) {
      const source = String(descriptor.message ?? "");
      for (const display of displays) {
        expect(source, `${id} must not carry the name "${display}"`).not.toContain(display);
      }
    }
  });

  it("renders every prologue string against two name sets, differing exactly at the tokens", () => {
    const shipped = leadNameValues();
    const second = leadNameValues(secondNameSet);
    const rendered = (names: Record<string, string>) => ({ position: 2, total: 4, ...names });

    const seen = new Set<string>();
    for (const [id, descriptor] of Object.entries(storySceneMessages())) {
      const source = String(descriptor.message ?? "");
      const tokens = LEAD_TOKENS.filter((token) => source.includes(`{${token}}`));
      const first = i18n._(descriptor, rendered(shipped));
      const other = i18n._(descriptor, rendered(second));

      if (tokens.length === 0) {
        expect(other, id).toBe(first);
        continue;
      }

      for (const token of tokens) seen.add(token);
      expect(other, id).not.toBe(first);
      // The difference IS the name: swapping the shipped display back reproduces the second render,
      // so nothing else in the string moved with it.
      let swapped = first;
      for (const token of tokens) swapped = swapped.split(shipped[token]).join(second[token]);
      expect(swapped, id).toBe(other);
    }

    // Both leads the prologue names are exercised, so the round trip is not vacuous.
    expect([...seen].sort()).toEqual(["lead_companion", "lead_summoner"]);
  });

  it("renders a lead mention with the article the registry's tag selects", () => {
    // No prologue line mentions a lead in running text yet, so this pins the shape the first one
    // must use (plan D2): the article is a select arm on the tag, never string surgery on the name.
    const mention = {
      id: "test.lead-mention",
      message:
        "{lead_summoner_article, select, definite {The } other {}}{lead_summoner} joins your side."
    } as MessageDescriptor;

    const shippedRow = registryFor("en").names.lead_summoner;
    const withArticle =
      shippedRow.article === "definite" ? `The ${shippedRow.display}` : shippedRow.display;
    expect(i18n._(mention, leadNameValues())).toBe(`${withArticle} joins your side.`);

    const bare = {
      ...secondNameSet,
      names: {
        ...secondNameSet.names,
        lead_summoner: { ...secondNameSet.names.lead_summoner, article: "none" as const }
      }
    };
    expect(i18n._(mention, leadNameValues(bare))).toBe(
      `${bare.names.lead_summoner.display} joins your side.`
    );
  });

  it("renders every actor's name message to the registry's display for its token", () => {
    // The catalog carries the token; the registry owns the words (plan D2 / §6.5b). Asserted
    // against the cast's own resolved name, so a lead rename stays a one-row registry edit.
    const cast = messagesForCast();
    const values = leadNameValues();
    for (const actorId of ACTOR_IDS) {
      const descriptor = cast[actorNameMessageId(actorId)];
      expect(descriptor, `missing name message for ${actorId}`).toBeDefined();
      expect(descriptor.id).toBe(actorNameMessageId(actorId));
      expect(i18n._(descriptor, values)).toBe(actorDefinition(actorId).displayName);
    }
  });
});

describe("story-scene message coverage", () => {
  it("resolves a message for every beat line and every teaching sentence", () => {
    const messages = messagesForScript(RIFT_PROLOGUE_SCRIPT);
    RIFT_PROLOGUE_SCRIPT.beats.forEach((beat, index) => {
      expect(messages[beatMessageId("rift-prologue", index, "line")]).toBeDefined();
      if (beat.teaching) {
        expect(messages[beatMessageId("rift-prologue", index, "teaching")]).toBeDefined();
      }
    });
  });

  it("resolves a message for every actor in the cast", () => {
    const messages = messagesForCast();
    for (const actorId of ACTOR_IDS) {
      expect(messages[actorNameMessageId(actorId)]).toBeDefined();
    }
  });

  it("resolves a message for every piece of chrome the host renders", () => {
    for (const [key, descriptor] of Object.entries(STORY_SCENE_CHROME)) {
      expect(descriptor, `missing chrome string: ${key}`).toBeDefined();
      expect(descriptor.message.trim().length).toBeGreaterThan(0);
      expect(descriptor.id).toBeTruthy();
    }
  });

  it("gives the shell title and subtitle their own messages", () => {
    expect(RIFT_PROLOGUE_CHROME.title.message).toBe("The Rift is opening");
    expect(RIFT_PROLOGUE_CHROME.subtitle.message.length).toBeGreaterThan(0);
  });

  it("keeps the beat-position label interpolated, not pre-formatted English", () => {
    // A pre-baked "Beat 2 of 4" cannot be reordered by a translator whose language places the count
    // differently, which is the point of routing it through ICU rather than a template string.
    const label = storySceneMessages()[progressMessageId("rift-prologue")];
    expect(label.message).toContain("{position}");
    expect(label.message).toContain("{total}");
  });

  it("fails loudly on a beat with no descriptor, rather than resolving to a dead id", () => {
    // A script with more beats than the catalog covers must throw, not render English.
    const extended = {
      ...RIFT_PROLOGUE_SCRIPT,
      beats: [...RIFT_PROLOGUE_SCRIPT.beats, { line: "a fifth beat" }]
    };
    expect(() => messagesForScript(extended)).toThrow(/has no message descriptor/);
  });

  it("refuses a scene it has no catalog for", () => {
    expect(() =>
      messagesForScript({ sceneId: "some-other-scene" as never, version: 1, beats: [{ line: "x" }] })
    ).toThrow(/no message catalog/);
  });

  it("does not pin the shipped script's beat count — coverage is derived from its data", () => {
    // Guardrail discipline: the assertions walk the script's own beats. A literal 4 here would fail
    // the day a beat is added, which is the normal case, not a defect.
    const messages = messagesForScript(RIFT_PROLOGUE_SCRIPT);
    const lineIds = Object.keys(messages).filter((id) => id.endsWith(".line"));
    expect(lineIds.length).toBe(RIFT_PROLOGUE_SCRIPT.beats.length);
  });

  it("never ships an engine word in a player-facing message", () => {
    for (const descriptor of Object.values(storySceneMessages())) {
      expect(descriptor.message).not.toMatch(/\b(revision|typeId|instanceId|cueId|storyId)\b/);
    }
  });

  it("uses one stable, unique id per message", () => {
    const ids = Object.values(storySceneMessages()).map((d) => d.id);
    expect(ids.every((id) => typeof id === "string" && id.length > 0)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

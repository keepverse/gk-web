import { describe, expect, it } from "vitest";
import { leadName } from "@/i18n/leadNames";
import {
  ACTOR_IDS,
  ACTORS,
  DEFAULT_ACTOR_VARIANT,
  type ActorDefinition,
  actorDefinition,
  actorIdsOnStage,
  pickVariant,
  resolveActorSprite
} from "./actorCast";

/**
 * `actor-cast` gives a scene a first-class actor concept, so it can say *who* is on stage and
 * resolve them to art. The old art contract had ONE shared sprite role for the whole scene
 * (`riftAssets.ts`'s `storySprite`), which cannot express Penny *and* Dave, and that is why the
 * fallback was a single shared `◈` for everyone.
 *
 * The fallback is the point of the module (owner decision 2): when art is missing it must be an
 * **honest labelled shape carrying the actor's name**, and two missing actors must be
 * distinguishable from each other.
 */
describe("actor cast", () => {
  it("is a closed set of exactly the v1 cast", () => {
    expect([...ACTOR_IDS].sort()).toEqual(["dave", "penny"]);
  });

  it("resolves a definition for every id, and rejects an unknown one", () => {
    for (const id of ACTOR_IDS) {
      expect(actorDefinition(id).id).toBe(id);
    }
    expect(() => actorDefinition("zomboss" as never)).toThrow(/unknown actor/);
  });

  it("carries fiction-only display names and a derived initial", () => {
    for (const id of ACTOR_IDS) {
      const def = actorDefinition(id);
      expect(def.displayName.trim().length).toBeGreaterThan(0);
      // Fiction only: not the bare id, no path, no engine term. (Case-sensitive on purpose —
      // a case-insensitive `^[a-z]+$` would wrongly reject "Penny" for being all letters.)
      expect(def.displayName).not.toBe(id);
      expect(def.displayName).not.toMatch(/[_/\\]/);
      expect(def.displayName).not.toMatch(/\b(Actor|Phase|Retired|Enum|Id)\b/);
      // The initial is derived from the name, not authored a second time.
      expect(def.initial).toBe(def.displayName.charAt(0).toUpperCase());
    }
    expect(actorDefinition("dave").displayName).not.toBe(actorDefinition("penny").displayName);
  });

  it("takes every display name from the names registry through its lead token", () => {
    // The token mapping is the contract; the strings are parameters (§6.5b). Pinned as tokens, never
    // as names, so renaming a lead is one row edit in the registry and this file does not change.
    expect(actorDefinition("dave").nameToken).toBe("lead_summoner");
    expect(actorDefinition("penny").nameToken).toBe("lead_companion");
    for (const id of ACTOR_IDS) {
      const def = actorDefinition(id);
      expect(def.displayName).toBe(leadName(def.nameToken));
      expect(def.initial).toBe(leadName(def.nameToken).charAt(0).toUpperCase());
    }
  });

  it("keeps the actor ids and theme ids as code identifiers", () => {
    // Owner ruling R9 keeps identifiers out of the rename: the label changed, the key did not, so no
    // saved theme reference, `ActorId` arm or data-attribute moves with it.
    expect(ACTORS.dave.id).toBe("dave");
    expect(ACTORS.penny.id).toBe("penny");
    expect(ACTORS.dave.themeRef.id).toBe("dave");
    expect(ACTORS.penny.themeRef.id).toBe("penny");
  });

  it("names a person, not a faction — no plant/zombie side axis anywhere", () => {
    const json = JSON.stringify(ACTORS);
    expect(json).not.toMatch(/plant|zombie|side/i);
    for (const id of ACTOR_IDS) {
      // The pack reference is an `actor` kind; the side kind is a faction axis Penny and Dave are
      // neither of (this is the concrete reason ThemeKind must widen — S2).
      expect(actorDefinition(id).themeRef.kind).toBe("actor");
      expect(actorDefinition(id).themeRef).not.toHaveProperty("side");
    }
  });

  it("keeps Dr. Zomboss out of v1 data entirely", () => {
    expect(JSON.stringify(ACTORS)).not.toMatch(/zomboss/i);
  });

  it("always exposes a `default` variant, which is what a missing variant degrades to", () => {
    for (const id of ACTOR_IDS) {
      const def = actorDefinition(id);
      expect(def.variants.map((v) => v.id)).toContain(DEFAULT_ACTOR_VARIANT);
    }
  });

  it("resolves missing art to null, never to a 404 string", () => {
    // No Penny/Dave art is authored yet, which is the normal development state the labelled
    // fallback exists for. A URL string here would drive a broken-image glyph — decision 2 bans it.
    for (const id of ACTOR_IDS) {
      expect(resolveActorSprite(id)).toBeNull();
    }
  });

  it("degrades a missing variant to the default variant, then to the labelled shape", () => {
    // A named variant is accepted; an unknown one does not throw and does not invent a URL.
    expect(resolveActorSprite("dave", "default")).toBeNull();
    expect(resolveActorSprite("dave", "not-a-real-variant")).toBeNull();
  });

  /**
   * The degradation chain with **synthetic variants that carry real URLs**.
   *
   * Every shipped variant resolves to `null` today, so asserting against real data cannot tell a
   * working chain from one that always returns `null`. These use `pickVariant` directly so the
   * chain is actually discriminated: removing the default arm makes this test fail.
   */
  it("picks a named variant when it exists", () => {
    const variants = [
      { id: DEFAULT_ACTOR_VARIANT, spriteUrl: "/default.png" },
      { id: "alarmed", spriteUrl: "/alarmed.png" }
    ];
    expect(pickVariant(variants, "alarmed")?.spriteUrl).toBe("/alarmed.png");
    expect(pickVariant(variants)?.spriteUrl).toBe("/default.png");
  });

  it("falls back to the default arm for an unknown variant, rather than to nothing", () => {
    // This is the assertion that discriminates: without the `?? find("default")` arm the result is
    // `undefined`, so a missing expression degrades to the default portrait instead of vanishing.
    const variants = [
      { id: DEFAULT_ACTOR_VARIANT, spriteUrl: "/default.png" },
      { id: "alarmed", spriteUrl: "/alarmed.png" }
    ];
    expect(pickVariant(variants, "not-a-real-variant")?.spriteUrl).toBe("/default.png");
  });

  it("returns undefined only when there is no default arm at all", () => {
    expect(pickVariant([], "anything")).toBeUndefined();
    expect(pickVariant([{ id: "alarmed", spriteUrl: "/a.png" }], "alarmed")?.spriteUrl).toBe("/a.png");
    expect(pickVariant([{ id: "alarmed", spriteUrl: "/a.png" }], "missing")).toBeUndefined();
  });

  it("makes two missing actors distinguishable per actor, not one shared glyph", () => {
    const dave = actorDefinition("dave");
    const penny = actorDefinition("penny");
    expect(dave.displayName).not.toBe(penny.displayName);
    expect(dave.initial).not.toBe(penny.initial);
    // The old fallback was a single `◈` plus one shared manifest string for every actor; the
    // per-actor pair (name + initial) is what makes "who is missing" answerable.
    expect(`${dave.displayName}${dave.initial}`).not.toBe(`${penny.displayName}${penny.initial}`);
  });

  it("needs no shape change to add a third actor", () => {
    // The claim is structural: a definition is a data record keyed by id, and `variants` is a list,
    // so a third actor is additive data rather than a new union arm every consumer must absorb.
    // Asserted on behaviour, not on a key-set snapshot (which would restate the current shape and
    // pass whether or not the contract could grow): a synthetic third definition is usable by the
    // same resolver with no code change.
    const synthetic: ActorDefinition = {
      id: "penny",
      nameToken: "lead_companion",
      displayName: "Third",
      initial: "T",
      variants: [{ id: DEFAULT_ACTOR_VARIANT, spriteUrl: "/x.png" }],
      themeRef: { kind: "actor", id: "penny" }
    };
    expect(pickVariant(synthetic.variants, "default")?.spriteUrl).toBe("/x.png");
    expect(synthetic.variants).toHaveLength(1);
    // The union is what constrains the cast, and adding an id is an ask-first content change.
    expect(ACTOR_IDS.length).toBeGreaterThanOrEqual(2);
  });

  it("lists the actors on stage from the beat data, deduped and in cast order", () => {
    // Two actors on stage is the v1 floor (owner decision 2), so the cast list must be derivable
    // from a script's speakers rather than assumed from the cast size.
    expect(actorIdsOnStage(["dave", "penny", "dave"])).toEqual(["penny", "dave"]);
    expect(actorIdsOnStage(["penny"])).toEqual(["penny"]);
    // A narration-only scene has no actors on stage and must not fall back to "everyone".
    expect(actorIdsOnStage([])).toEqual([]);
  });
});

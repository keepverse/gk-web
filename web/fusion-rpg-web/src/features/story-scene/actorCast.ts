import type { ThemeRef } from "@/features/gui-lego/types";
import { leadName, registryFor, type LeadNamesRegistry, type LeadToken } from "@/i18n/leadNames";
import type { ActorId } from "./sceneScript";

/**
 * The story-scene cast: actor identity, and the honest fallback when art is missing.
 *
 * The old art contract carried ONE sprite role for the whole scene
 * (`features/onboarding/riftAssets.ts`'s `storySprite`). That cannot express Penny *and* Dave, and
 * it is why the missing-art fallback was a single shared `◈` plus one shared label for every actor.
 *
 * Two rules from owner decision 2 are structural here:
 *
 * 1. **An actor is not a faction.** `ActorFrame` tints by a plant/zombie *side*; neither Dave (a
 *    person) nor Penny (Crazy Dave's time machine — `docs/research/pvz-lore/canon-boundary-and-onboarding.md:17`)
 *    is on that axis, so a definition carries its own `actor` theme reference and this module has no
 *    side axis at all. (This is the concrete reason `ThemeKind` must widen — S2.)
 * 2. **Missing art is `null`, never a URL string.** `null` is what drives the labelled stand-in; a
 *    broken URL would render a broken-image glyph, which decision 2 bans.
 */

export type { ActorId };

/** The named variant a missing variant degrades to, and every definition's fallback arm. */
export const DEFAULT_ACTOR_VARIANT = "default";

export type ActorVariant = {
  /** Variant id, e.g. `"default"` | `"alarmed"`. */
  id: string;
  /** Resolved art URL for this variant, or `null` when the art is not yet authored. */
  spriteUrl: string | null;
};

export type ActorDefinition = {
  id: ActorId;
  /**
   * The lead token this actor's name comes from (`docs/architecture/narrative-seed-ideal.md` §6.5b).
   * The name itself is never authored here: it is registry data, so renaming a lead is one row edit
   * in `gk-data/packs/fusion/data/seed/narrative/_registry/names.en.v1.json` and no file in this directory changes.
   */
  nameToken: LeadToken;
  /** Player-facing name, resolved from the names registry through `nameToken`. Fiction only — never
   * an id, a path, or an engine term. */
  displayName: string;
  /** Initial used by the honest labelled fallback. Derived from `displayName`, not authored twice. */
  initial: string;
  /** Named variants; the entry with id `"default"` is the fallback arm. */
  variants: readonly ActorVariant[];
  /**
   * Pack reference for this actor's paint.
   *
   * Deliberately `ThemeRef` **intersected** with the narrow kind, not a free-standing
   * `{ kind: "actor"; id }` object. That intersection is what makes the `ThemeKind` widen
   * load-bearing: an inline structural type of the same shape would satisfy the compiler without
   * `"actor"` ever being a member of the union, so the widen would be decorative and a later
   * `resolveTheme(def.themeRef)` would be unchecked. With the intersection, this file does not
   * compile unless `"actor"` is a real `ThemeKind`.
   */
  themeRef: ThemeRef & { kind: "actor" };
};

/**
 * `null` deliberately: no Penny/Dave art is authored yet, so the labelled fallback is the honest
 * current state rather than a stub.
 *
 * There is deliberately **no path-building helper and no asset version constant** here. A function
 * that manufactured `/assets/onboarding/actors/<id>-v1.png` for art that does not exist would be a
 * latent 404 — and the spec's rule is that missing art resolves to `null`, never to a URL string,
 * because a broken URL renders a broken-image glyph, which owner decision 2 bans. When art is
 * authored, the variant entries below name their files directly and a cache-busting version is
 * introduced alongside it, in the same change that swaps the art (the spec's rule 1).
 */
const NO_ART: string | null = null;

/**
 * Build one definition, resolving its display name and initial from the registry.
 *
 * `registry` is a parameter rather than a closed-over constant so a test can render the same cast
 * against a second name set (`narrative-seed-ideal.md` §6.5b's round-trip rule).
 */
function defineActor(
  id: ActorId,
  nameToken: LeadToken,
  registry: LeadNamesRegistry = registryFor("en")
): ActorDefinition {
  const displayName = leadName(nameToken, registry);
  return {
    id,
    nameToken,
    displayName,
    initial: displayName.charAt(0).toUpperCase(),
    variants: [{ id: DEFAULT_ACTOR_VARIANT, spriteUrl: NO_ART }],
    themeRef: { kind: "actor", id }
  };
}

/**
 * The v1 cast. `dave` is the summoner the player becomes and `penny` the companion; both names are
 * the registry's (`actorCast.test.ts` pins the token mapping, not the strings). The `id`s and the
 * `themeRef` ids stay the code identifiers they always were — renaming them is a code change with
 * its own cost, and owner ruling R9 keeps identifiers out of this rename.
 */
export const ACTORS: Record<ActorId, ActorDefinition> = {
  dave: defineActor("dave", "lead_summoner"),
  penny: defineActor("penny", "lead_companion")
};

/** The closed v1 cast. Adding an id is an **ask-first** content change. */
export const ACTOR_IDS = ["penny", "dave"] as const;

/**
 * Resolve a definition, throwing on an unknown id.
 *
 * Throws rather than returning a placeholder: an unknown actor is a data defect (a typo in a beat's
 * `speakerId` should have been a compile error), and silently rendering a generic body would hide it.
 */
export function actorDefinition(actorId: ActorId): ActorDefinition {
  const def = ACTORS[actorId];
  if (!def) throw new Error(`story-scene: unknown actor "${String(actorId)}"`);
  return def;
}

/**
 * Pick a variant from a definition's list, degrading in the genre's order.
 *
 * Extracted as a pure function over `variants` (rather than inlined in `resolveActorSprite`) so the
 * degradadation chain is **testable with synthetic variants that carry real URLs**. With every
 * shipped variant `null`, an inlined chain could not be distinguished from one that always returns
 * `null` — the test would pass either way and prove nothing.
 *
 * Order: the named variant → the `"default"` arm → `undefined` (Dialogic's
 * `get_portrait_info` falls back to the character's default portrait; Ren'Py substitutes a
 * `Placeholder` when even that is missing).
 */
export function pickVariant(
  variants: readonly ActorVariant[],
  variantId?: string
): ActorVariant | undefined {
  const wanted = variantId ?? DEFAULT_ACTOR_VARIANT;
  return (
    variants.find((v) => v.id === wanted) ??
    variants.find((v) => v.id === DEFAULT_ACTOR_VARIANT)
  );
}

/**
 * Resolve an actor's sprite URL for a variant.
 *
 * Returns `null` rather than throwing for a missing variant, because a not-yet-authored expression
 * is an expected state, not a defect — the labelled shape is the designed answer.
 */
export function resolveActorSprite(actorId: ActorId, variantId?: string): string | null {
  const def = actorDefinition(actorId);
  return pickVariant(def.variants, variantId)?.spriteUrl ?? null;
}

/**
 * The actors present on stage for a set of beat speakers, deduped and in cast order.
 *
 * Derived from the script's speakers rather than assumed from the cast size, because a
 * narration-only scene has **no** actors on stage and must not fall back to "everyone". Cast order
 * (not first-appearance order) keeps the stage layout deterministic between renders.
 */
export function actorIdsOnStage(speakerIds: readonly (ActorId | undefined)[]): ActorId[] {
  const present = new Set(speakerIds.filter((id): id is ActorId => id !== undefined));
  return ACTOR_IDS.filter((id) => present.has(id));
}

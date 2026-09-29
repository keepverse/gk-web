import { describe, expect, it } from "vitest";
import type { ThemeKind, ThemeRef } from "./types";
import { listThemePacks, lookupThemePack, resolveTheme, themeIdFor } from "./themeRegistry";
import type { ActorId } from "@/features/story-scene/sceneScript";
import { actorDefinition } from "@/features/story-scene/actorCast";

/**
 * `ThemeKind` is a **closed union**, and closing it is the point: it is the vocabulary of what can
 * be painted, so widening it is a reviewed change rather than a convenience.
 *
 * Owner decision S2 (2026-09-15) widens it **once**, with two kinds:
 *
 * - `actor` — a story-scene cast member's identity paint. Rejected alternative: reusing `side`. `side`
 *   is a *faction* axis (`side-plant`, `side-zombie`); Dave is a person and Penny is Crazy Dave's time
 *   machine, so neither is on that axis, and overloading it would make "a person" and "a faction" one
 *   vocabulary.
 * - `scene` — a story scene's mood paint (an opening portal, a quarantine). Rejected alternative:
 *   reusing `neutral`, which is the *absence* of a pack, so every actor would look identical — the
 *   exact bug the fallback exists to avoid. Also rejected: folding actors into `scene`, which would
 *   make an actor's paint depend on which scene he happens to stand in.
 *
 * This task widens the union only. The packs themselves are T11.
 *
 * **Note on why these assertions are runtime-shaped.** `tsconfig.json` excludes `*.test.ts*` from
 * `tsc`, so a type-only assertion in this file would never be checked. The load-bearing type check
 * lives in production code instead — `actorCast.ts`'s `themeRef: ThemeRef & { kind: "actor" }` does
 * not compile unless `"actor"` is a real `ThemeKind` — and the cases below exercise the runtime
 * consequences (id derivation, the `neutral` fallback) that a widen must not break.
 */
describe("ThemeKind widen (story-scene S2)", () => {
  it("accepts `actor` and `scene` as theme kinds", () => {
    const actorRef: ThemeRef = { kind: "actor", id: "penny" };
    const sceneRef: ThemeRef = { kind: "scene", id: "rift-portal" };
    const kinds: ThemeKind[] = ["actor", "scene"];
    expect(actorRef.kind).toBe("actor");
    expect(sceneRef.kind).toBe("scene");
    expect(kinds).toContain("actor");
  });

  it("lets a real cast member's themeRef flow into the registry unmodified", () => {
    // This is the join that makes the widen matter: `ActorDefinition.themeRef` is typed against
    // `ThemeRef`, so `resolveTheme` accepts it without a cast. If the union lacked `"actor"`, the
    // production type would be `never` and this call would not compile.
    for (const id of ["penny", "dave"] as ActorId[]) {
      const def = actorDefinition(id);
      expect(themeIdFor(def.themeRef)).toBe(`actor.${id}`);
      // T11 registered the four packs, so this now resolves to the real actor pack rather than the
      // neutral fallback. Asserted as "resolves to its own pack" — a fixed themeId would break the
      // moment a pack is added or removed, which is the normal case.
      expect(resolveTheme(def.themeRef).themeId).toBe(`actor.${id}`);
    }
  });

  it("keeps every pre-existing kind (the widen is additive, not a replacement)", () => {
    // A widen can only ADD: assert the runtime consequence rather than a compile-time shape. The
    // pre-existing kinds still resolve through the same generic path, and the union grew by exactly
    // the two new arms (verified by the additive `git diff`, which is the real proof here — tests
    // are excluded from `tsc`, so a type-only assertion in this file would never be checked).
    expect(themeIdFor({ kind: "posture", id: "force" })).toBe("posture.force");
    expect(themeIdFor({ kind: "element", id: "fire" })).toBe("element.fire");
    expect(themeIdFor({ kind: "neutral", id: "neutral" })).toBe("neutral");
    const preExisting = [
      "element",
      "status-category",
      "resource",
      "action-category",
      "rarity",
      "side",
      "cook-tab",
      "bucket",
      "posture",
      "neutral"
    ] as const satisfies readonly ThemeKind[];
    for (const kind of preExisting) {
      const ref: ThemeRef = { kind, id: kind === "neutral" ? "neutral" : `${kind}-probe` };
      expect(lookupThemePack(ref)).toBeDefined();
    }
  });

  it("derives the pack id for an actor and a scene the same generic way", () => {
    // No special-casing: the registry composes `${kind}.${id}`, so widening the union is genuinely
    // additive and no consumer needed a new branch.
    expect(themeIdFor({ kind: "actor", id: "penny" })).toBe("actor.penny");
    expect(themeIdFor({ kind: "scene", id: "quarantine" })).toBe("scene.quarantine");
  });

  it("falls back to `neutral` for a ref that has no pack, rather than throwing", () => {
    // The fallback is the durable invariant, not "these particular refs are unregistered" — T11
    // registered the real packs, so the assertion uses ids that are deliberately unknown. A missing
    // pack must degrade to neutral paint, never an error and never an unlabelled blank.
    for (const ref of [
      { kind: "actor", id: "no-such-actor" },
      { kind: "scene", id: "no-such-scene" }
    ] as ThemeRef[]) {
      const pack = lookupThemePack(ref);
      expect(pack.themeId).toBe("neutral");
      const resolved = resolveTheme(ref);
      expect(resolved.themeId).toBe("neutral");
      expect(resolved.paint.accent).toBeTruthy();
    }
  });

  it("leaves the existing registered packs untouched", () => {
    // A widen must not disturb what already resolves. Spot-check one pack per pre-existing kind that
    // has one, so an accidental edit to the pack list is caught here.
    expect(lookupThemePack({ kind: "posture", id: "force" }).themeId).toBe("posture.force");
    expect(lookupThemePack({ kind: "side", id: "plant" }).themeId).toBe("side.plant");
    expect(lookupThemePack({ kind: "neutral", id: "neutral" }).themeId).toBe("neutral");
    expect(listThemePacks().length).toBeGreaterThan(0);
  });

  it("registers an actor or scene pack only when that kind actually has one", () => {
    // T10 widened the union and registered nothing; T11 added the four packs. The invariant that
    // survives both is *consistency*, not a fixed count: every `actor.*`/`scene.*` id in the list
    // must resolve to a real pack of that kind (no phantom entry), and a registered one must be
    // found by its ref. Pinning "none yet" would have made this test fail the moment T11 landed —
    // which is the correct-behaviour-changes case a guardrail must not encode.
    const ids = listThemePacks().map((p) => p.themeId);
    for (const id of ids.filter((i) => i.startsWith("actor.") || i.startsWith("scene."))) {
      const [kind, refId] = id.split(".") as [ThemeRef["kind"], string];
      expect(lookupThemePack({ kind, id: refId }).themeId).toBe(id);
    }
  });
});

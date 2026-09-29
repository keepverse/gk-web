import { describe, expect, it } from "vitest";
import type { ActorPhase } from "@/contract/types";
import { formatActorPhase } from "./shared";

/**
 * GG-23: an actor's lifecycle phase is player-facing copy, so no phase label may be an
 * engine-vocabulary word. `Retired` was the last leak — `vocabularyGuard` bans it outright,
 * and the label rendered verbatim next to an actor's name in `ActorRow`/`ActorCard`.
 *
 * The player word is **`Fallen`**, the label the repo already ships for this same phase in
 * `stages/delve/labels.ts` (`extractionOutcomeLabel`), rather than a second word invented here —
 * `Retired` has two writers (fusion consumption and delve permanent loss) and `formatActorPhase`
 * sees only the phase, so one word must read correctly for both.
 *
 * `Idle` is deliberately NOT asserted against its own enum name: it is ordinary English (the same
 * exemption `once`/`many` get in the guard's own list), so "Idle" → "Idle" is correct copy, not a
 * leak. The invariant that matters is that no label is a *banned* word.
 */
describe("formatActorPhase", () => {
  const ALL_PHASES: ActorPhase[] = ["ActiveBound", "ActiveUnbound", "Retired", "Idle"];

  it("labels a retired specimen with the shipped player word, not the enum's Retired", () => {
    expect(formatActorPhase("Retired")).toBe("Fallen");
  });

  it("never renders a GG-23 banned engine word as a phase label", () => {
    for (const phase of ALL_PHASES) {
      expect(formatActorPhase(phase)).not.toBe("Retired");
    }
  });

  it("agrees with the delve surface's own word for the same phase", () => {
    // stages/delve/labels.ts's extractionOutcomeLabel returns "Fallen" for its Retire outcome.
    // ui/ may not import a stage module, so the word is duplicated deliberately and pinned here.
    expect(formatActorPhase("Retired")).toBe("Fallen");
  });

  it("returns a non-empty label for every phase", () => {
    for (const phase of ALL_PHASES) {
      expect(formatActorPhase(phase).trim().length).toBeGreaterThan(0);
    }
  });

  it("keeps the three already-correct labels unchanged", () => {
    expect(formatActorPhase("ActiveBound")).toBe("Bound");
    expect(formatActorPhase("ActiveUnbound")).toBe("Unbound");
    expect(formatActorPhase("Idle")).toBe("Idle");
  });
});

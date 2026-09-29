import { useEffect } from "react";
import { registerGlobalVerb } from "@/shell/keymap";

export type WorldVerb = { key: string; id: string; handler: () => void };

/**
 * world-stage W78 (spec-world-turn.md §4, obligation 1) — the stage's single verb-registration
 * owner. Every world-stage global verb (the cycle-to-next key `W`, W80; the force-end hatch, W83,
 * once it has one) registers here and nowhere else, in one effect, so ordering is deterministic
 * rather than dependent on which component mounted first — the same shape
 * `SanctumStage.tsx:165-176` already established for the rail. No `try`/`catch` here: this module's
 * whole job is being the one owner, not swallowing a collision — that is a later caller's job, the
 * day this module actually registers a key a rebind can collide with.
 */
export function useWorldVerbs(verbs: readonly WorldVerb[]): void {
  useEffect(() => {
    const unregisters = verbs.map((verb) => registerGlobalVerb(verb.key, verb.id, verb.handler));
    return () => unregisters.forEach((unregister) => unregister());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verbs.map((verb) => verb.key + ":" + verb.id).join(",")]);
}

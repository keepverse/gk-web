import type { ActorPhase, ActorView } from "@/contract/types";
import type { Pending } from "@/contract/pending";
import { cn } from "@/lib/cn";

/** Player-facing label for an actor lifecycle phase.
 *
 * The wire enum's own words are engine vocabulary (GG-23): `vocabularyGuard` bans `Retired`
 * outright, because the enum name is not player copy.
 *
 * `Retired` has **two** real writers and this function only sees the phase, so the label must
 * read correctly for both:
 * - `RpgStore.Fusion.cs`'s `ConsumeSacrificesUnlocked` (a specimen consumed into a fusion,
 *   lineage `consumed-by`), and
 * - `RpgStore.Delve.cs`'s `SettlementOutcome.Retire` branch (permanent loss on delve extraction).
 *
 * `"Fallen"` is the repo's **existing** player word for that phase
 * (`stages/delve/labels.ts`'s `extractionOutcomeLabel` returns it for the same underlying state,
 * with its own note that the banned word is deliberately never rendered). Reusing it here keeps
 * one vocabulary across surfaces instead of inventing a second; it is not imported from
 * `stages/delve/` because `ui/` must not depend on a stage module.
 */
export function formatActorPhase(phase: ActorPhase): string {
  switch (phase) {
    case "ActiveBound":
      return "Bound";
    case "ActiveUnbound":
      return "Unbound";
    case "Retired":
      return "Fallen";
    case "Idle":
      return "Idle";
    default: {
      // Exhaustiveness: `ActorPhase` is a closed union and `adapt.ts`'s `toActorPhase` already
      // narrows an unrecognised wire value to "Idle" before it reaches the view, so this is
      // unreachable today. It must never fall back to the raw wire word (that is the leak this
      // task removes), and a widened union must fail the build rather than silently leak.
      const unhandled: never = phase;
      return unhandled;
    }
  }
}

/** Art is a registry concern that hasn't shipped yet (web/spec.md §1) — an initial stands in honestly rather than faking an icon. */
export function ActorFrame({
  side,
  initial,
  size = "row",
  testId
}: {
  side: ActorView["side"];
  initial: string;
  size?: "token" | "chip" | "row" | "card" | "panel";
  testId?: string;
}) {
  const sizeClass = {
    token: "h-5 w-5 text-xs",
    chip: "h-6 w-6 text-xs",
    row: "h-8 w-8 text-sm",
    card: "h-14 w-14 text-lg",
    panel: "h-[88px] w-[88px] text-2xl"
  }[size];
  return (
    <span
      data-testid={testId}
      data-side={side}
      className={cn(
        "flex flex-none items-center justify-center rounded-full border-2 font-display uppercase text-text",
        side === "plant" ? "border-side-plant bg-lawn/30" : "border-side-zombie bg-panel-raised",
        sizeClass
      )}
    >
      {initial}
    </span>
  );
}

export function SideBadge({ side }: { side: ActorView["side"] }) {
  return (
    <span
      data-testid="actor-side"
      className={cn(
        "inline-flex items-center gap-1 text-xs",
        side === "plant" ? "text-side-plant" : "text-side-zombie"
      )}
    >
      <i className={cn("h-1.5 w-1.5 rounded-full", side === "plant" ? "bg-side-plant" : "bg-side-zombie")} />
      {side === "plant" ? "Plant" : "Zombie"}
    </span>
  );
}

export function LevelTag({ level }: { level: number }) {
  return (
    <span className="rounded-sm border border-border-control px-1.5 py-0.5 text-xs text-muted" data-testid="actor-level">
      Lv {level}
    </span>
  );
}

/** The sealed-contract UX for a not-yet-servable field (game-gui-map.md's contract section): the
 * reason is rendered, not hidden — real, readable content, so `text-muted` (the kit's own
 * `--faint` token is decorative-only, never body text, and fails WCAG AA contrast on prose). */
export function PendingNote({ pending, testId }: { pending: Pending<unknown>; testId?: string }) {
  if (pending.state !== "pending") return null;
  return (
    <p className="text-xs italic text-muted" data-testid={testId}>
      {pending.reason}
    </p>
  );
}

export function displayInitial(name: Pending<string> | undefined, side: ActorView["side"]): string {
  if (name && name.state === "known" && name.value.length > 0) {
    return [...name.value][0]!.toUpperCase();
  }
  return side === "plant" ? "P" : "Z";
}

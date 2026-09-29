import type { ReactNode } from "react";
import type { PiecePayload } from "@/features/gui-lego/types";
import { themeStyle, vfxClass } from "@/ui/gui-lego/RecipeMount";
import "./actorPortrait.css";

/**
 * One actor in a slot array, carrying `speaking | inactive` state.
 *
 * Genre precedent for the state half: Dialogic's portrait subsystem updates the portrait on a
 * speaker change and applies highlight/unhighlight so the active speaker is visually distinguished.
 * That is exactly the `speaking` state here — a **state the piece reads**, not a CSS accident. And
 * the genre's own failure mode is the one this piece refuses: re-showing an image by tag silently
 * drops its attributes (Ren'Py's `show` replaces by tag), so variant continuity lives in the **fold**,
 * which passes `variantId` through untouched — this piece never computes, defaults, or resets one.
 *
 * ## The state is structural, never color alone
 *
 * Speaking is size + lift + ring weight + opacity (`data-speaking` hook, `.story-actor-portrait__lift`
 * vs `__settle`), so it survives a grayscale check. The inactive actor stays visible and
 * identifiable — dimmed, never hidden. Hiding the non-speaker is the failure the spec forbids: a
 * scene with two people must not blank one.
 *
 * ## Not a focus target
 *
 * Actors are decoration for focus purposes; the dialogue window owns focus. No `tabIndex`, no button
 * or link role — a keyboard user tabs to the window, never into the cast.
 *
 * ## Paint
 *
 * A registered factory gets **no** theme from `RecipeMount` (it applies `themeStyle`/`vfxClass` only
 * on the factory-free path), so this factory applies both to its own landmark root. Paint comes from
 * the actor's pack; this file carries no hex and no identity utility class.
 */

type ActorPortraitPayload = PiecePayload & {
  actorId: string;
  /** Whether this actor holds the current line. Read, never computed. */
  speaking: boolean;
  variantId?: string;
};

type ActorPortraitSlots = {
  /** The sprite node, already resolved by the fold (which also owns `variantId` continuity). */
  body?: ReactNode;
};

export function actorPortraitFactory({
  payload,
  slots
}: {
  payload: PiecePayload;
  slots: Record<string, ReactNode>;
  bus: unknown;
}) {
  return <ActorPortrait payload={payload as ActorPortraitPayload} slots={slots as ActorPortraitSlots} />;
}

function ActorPortrait({
  payload,
  slots
}: {
  payload: ActorPortraitPayload;
  slots: ActorPortraitSlots;
}) {
  const style = themeStyle(payload);
  const vfx = vfxClass(payload);
  // `speaking` is a strict boolean read: anything non-true settles. The fold owns the value; this
  // piece only renders it.
  const speaking = payload.speaking === true;

  return (
    <div
      className={["story-actor-portrait", vfx].filter(Boolean).join(" ")}
      style={style}
      data-speaking={speaking ? "true" : "false"}
    >
      {/* No aria-hidden here: the sprite owns its own semantics (art is decorative with alt="",
          the fallback carries a labelled role="img"), and hiding this wrapper would silence the
          fallback's name for a screen reader. */}
      <div className={speaking ? "story-actor-portrait__lift" : "story-actor-portrait__settle"}>
        {slots.body ?? null}
      </div>
    </div>
  );
}

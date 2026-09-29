import { useState } from "react";
import type { PiecePayload } from "@/features/gui-lego/types";
import { themeStyle, vfxClass } from "@/ui/gui-lego/RecipeMount";
import "./actorSprite.css";

/**
 * An actor's sprite — or an **honest labelled shape** carrying the actor's name when the art (or the
 * requested variant) is missing.
 *
 * Owner decision 2, and the replacement for a specific bug: the old fallback was one `◈` glyph plus one
 * shared manifest label for every actor (`RiftPrologueDialog.tsx:170-174`), so two missing actors were
 * identical and the fallback said nothing to the player or the developer.
 *
 * Genre precedent for a labelled shape rather than a nicer blank — Ren'Py's `Placeholder`
 * (`renpy/common/00placeholder.rpy`) draws a stand-in body with the image name written on it and
 * `config.missing_image_callback` is its documented failure hook; Dialogic's `get_portrait_info`
 * degrades a missing portrait to the character's default. Community practice extends it precisely
 * because a shared stand-in conflates people.
 *
 * ## Composing `ActorFrame`'s language without inheriting its faction axis
 *
 * `ui/actor/shared.tsx`'s `ActorFrame` draws an initialed disc, but it **requires** a `side` prop and
 * tints `border-side-plant`/`border-side-zombie` by it (`:68`). Penny and Dave are neither a plant nor
 * a zombie, so this piece composes the *visual language* (an initial in a bordered disc, uppercase,
 * `font-display`) and takes its paint from the actor's pack instead. It deliberately does **not**
 * render `ActorFrame` — that would mean passing a `side` the actor does not have — and it does not
 * restyle `ActorFrame`, which other surfaces depend on.
 *
 * ## Paint
 *
 * A registered factory gets **no** theme from `RecipeMount` (it applies `themeStyle`/`vfxClass` only
 * on the factory-free path, `RecipeMount.tsx:43-44`), so this factory applies both to its own landmark
 * root. That is why the accent arrives as a css custom property rather than a literal here.
 */

/** The subset of the payload this piece reads. */
type ActorSpritePayload = PiecePayload & {
  actorId: string;
  displayName: string;
  initial: string;
  variantId?: string;
  spriteUrl: string | null;
  /**
   * Host-resolved chrome for the placeholder (see `STORY_SCENE_PIECE_LABELS`).
   *
   * Both are resolved by the host and carried here because this piece renders **payload text
   * verbatim** and holds no player string: the hint line and the accessible label used to be
   * hard-coded English, which no locale could change — the defect `spec-localization.md`'s success
   * criterion 2 names, found only once the pseudo-locale render existed.
   *
   * `hintLabel` absent ⇒ no hint span (nothing English takes its place). `spriteLabel` absent ⇒ the
   * display name, which the host has already localized, so a labelled `role="img"` is never empty.
   */
  hintLabel?: string;
  spriteLabel?: string;
};

export function actorSpriteFactory({ payload }: { payload: PiecePayload; slots: unknown; bus: unknown }) {
  return <ActorSprite payload={payload as ActorSpritePayload} />;
}

function ActorSprite({ payload }: { payload: ActorSpritePayload }) {
  // A runtime load failure is terminal: once the art has failed, the placeholder is the honest state,
  // so a broken URL can never paint a broken-image glyph.
  const [loadFailed, setLoadFailed] = useState(false);

  const style = themeStyle(payload);
  const vfx = vfxClass(payload);
  const displayName = typeof payload.displayName === "string" ? payload.displayName.trim() : "";
  const hint = typeof payload.hintLabel === "string" ? payload.hintLabel.trim() : "";
  // The resolved name is the honest last resort: it is already localized, so the shape stays
  // labelled as a whole even when a caller predates the label field.
  const placeholderName =
    typeof payload.spriteLabel === "string" && payload.spriteLabel.trim().length > 0
      ? payload.spriteLabel.trim()
      : displayName;
  // `trim()` and not just a length check: a whitespace-only string would otherwise render
  // `<img src="   ">`, which is a broken image in all but name. Today `actorCast` yields only `null`
  // or a real URL, so this is defensive — but the rule is "never an <img> with an unresolved src".
  const hasArt =
    typeof payload.spriteUrl === "string" &&
    payload.spriteUrl.trim().length > 0 &&
    !loadFailed;

  return (
    <div className={["story-actor-sprite", vfx].filter(Boolean).join(" ")} style={style}>
      {hasArt ? (
        <img
          className="story-actor-sprite__art"
          src={payload.spriteUrl as string}
          // Decorative: the dialogue line carries the meaning, so the art is hidden from a screen
          // reader rather than described twice.
          alt=""
          aria-hidden="true"
          onError={() => setLoadFailed(true)}
        />
      ) : (
        <div
          className="story-actor-sprite__placeholder"
          role="img"
          aria-label={placeholderName}
        >
          <span className="story-actor-sprite__initial" aria-hidden="true">
            {payload.initial}
          </span>
          <span className="story-actor-sprite__name">{displayName}</span>
          {hint.length > 0 ? <span className="story-actor-sprite__hint">{hint}</span> : null}
        </div>
      )}
    </div>
  );
}

import type { PiecePayload } from "@/features/gui-lego/types";
import { themeStyle, vfxClass } from "@/ui/gui-lego/RecipeMount";
import "./nameTag.css";

/**
 * The current speaker's label, painted by the **actor's pack**.
 *
 * ## The bug this replaces
 *
 * `features/onboarding/RiftPrologueDialog.tsx` rendered the speaker as
 * `<p className="… text-ok">{beat.speaker}</p>` — two defects in one line. The colour was a
 * hard-coded utility class, which is the same defect as a hard-coded hex: speaker identity is paint
 * and paint belongs to a pack. And `beat.speaker` was a free string that could not tell an actor from
 * a synthetic label.
 *
 * ## Absence is the contract for narration
 *
 * A narration beat renders **no** name-tag: not an empty tag, not a placeholder name, not a fake
 * "Narrator". Ren'Py's say screen behaves the same way — the `who` text appears only when a character
 * spoke, and a single-argument say is narration (`config.character_id_prefixes` exists precisely
 * because the namebox is a separate, optional region).
 *
 * The fold omits the payload entirely when a beat has no `speakerId`; this piece guards as well, so an
 * upstream mistake cannot ship an empty tag. That is why an empty `displayName` returns `null` rather
 * than an empty element.
 *
 * ## Paint
 *
 * A registered factory gets **no** theme from `RecipeMount` (it applies `themeStyle`/`vfxClass` only
 * on the factory-free path), so this factory applies both to its own landmark root. The uppercase
 * treatment and the accent are the **pack's** business — a later scene can restyle the tag without
 * touching this file.
 *
 * The rendered pair is **accent text on a 12% accent wash**, which is the shipped chip convention and
 * the only treatment reachable through `themeStyle`: that helper spreads a pack's `css` block only and
 * never `paint`, so `paint.onAccent` cannot arrive as a variable. Computed contrast for the rendered
 * pair (WCAG 2.1): 6.66:1 (Penny, portal) / 6.33 (Penny, quarantine) / 6.58 (Dave, portal) / 6.29
 * (Dave, quarantine) — all AA. The packs' muted accents fail AA (4.06 / 3.93 / 3.70 / 3.59), so the
 * name is never painted muted. `nameTag.css` carries the same table.
 */

type NameTagPayload = PiecePayload & {
  displayName: string;
};

export function nameTagFactory({ payload }: { payload: PiecePayload; slots: unknown; bus: unknown }) {
  return <NameTag payload={payload as NameTagPayload} />;
}

function NameTag({ payload }: { payload: NameTagPayload }) {
  const displayName = typeof payload.displayName === "string" ? payload.displayName.trim() : "";
  // Absence, not an empty tag: an upstream mistake must not be able to ship a blank nameplate.
  if (displayName.length === 0) return null;

  const style = themeStyle(payload);
  const vfx = vfxClass(payload);

  return (
    <div className={["story-name-tag", vfx].filter(Boolean).join(" ")} style={style}>
      <span className="story-name-tag__label">{displayName}</span>
    </div>
  );
}

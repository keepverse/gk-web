import type { ReactNode } from "react";
import type { PiecePayload } from "@/features/gui-lego/types";
import { themeStyle, vfxClass } from "@/ui/gui-lego/RecipeMount";
import "./dialogueWindow.css";

/**
 * The say window: the speaker's line, an optional teaching sentence, and the narration variant.
 *
 * It owns **readability**, not colour — the `name-tag` it hosts owns the speaker's identity paint.
 *
 * ## Why the window and the tag are separate
 *
 * Ren'Py's say screen is a `window` containing the `who` text and the line, and its GUI gives the
 * speaker region its own id (`namebox`) precisely because that region is a **separate, optional**
 * thing. Dialogic likewise separates the character label from the dialogue viewport. So a narration
 * beat is the **same window** with the `nameTag` slot empty — never a second component and never a
 * fake speaker.
 *
 * ## The rules this encodes
 *
 * - **The line is the live region, and only the line.** The fragment being replaced wrapped the whole
 *   window in `aria-live`, which re-announced the speaker and the teaching sentence on every beat.
 * - **A text wall is unrepresentable.** One line plus at most one teaching sentence: the payload type
 *   has `line: string` and the piece reads no array, so there is no paragraph shape to author. An
 *   over-long script is caught by `scene-script`'s beat cap, not absorbed here as pagination or
 *   scroll.
 * - **A line is never truncated.** A truncated dialogue line is a defect, not a design choice.
 *
 * ## Paint
 *
 * A registered factory gets no theme from `RecipeMount` (it applies `themeStyle`/`vfxClass` only on the
 * factory-free path), so this factory applies both to its own landmark root.
 */

type DialogueWindowPayload = PiecePayload & {
  line: string;
  teaching?: string;
  narration: boolean;
};

export function dialogueWindowFactory({
  payload,
  slots
}: {
  payload: PiecePayload;
  slots: Record<string, ReactNode>;
  bus: unknown;
}) {
  return <DialogueWindow payload={payload as DialogueWindowPayload} slots={slots} />;
}

function DialogueWindow({
  payload,
  slots
}: {
  payload: DialogueWindowPayload;
  slots: Record<string, ReactNode>;
}) {
  const style = themeStyle(payload);
  const vfx = vfxClass(payload);
  const rootClass = ["story-dialogue-window", vfx].filter(Boolean).join(" ");

  // Whitespace is not content: an empty teaching paragraph would space the window for nothing.
  const teaching = typeof payload.teaching === "string" ? payload.teaching.trim() : "";
  // The fold omits the slot on narration; guard here too so an upstream mistake cannot print a
  // speaker's name over a line no one spoke.
  const nameTag = payload.narration ? null : (slots.nameTag ?? null);

  return (
    <div className={rootClass} style={style} data-narration={payload.narration ? "true" : "false"}>
      {nameTag ? <div className="story-dialogue-window__nameTag">{nameTag}</div> : null}
      {/* The live region is this element alone. */}
      <p className="story-dialogue-window__line" aria-live="polite">
        {payload.line}
      </p>
      {teaching.length > 0 ? <p className="story-dialogue-window__teaching">{teaching}</p> : null}
    </div>
  );
}

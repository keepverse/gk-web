import type { CSSProperties } from "react";
import type { PiecePayload, SurfaceBusLike } from "@/features/gui-lego/types";
import { Button } from "@/ui/Button";
import { themeStyle, vfxClass } from "@/ui/gui-lego/RecipeMount";
import { STORY_SCENE_TOUCH_TARGET_MIN_PX } from "@/ui/story-scene/storySceneTokens";
import "./advanceControl.css";

/**
 * Both verbs of a scene — advance and skip — plus their pending and error states, in one piece.
 *
 * It replaces a raw footer fragment that lived inline in the consumer's JSX, including an inline
 * error-recovery branch, so a scene never hand-rolls a footer and a second scene cannot fork a
 * different one.
 *
 * ## The rules this encodes
 *
 * - **Skip is present on every beat, including the last** (owner decision 5). No first-scene nudge and
 *   no confirmation: the narrative source's own rule is that *"skipping never loses Souls, grants,
 *   content, or future story access"*, so gating it would be dishonest, and GG-52 makes a seen thing
 *   dismissible.
 * - **One terminal path.** Advance and skip emit distinct events, but the **host** derives the outcome
 *   from the beat index, so `finish(outcome)` stays a single code path for watched and skipped alike.
 *   A skip that merely stops the sequence is the failure practitioners name as a softlock.
 * - **Pending disables both verbs** and the primary shows the in-flight label — the visible half of the
 *   double-click guard.
 * - **Error is a variant, not a fork.** When the acknowledgement fails, the piece offers retry and a
 *   bypass, and the bypass always works, so a failed save is never a dead end.
 * - **No keybinding.** Enter/Space advance is handled by the stage on the focused body; a piece-level
 *   global listener would be a second, invisible input path, and the keymap owns verbs — including
 *   the injector's reserved hotkey, which `keymapGuard` polices across the tree.
 *
 * ## Emit, don't act
 *
 * The verbs go onto the surface's **closed bus** (`story-scene.advance` / `.skip` / `.ack.retry` /
 * `.ack.bypass`), matching the shipped pieces' convention and the recipe-wire rule that pieces never
 * fetch and never call a mutation directly.
 *
 * ## Paint
 *
 * A registered factory gets no theme from `RecipeMount` (it applies `themeStyle`/`vfxClass` only on the
 * factory-free path), so this factory applies both to its own landmark root.
 */

type AdvanceControlPayload = PiecePayload & {
  isLastBeat: boolean;
  nextLabel: string;
  finalLabel: string;
  skipLabel: string;
  pendingLabel: string;
  pending: boolean;
  error?: boolean;
  retryLabel?: string;
  bypassLabel?: string;
  ackFailedLabel?: string;
  /**
   * Optional accessible name for the primary verb, mirroring the label logic: pending shows
   * pendingTitle, otherwise primaryTitle. Absent by default — the scene host never needed one,
   * and an untitled button stays untitled. Added for the one-beat reveal adoption (T26), whose
   * saved-state explanation ("Saving reward…") the owning suite pins on the button itself.
   *
   * There is deliberately **no** English fallback: this piece once used `"Working…"` when the
   * pending title was absent, which contradicted the sentence above and put an unlocalizable string
   * on the scene's button. Absent now means untitled, exactly as documented. Found by the
   * pseudo-locale render (`spec-localization.md` success criterion 2).
   */
  primaryTitle?: string;
  pendingTitle?: string;
};

export const ADVANCE_EVENTS = {
  advance: "story-scene.advance",
  skip: "story-scene.skip",
  retry: "story-scene.ack.retry",
  bypass: "story-scene.ack.bypass"
} as const;

export function advanceControlFactory({
  payload,
  bus
}: {
  payload: PiecePayload;
  slots: unknown;
  bus: SurfaceBusLike;
}) {
  return <AdvanceControl payload={payload as AdvanceControlPayload} bus={bus} />;
}

function AdvanceControl({ payload, bus }: { payload: AdvanceControlPayload; bus: SurfaceBusLike }) {
  const style: CSSProperties = {
    ...(themeStyle(payload) ?? {}),
    // One home for the target-size floor: the token module exports it, the CSS consumes the property.
    "--story-touch-target-min": `${STORY_SCENE_TOUCH_TARGET_MIN_PX}px`
  } as CSSProperties;
  const vfx = vfxClass(payload);
  const rootClass = ["story-advance-control", vfx].filter(Boolean).join(" ");

  // A disabled button cannot fire, but guard the emit too: the double-click guard's visible half is
  // only trustworthy if the invisible half agrees.
  const emit = (event: string) => {
    if (payload.pending) return;
    bus.emit(event, {});
  };

  if (payload.error) {
    // The error variant replaces the normal footer rather than adding to it — two competing terminal
    // paths would be worse than one that always works.
    return (
      <div className={rootClass} style={style} data-error="true">
        <p className="story-advance-control__recovery" role="status">
          {payload.ackFailedLabel}
        </p>
        <div className="story-advance-control__row">
          <Button variant="ghost" size="sm" onClick={() => emit(ADVANCE_EVENTS.bypass)}>
            {payload.bypassLabel}
          </Button>
          <Button size="sm" onClick={() => emit(ADVANCE_EVENTS.retry)}>
            {payload.retryLabel}
          </Button>
        </div>
      </div>
    );
  }

  const primaryLabel = payload.pending
    ? payload.pendingLabel
    : payload.isLastBeat
      ? payload.finalLabel
      : payload.nextLabel;
  const primaryTitle = payload.pending ? payload.pendingTitle : payload.primaryTitle;

  return (
    <div className={rootClass} style={style} data-pending={payload.pending ? "true" : undefined}>
      {/* Always present, on every beat including the last. */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => emit(ADVANCE_EVENTS.skip)}
        disabled={payload.pending}
        title={payload.pending ? payload.pendingTitle : undefined}
      >
        {payload.skipLabel}
      </Button>
      <Button
        size="sm"
        onClick={() => emit(ADVANCE_EVENTS.advance)}
        disabled={payload.pending}
        title={primaryTitle}
      >
        {primaryLabel}
      </Button>
    </div>
  );
}

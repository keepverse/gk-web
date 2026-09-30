import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import type { PiecePayload, SurfaceBusLike } from "@/features/gui-lego/types";
import { themeStyle, vfxClass } from "@/ui/gui-lego/RecipeMount";
import { prefersReducedMotion } from "@/features/story-scene/storyCue";
import type { StoryCueId } from "@/features/story-scene/sceneScript";
import { ADVANCE_EVENTS } from "./advanceControl";
import storySceneUi from "@gk-core/data/tuning/story-scene-ui.v1.json";
import "./sceneStage.css";

/**
 * The compose root: the full-bleed art bed, band-utility stacking, the cue state the whole scene
 * reads, and the two-actor responsive layout.
 *
 * It owns **composition and geometry**. It does **not** own actor identity (the fold passes actors),
 * copy (title/subtitle arrive as player text, never ids), or paint (the scene pack's).
 *
 * ## Stacking without tiers
 *
 * All layering is band utilities and document order — **no `z-index`, no `z-*` class** anywhere in
 * this piece. That is the fix for the shipped defect it replaces, and `bandGuard` enforces it on the
 * real tree.
 *
 * ## Collapse, not hiding
 *
 * At ≥720px the cast sits side by side; below it the cast **stacks**, speaker-forward, and the art
 * bed scales down — never the window, never the advance control, and never by hiding an actor. An
 * unreachable advance control would trap the player in a scene, so the bed yields first. The
 * breakpoint lives in CSS (`@media (max-width: 719px)`), where layout belongs; the fold orders the
 * array with the speaker first.
 *
 * ## Motion
 *
 * The beat transition and any sprite swap are instant under `prefers-reduced-motion: reduce`. The
 * root carries `data-motion="instant"|"animated"` (read once, from the same OS preference the CSS
 * media query enforces in browsers) so the branch is testable in jsdom, which cannot evaluate media
 * queries.
 *
 * ## Paint
 *
 * A registered factory gets **no** theme from `RecipeMount` (it applies `themeStyle`/`vfxClass` only
 * on the factory-free path), so this factory applies both to its own landmark root.
 */

type SceneStagePayload = PiecePayload & {
  /** For tests/diagnostics only — never rendered (asserted). */
  sceneId: string;
  /** Drives `data-cue`; the FE's own rendering contract, never an engine handle. */
  cueId: StoryCueId | null;
  /** Shell title and subtitle: player-facing text, passed through untouched. */
  title: string;
  subtitle?: string;
};

type SceneStageSlots = {
  /** Ordered actor nodes, speaker-first. 1..n; two is the v1 floor. */
  actors?: ReactNode | ReactNode[];
  window?: ReactNode;
  progress?: ReactNode;
  advance?: ReactNode;
};

export function sceneStageFactory({
  payload,
  slots,
  bus
}: {
  payload: PiecePayload;
  slots: Record<string, ReactNode>;
  bus: SurfaceBusLike;
}) {
  return (
    <SceneStage payload={payload as SceneStagePayload} slots={slots as SceneStageSlots} bus={bus} />
  );
}

function asArray(node: ReactNode | ReactNode[] | undefined): ReactNode[] {
  if (node === undefined || node === null) return [];
  return Array.isArray(node) ? node : [node];
}

// NOTE on keys: the array is rendered directly, with no wrapper element per item, so each actor
// node's own key (set by whoever composed the array, e.g. the fold keying by actor id) drives
// reconciliation. An index-keyed wrapper here would pin DOM nodes positionally and swap actors'
// rendered content on a speaker reorder — the same class of bug as a variant reset.

function SceneStage({
  payload,
  slots,
  bus
}: {
  payload: SceneStagePayload;
  slots: SceneStageSlots;
  bus: SurfaceBusLike;
}) {
  const style = themeStyle(payload);
  const vfx = vfxClass(payload);
  const actors = asArray(slots.actors);
  // The window carries the line, so when it is present the art bed is decorative and hidden from
  // a screen reader rather than described twice.
  const hasWindow = slots.window !== undefined && slots.window !== null;
  const motion = prefersReducedMotion() ? "instant" : "animated";

  // The beat cross-fade length is read from the tuning file, never written as a literal (gap G3).
  // The import is version-pinned (`story-scene-ui.v1.json`), so a rebalance writes v2 and this
  // keeps reading v1 until a deliberate migration — no silent drift. When the key is absent the
  // duration is simply unset (CSS default applies); there is no fallback literal to go stale.
  const beatTransitionMs: unknown = (storySceneUi as { scene?: { beatTransitionMs?: unknown } })
    .scene?.beatTransitionMs;
  const artStyle: CSSProperties | undefined =
    typeof beatTransitionMs === "number" && Number.isFinite(beatTransitionMs) && beatTransitionMs >= 0
      ? { transitionDuration: `${beatTransitionMs}ms` }
      : undefined;

  // The dialogue window is the focus target when the scene opens. A ref callback (not autoFocus)
  // so jsdom and SSR stay honest, and exactly-once via the ref nulling on unmount.
  const windowRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    windowRef.current?.focus({ preventScroll: true });
  }, []);

  // Enter/Space advance lives here and only here (gap G4): the stage is the key handler, actors
  // are not focus targets, and no global listener exists. It preserves the shipped contract
  // (`RiftPrologueDialog.tsx:159-164`) — the key fires only when focus is inside the scene but NOT
  // on an interactive element, so a focused Next/Skip button keeps its native key behavior instead
  // of double-firing. F10 stays forbidden (`keymap.ts:18`); this handler never sees it.
  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key !== "Enter" && event.key !== " ") return;
    const target = event.target as HTMLElement | null;
    if (target?.closest?.("button, a, input, select, textarea, [contenteditable]")) return;
    event.preventDefault();
    bus.emit(ADVANCE_EVENTS.advance);
  }

  return (
    <div
      className={["story-scene-stage", vfx].filter(Boolean).join(" ")}
      style={style}
      data-cue={payload.cueId ?? undefined}
      data-motion={motion}
      onKeyDown={onKeyDown}
    >
      <div className="story-scene-stage__backdrop" aria-hidden="true" />
      <div className="story-scene-stage__heading">
        <span className="story-scene-stage__title">{payload.title}</span>
        {typeof payload.subtitle === "string" && payload.subtitle.length > 0 ? (
          <span className="story-scene-stage__subtitle">{payload.subtitle}</span>
        ) : null}
      </div>
      <div
        className="story-scene-stage__art"
        aria-hidden={hasWindow ? "true" : undefined}
        style={artStyle}
      />
      {/* Direct children, no wrapper per item: the draft forbids convenience wrappers (child
          combinators), and index keys would pin nodes positionally across a speaker reorder. */}
      <div className="story-scene-stage__actors">{actors}</div>
      {slots.window !== undefined && slots.window !== null ? (
        // tabIndex -1: focusable programmatically but never in the tab order — the window is where
        // focus lands on open, and Tab then moves to the advance control, never into the cast.
        <div className="story-scene-stage__window" ref={windowRef} tabIndex={-1}>
          {slots.window}
        </div>
      ) : null}
      {slots.progress !== undefined && slots.progress !== null ? (
        <div className="story-scene-stage__progress">{slots.progress}</div>
      ) : null}
      {slots.advance !== undefined && slots.advance !== null ? (
        <div className="story-scene-stage__advance">{slots.advance}</div>
      ) : null}
    </div>
  );
}

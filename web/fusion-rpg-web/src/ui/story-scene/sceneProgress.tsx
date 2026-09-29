import type { PiecePayload } from "@/features/gui-lego/types";
import { themeStyle, vfxClass } from "@/ui/gui-lego/RecipeMount";
import "./sceneProgress.css";

/**
 * Where the player is in the scene — beat `n of m` — as pips plus an accessible label.
 *
 * It replaces an inline span that assembled its own `Beat ${beatIndex + 1} of ${BEATS.length}` string,
 * which put the wording inside a component and pinned the total to a constant the component could see.
 *
 * ## Rules
 *
 * - **The label is authored by the fold and rendered verbatim.** The piece assembles no string, so
 *   there is one place to translate and one place to test.
 * - **`total` is the script's own length**, taken from the payload — never a hard-coded constant, and
 *   never asserted as a population count (a guardrail pins contracts and closed enums, not how many
 *   beats a scene happens to have).
 * - **A one-beat scene renders nothing.** A reveal is a one-beat scene (decision 4), so this piece must
 *   not invent a "1 of 1" state for it to render.
 * - **Nothing is persisted.** Beat position is session UI state: if the tab closes before
 *   acknowledgement, the next presentation starts at beat 1, so touching storage here would contradict
 *   that.
 *
 * ## Paint
 *
 * A registered factory gets no theme from `RecipeMount` (it applies `themeStyle`/`vfxClass` only on the
 * factory-free path), so this factory applies both to its own landmark root.
 */

type SceneProgressPayload = PiecePayload & {
  index: number;
  total: number;
  label: string;
  showPips?: boolean;
};

export function sceneProgressFactory({
  payload
}: {
  payload: PiecePayload;
  slots: unknown;
  bus: unknown;
}) {
  return <SceneProgress payload={payload as SceneProgressPayload} />;
}

function SceneProgress({ payload }: { payload: SceneProgressPayload }) {
  const total = Number.isFinite(payload.total) ? payload.total : 0;
  // One beat is not a sequence: render nothing rather than a meaningless "1 of 1".
  if (total <= 1) return null;

  const style = themeStyle(payload);
  const vfx = vfxClass(payload);
  const showPips = payload.showPips !== false;

  return (
    <div className={["story-scene-progress", vfx].filter(Boolean).join(" ")} style={style}>
      {showPips ? (
        <span className="story-scene-progress__pips" aria-hidden="true">
          {Array.from({ length: total }, (_, i) => (
            <i
              key={i}
              className="story-scene-progress__pip"
              // The current pip is marked here and elongated in CSS, so the position reads without
              // relying on colour alone.
              data-current={i === payload.index ? "true" : undefined}
            />
          ))}
        </span>
      ) : null}
      {/*
        The accessible name mirrors the text: the shipped dialog exposed the position as a
        labelled span (`aria-label="Beat n of m"`), and a screen-reader player needs the same
        announcement from the piece. The label arrives fold-authored and translated; the piece
        only repeats it as the name, never assembles wording.
      */}
      <span className="story-scene-progress__label" aria-label={payload.label}>
        {payload.label}
      </span>
    </div>
  );
}

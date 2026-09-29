/**
 * Literal chart-paint constants — the one legitimate place a `#rrggbb` value may live outside a raw
 * design token (`hexGuard.test.ts`'s own rule: "no hex colour literal exists outside src/theme/").
 *
 * Every constant here feeds a **recharts-animated fill/stroke or a hand-rolled SVG `<path>`/`<circle>`
 * fill**, never a plain DOM `style`/CSS declaration — those two rendering paths are cited, dated
 * exceptions to "always reference a `--color-*` token", not an oversight:
 *
 * - `docs/architecture/gui-lego/spec-standing-radar.md` ("Fields" row for `axes[].paint`, and its own
 *   success-criteria checkbox): "paint hex (no `fill=\"var(--x)\"` alone)" / "hex literals OK until
 *   theme packs for Standing" — recharts' `<Radar isAnimationActive>` interpolates `fill`/`stroke`
 *   through d3's colour scale, which needs a real parseable colour, not a `var()` reference.
 * - `ui/gui-lego/pieces/domain.tsx`'s own `donutPathsFromSlices` doc comment: "Arc paths from
 *   contribution slices — paint hex only (never CSS var fills)" — the donut's hand-drawn `<path>`
 *   arcs and its static track/hole `<circle>`s follow the identical rule.
 *
 * These values were previously inline literals in `foldConditionSurfaceVm.ts`, `foldPresetConsoleVm.ts`
 * and `ui/gui-lego/pieces/{domain,condition,aptitude,StandingRadarChart}.tsx` (pre-existing, part of
 * the 2026-09-09/10/13 gui-lego build) — relocated here unchanged (same hex, same rendered pixels) so
 * every consumer imports a literal instead of hand-typing one, and `src/theme/` stays the single place
 * `scanForHexLiterals` need not walk.
 */

/** `docs/design/gui-lego/pieces/standing-radar.html`'s five Standing axes, in `StandingSurfaceVm`
 * order — `STANDING_AXES` in `foldConditionSurfaceVm.ts`. */
export const STANDING_AXIS_PAINT = {
  offense: "#d98787",
  survivability: "#6dbb63",
  control: "#b48ae6",
  utility: "#7fb4ff",
  economy: "#e0b44b"
} as const;

/** Fallback stroke/fill for the Standing radar's `<Radar>` when no axis paint is available yet
 * (`StandingRadarChart.tsx`'s `axes[0]?.paint ?? …`). Same value as `STANDING_AXIS_PAINT.economy`. */
export const STANDING_RADAR_FALLBACK_PAINT = STANDING_AXIS_PAINT.economy;

/** The aptitude-preset donut's twelve-slot palette (`foldPresetConsoleVm.ts`'s `DONUT_PAINT`) —
 * cycled with `%` when a preset carries more rows than colours. */
export const APTITUDE_PRESET_DONUT_PAINT: readonly string[] = [
  "#c45c26",
  "#8b4513",
  "#d4a017",
  "#6b8e23",
  "#4682b4",
  "#5c6bc0",
  "#8e4585",
  "#a0522d",
  "#2e8b57",
  "#cd853f",
  "#708090",
  "#b8860b"
];

/** Neutral default when a caller's contribution/segment row carries no `paint` of its own —
 * shared by `pieces/aptitude.tsx`, `pieces/condition.tsx` (Standing axis rows) and
 * `pieces/domain.tsx` (donut slices / stack bars). */
export const CHART_NEUTRAL_PAINT = "#8a8070";

/** `pieces/domain.tsx`'s `gaugeDonutFactory` — the donut's static track (background ring) and hole,
 * drawn once per mount, never data-driven. */
export const DONUT_TRACK_FILL = "#1e1a14";
export const DONUT_TRACK_STROKE = "#3a342c";
export const DONUT_HOLE_FILL = "#2a241c";

import type { LoamFigureProps } from "./LoamFigure";
import type { PerMilleFigureProps } from "./PerMilleFigure";
import type { BandFigureProps } from "./BandFigure";
import type { Magnitude } from "@/contract/types";

/**
 * world-numbers W39 — compile-only proof, not a runtime test (same shape as
 * `contract/worldViews.typecheck.ts`). `*.test.ts` files are excluded from `tsconfig.json`'s scope,
 * so a `@ts-expect-error` inside one is never actually checked; this plain module is covered by
 * `npm run build`'s `tsc --noEmit` pass. No runtime behaviour — every binding exists only so a real
 * type error becomes a real build failure (GG-46: no figure ever accepts a bare `number`).
 */

const mag: Magnitude = { unit: "loamUnits", value: 200 };

// @ts-expect-error — LoamFigure's stock arm wants `amount: Magnitude`, not a bare number.
const badLoamStock: LoamFigureProps = { kind: "stock", amount: 200, capacity: { state: "absent" } };
void badLoamStock;

// @ts-expect-error — LoamFigure's flow arm wants `amount: Magnitude` too.
const badLoamFlow: LoamFigureProps = { kind: "flow", amount: -22, period: "per turn" };
void badLoamFlow;

// @ts-expect-error — PerMilleFigure never accepts a bare number for `value`.
const badPerMille: PerMilleFigureProps = { reading: "hold", value: 720 };
void badPerMille;

// @ts-expect-error — BandFigure's index must be a Magnitude.
const badBandIndex: BandFigureProps = { index: 3, ceiling: mag, label: "Danger" };
void badBandIndex;

// @ts-expect-error — BandFigure's ceiling must be a Magnitude too — the denominator is never a
// bare number either, or the whole point of "an index with its denominator" is lost.
const badBandCeiling: BandFigureProps = { index: mag, ceiling: 5, label: "Danger" };
void badBandCeiling;

// The legal shapes compile with no directive at all — proves the props aren't just both
// permissive (which would make the five errors above meaningless).
const okLoamStock: LoamFigureProps = { kind: "stock", amount: mag, capacity: { state: "absent" } };
void okLoamStock;
const okBand: BandFigureProps = { index: mag, ceiling: mag, label: "Danger" };
void okBand;

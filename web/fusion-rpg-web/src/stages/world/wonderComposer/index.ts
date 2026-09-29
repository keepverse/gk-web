import { lazy } from "react";

/**
 * empire-wonder-surfaces `wonder-composer` (plan Task 4D.3) — route-split
 * entry. The composer (fold + closed bus + panel + copy catalog) ships in
 * its own chunk behind `React.lazy`, never on the entry chunk (bundle
 * budget: `npm run check:bundle` — the 4D.1 `LegionSheetLazy` precedent).
 * No static importer outside this directory pulls the composer in; the
 * world stage mounts it through this entry beside the sector-inspector
 * dock when a sector is held open for building.
 */
export const WonderComposerLazy = lazy(() =>
  import("./WonderComposer").then((m) => ({ default: m.WonderComposer }))
);

export { WonderComposer, WonderComposerContent } from "./WonderComposer";
export type { WonderComposerCallbacks } from "./WonderComposer";
export { WONDER_COMPOSER_COPY, wonderComposerCopy, wonderCapLine, wonderCountLine, wonderFoundationLine, wonderNightsLine } from "./copyCatalog";

import { lazy } from "react";

/**
 * empire-inventory-surfaces `legion-sheet` (plan Task 4D.1) — route-split
 * entry. The sheet (host + cargo tab + bus + copy catalog) ships in its own
 * chunk behind `React.lazy`, never on the entry chunk (bundle budget:
 * `npm run check:bundle` — entry stays free of lawn/canvas weight the same
 * way `WorldStage` itself already does in `app/routes.tsx`). No static
 * importer outside this directory pulls the sheet in; the world stage mounts
 * it through this entry when a legion is selected.
 */
export const LegionSheetLazy = lazy(() =>
  import("./LegionSheet").then((m) => ({ default: m.LegionSheet }))
);

export { LegionSheet } from "./LegionSheet";
export { CargoTab, CargoTabContent, filterStockRows, rowDisplayName } from "./CargoTab";
export {
  CARGO_TAB_ACTIONS,
  buildCargoCommandBody,
  buildClaimBody,
  cargoCommandId,
  cargoWireKind,
  useFileCargoAction
} from "./cargoActions";
export { LEGION_SHEET_COPY, holderSentence, legionSheetCopy } from "./copyCatalog";

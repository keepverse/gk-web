import { lazy } from "react";

/**
 * empire-inventory-surfaces `storage-cache-ui` (plan Task 4D.2b) — route-split
 * entry. The claim flow (pin layer + prompt + capture-loss toast wire) ships
 * in its own chunk behind `React.lazy`, never on the entry chunk (bundle
 * budget: `npm run check:bundle` — the same discipline `legionSheet/index.ts`
 * keeps for the sheet). No static importer outside `stages/world` pulls this
 * in; the world stage mounts it through this entry when a legion is selected.
 */
export const CacheClaimPromptLazy = lazy(() =>
  import("./CacheClaimPrompt").then((m) => ({ default: m.CacheClaimPrompt }))
);

export { CacheClaimPrompt, CacheClaimPromptContent, CachePinLayer } from "./CacheClaimPrompt";
export { claimCommandId, detailForCommand } from "./CacheClaimPrompt";
export { captureHeader, captureLoserToast } from "./captureNotice";
export type { CaptureLossInput } from "./captureNotice";

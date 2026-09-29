/**
 * party-dungeon `delve-stage`'s door — `delveRoute(delveId)` is the world-map door's (D1.28) and,
 * later, the Sanctum descent picker's (D5.8) only import from this module.
 *
 * Originally minted by D1.28 as a narrow, one-function pull-forward of this task's own acceptance
 * line, with no rail entry, no lazy chunk and no route registered — `app/routes.tsx`'s own `"*"`
 * catch-all resolved it to Sanctum. **D5.1 (2026-09-07) lands the rest that header used to defer:**
 * `railState.ts` gains `"delve"` in `STAGE_IDS`, `app/routes.tsx` registers a real lazy
 * `<Route path="delve/:delveId">` (the same `SiegeStage`/`LawnStage` shape), and `DelveStage.tsx` is
 * a minimal placeholder stage — mirroring `SiegeStage.tsx`'s own identical starting shape from its
 * own shell-wiring task (21.1) — so navigating here now mounts a real, honestly-placeholder stage
 * instead of falling through to the catch-all.
 *
 * The function body is unchanged from D1.28: `HashRouter` (`app/App.tsx:13`) turns a plain router
 * path into the `#/...` URL the acceptance line names, so this returns a bare path, not a literal
 * `#/...` string, and the caller passes it to its own `useNavigate()` hook (matching every other
 * `navigate(...)` call site in `stages/world/WorldStage.tsx`).
 */
export function delveRoute(delveId: string): string {
  return `/delve/${delveId}`;
}

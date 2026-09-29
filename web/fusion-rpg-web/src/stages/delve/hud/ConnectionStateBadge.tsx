import { cn } from "@/lib/cn";
import { connectionStatusLabel, type DelveConnectionStatus } from "./connectionState";

/** One dot colour per state — `ok`/`warn`/`bad`/`muted` are this theme's real, shipped tokens
 * (`theme/tokens.css`); there is no "good" token, so the live state reads `bg-ok`, not an invented
 * `bg-good`. */
const DOT_CLASS: Record<DelveConnectionStatus, string> = {
  live: "bg-ok",
  reconnecting: "bg-warn",
  frozen: "bg-bad-solid",
  offline: "bg-muted"
};

/**
 * Band-1 (spec-delve-stage.md §7's HUD row). Props-driven only — see `connectionState.ts`'s own doc
 * comment for why this never reads a live source itself. `DelveHud.tsx` passes the one honest default
 * this build has today (`"offline"`); a future D5.11 session client feeds a real value through the
 * same prop, no change owed here.
 */
export function ConnectionStateBadge({ status }: { status: DelveConnectionStatus }) {
  return (
    <div
      className="flex items-center gap-1.5 rounded-pill border border-border-control bg-panel px-2 py-1 text-xs text-text"
      data-testid="delve-connection-state"
      data-status={status}
    >
      <span aria-hidden="true" className={cn("h-2 w-2 rounded-full", DOT_CLASS[status])} />
      <span data-testid="delve-connection-state-label">{connectionStatusLabel(status)}</span>
    </div>
  );
}

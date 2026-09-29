/**
 * rift-gate entry-landing: the ONE landing rule. The FE decides, not the host.
 *
 * `/sanctum` is the new-save entry point — where TitleScreen's own Continue goes, and where the eight
 * rail layers unlock by real play. `/saves` was the rejected alternative because it has no unlockable
 * pages, so it cannot be what "other pages stay locked" describes.
 *
 * The host keeps navigating the bare server origin (PlaySession.ActiveUrl has no path) and the SPA's
 * HashRouter resolves "/" to TitleScreen; pinning a route into the host URL would fight the router and
 * settle the "remember last page" question by accident.
 *
 * Pure and React-free, so the rule is testable as a truth table with no DOM.
 */
export function shouldLandOnSanctum(input: {
  /** The durable first-open fact: the FE has been opened at least once for this player. */
  firstOpen: boolean;
  /** Whether the visit is embedded (the host's `?embed=1` marker). Not branched on in v1. */
  embedded: boolean;
  /** The route the page is currently on. */
  pathname: string;
}): boolean {
  if (!input.firstOpen) return false;        // a returning player keeps their own route
  if (input.pathname === "/sanctum") return false; // already there — never re-navigate in place
  return true;
}

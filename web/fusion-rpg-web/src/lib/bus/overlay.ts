import { sendJson } from "./rest";

/**
 * rift-gate overlay-hide: ask the host to close the overlay window.
 *
 * The route is named for the player action (Leave), not the mechanism — the internal command is
 * `overlay.hide`. It rides the existing server→injector command seam; the injector host hides in
 * process, the launcher host relays the pipe verb. There is one close path, not a second transport.
 *
 * This is deliberately NOT an onboarding acknowledgement: closing the window must never be recorded
 * as finishing or skipping the prologue. Nothing in this module touches the story ledger.
 */
export function postOverlayLeave(): Promise<{ ok: boolean }> {
  return sendJson<{ ok: boolean }>("/api/overlay/leave", "POST");
}

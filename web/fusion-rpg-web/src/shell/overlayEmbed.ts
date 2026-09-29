/**
 * rift-gate decision 16: the embed marker both hosts append to the overlay URL, so the page can tell
 * it is embedded — and therefore that Leave can work.
 *
 * It is a **query flag**, not a hash fragment: this app uses a HashRouter, so the hash is the router's
 * own domain and a marker there would be parsed as a route. A plain browser visit carries no marker,
 * and the page must behave correctly without one (Leave is simply not offered).
 *
 * The literal is duplicated from `FusionRpg.Core.Overlay.OverlayEmbedMarker` and the launcher's copy
 * because the web bundle shares no assembly with them; `RiftGateEmbedMarkerGuardTests` pins all three.
 */
export const EMBED_QUERY_KEY = "embed";
export const EMBED_QUERY_VALUE = "1";

/** True when this URL is an embedded overlay visit rather than a plain browser visit. */
export function isEmbedded(url: string = window.location.href): boolean {
  try {
    const params = new URL(url).searchParams;
    return params.get(EMBED_QUERY_KEY) === EMBED_QUERY_VALUE;
  } catch {
    return false;
  }
}

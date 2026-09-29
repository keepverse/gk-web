import { useMemo } from "react";
import { isEmbedded } from "./overlayEmbed";

/**
 * Whether the current page is an embedded overlay visit. Thin React wrapper over the pure
 * `isEmbedded` reader so components can branch on it without touching `window` directly.
 */
export function useOverlayEmbed(): boolean {
  return useMemo(() => isEmbedded(), []);
}

import { actorSurfaceCatalogNow } from "@/lib/actorSurfaceCatalog";

/** Resolve a catalog-owned HUD glyph to the checksum-mirrored public PNG. */
export function actorHudElementArtUrl(elementId: string): string | undefined {
  const entry = actorSurfaceCatalogNow().elements.find((candidate) => candidate.id === elementId);
  if (!entry?.hudGlyph || entry.presentationOnly) return undefined;
  return `/actor-hud-elements/${entry.hudGlyph}.png`;
}

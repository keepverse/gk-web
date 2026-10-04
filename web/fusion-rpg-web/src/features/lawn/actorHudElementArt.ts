import { actorSurfaceCatalogNow } from "@/lib/actorSurfaceCatalog";

/**
 * Resolve a catalog-owned HUD glyph to its public PNG.
 *
 * This tree is a MANUAL COPY of the authoritative one, not a mirror of it. The authoritative
 * tree is gk-fusion `src/FusionRpg.Injector/Assets/actor-hud-elements/`, which the four loader
 * projects there glob, so those are the bytes a build ships; this directory is a downstream copy
 * of its 64px root set only.
 *
 * There is NO mirror, sync or checksum mechanism for this tree in any repository, and no test
 * compares the two copies. A PNG changed upstream is NOT picked up here automatically.
 *
 * The file-naming convention -- `<hudGlyph>.png` at the tree root -- IS the contract. Neither
 * this function nor the loader reads `manifest.json`; that file is a provenance record, and its
 * element/glyph/colour columns are a snapshot of gk-core's element catalogue, which owns them.
 *
 * If you need drift detection, it belongs on the gk-fusion side or in a workspace-level guard:
 * this repository's CI checks out gk-core and gk-data but NOT gk-fusion, and this repository's
 * root resolver exposes no fusion root, so a comparison cannot run here as configured.
 */
export function actorHudElementArtUrl(elementId: string): string | undefined {
  const entry = actorSurfaceCatalogNow().elements.find((candidate) => candidate.id === elementId);
  if (!entry?.hudGlyph || entry.presentationOnly) return undefined;
  return `/actor-hud-elements/${entry.hudGlyph}.png`;
}

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { tryGetJson } from "./rest";
import {
  actorSurfaceFixture,
  derivedSurfaceFromFixture,
  type ActorSurfaceCatalog,
  type DerivedSurfaceDto
} from "@/lib/actorSurfaceCatalog";

/**
 * The React/REST half of the actor-surface catalog. The catalog itself — the tuning JSON, its row
 * types, the `window` cache and `actorSurfaceCatalogNow()` — lives in `@/lib/actorSurfaceCatalog`
 * so the Phaser lawn plane can read it without pulling this module's hooks and query client in
 * (`src/game/scenes/importGuard` bans exactly that). Everything below is re-exported from here, so
 * the ~40 existing importers of `@/lib/bus/actorSurface` are unaffected — this file stays the
 * module's public face, the extracted one is its source.
 */

export * from "@/lib/actorSurfaceCatalog";

export async function fetchActorSurfaceCatalog(): Promise<ActorSurfaceCatalog> {
  try {
    return (await tryGetJson<ActorSurfaceCatalog>("/api/catalogs/actor-surface")) ?? actorSurfaceFixture();
  } catch {
    // FE-only catalog-era bridge. Remove this fallback once every shipped Server exposes the endpoint.
    return actorSurfaceFixture();
  }
}

export async function fetchDerivedSurface(lang = "en", side = "plant"): Promise<DerivedSurfaceDto> {
  try {
    const cooked = await tryGetJson<DerivedSurfaceDto>(
      `/api/catalogs/derived-surface?lang=${encodeURIComponent(lang)}&side=${encodeURIComponent(side)}`
    );
    if (cooked?.tabs?.length) return cooked;
  } catch {
    /* fall through to fixture cook-shape */
  }
  return derivedSurfaceFromFixture(actorSurfaceFixture(), side);
}

export function useDerivedSurface(lang = "en", side = "plant") {
  return useQuery({
    queryKey: ["derivedSurface", lang, side] as const,
    queryFn: () => fetchDerivedSurface(lang, side),
    staleTime: Infinity
  });
}

export function useActorSurfaceCatalog() {
  const query = useQuery({
    queryKey: ["actorSurfaceCatalog"] as const,
    queryFn: fetchActorSurfaceCatalog,
    staleTime: Infinity
  });

  useEffect(() => {
    if (query.data) window.__fusionRpgActorSurface = query.data;
  }, [query.data]);

  return query;
}

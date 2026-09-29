/**
 * Actor-surface catalog + actor-sheet DTO — a type-only re-export through the contract layer.
 *
 * `ActorSurfaceCatalog` (`GET /api/catalogs/actor-surface`, `lib/bus/actorSurface.ts`) is a
 * read-only classification catalog (aptitude / derived-family / resource / element / status /
 * kit-role rows) the actor sheet renders exactly as delivered — no `ui/actor/*` or
 * `ui/gui-lego/pieces/*` component narrows it into a smaller view shape today. `ActorSheetDto`'s
 * `displayName` / `level` / `roleLabel` / `typeId` fields, consumed the same way by
 * `ActorSummarize` / `ConditionTab` / `ShieldTab`, are identical: rendered unchanged, with no
 * adapter anywhere in the tree.
 *
 * `scanForRestDtoImports` (`contractGuard.ts`) exempts `src/contract/` as the one place importing a
 * REST DTO type is the point — this file is that place for these two wire shapes, matching the
 * "legacy world model" precedent already documented on `LEGACY_WORLD_MODEL_ALLOWED_PATHS` in that
 * same guard: "every caller ... wants the wire shape exactly as it is". A caller that starts
 * needing a real, narrowed view of either type should add one here instead of reaching back to
 * `@/lib/bus/*` directly — this file is where that adapter belongs once one is needed.
 */
export type { ActorSurfaceCatalog, StatusCatalogRow } from "@/lib/bus/actorSurface";
export type { ActorSheetDto } from "@/lib/bus/aura";

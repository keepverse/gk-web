import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ChunkFallback } from "@/shell/ChunkFallback";
import { SanctumStage } from "@/stages/sanctum/SanctumStage";
import { AppShell } from "./AppShell";
import { SaveSelect } from "./SaveSelect";
import { TitleScreen } from "./TitleScreen";

// GG-38: entry loads the Sanctum only. Lawn (Phaser) and World (Phaser dual-plane map island) are the
// two heaviest dependencies in the tree (tech-stack.md §2 / T3) and neither is needed to reach the
// Sanctum — each becomes its own chunk, fetched only when its route is actually visited.
const CreaturesPage = lazy(() => import("@/features/creatures/CreaturesPage").then((m) => ({ default: m.CreaturesPage })));
const LawnStage = lazy(() => import("@/stages/lawn/LawnStage").then((m) => ({ default: m.LawnStage })));
const ActorLadderDemoPage = lazy(() =>
  import("@/ui/actor/ActorLadderDemoPage").then((m) => ({ default: m.ActorLadderDemoPage }))
);
const ActorMenuScopePickerDemoPage = lazy(() =>
  import("@/ui/scope/ActorMenuScopePickerDemoPage").then((m) => ({ default: m.ActorMenuScopePickerDemoPage }))
);
const StoragePage = lazy(() => import("@/features/storage/StoragePage").then((m) => ({ default: m.StoragePage })));
// world-stage W33/owner decision (2026-09-04): `#/world` now serves the new stage directly — the
// old `@xyflow/react`-based `WorldPage` is deleted (its three production files and two test mocks
// went with it). `#/world-stage` keeps working too, as an alias to the same lazy chunk, so nothing
// that already links there needs to change.
const WorldStage = lazy(() => import("@/stages/world/WorldStage").then((m) => ({ default: m.WorldStage })));
// base-defense's fifth-stage amendment (decisions.md, approved 2026-09-04). Lazy like every other
// non-entry stage (spec-siege-stage.md's own "lazy-load the stage" boundary) — it will carry the
// same Phaser weight as Lawn once `board-render` is wired in (a later `stages/siege/` task).
const SiegeStage = lazy(() => import("@/stages/siege/SiegeStage").then((m) => ({ default: m.SiegeStage })));
// party-dungeon's sixth-stage amendment (decisions.md, approved 2026-09-05; spec-delve-stage.md §4).
// Lazy like every other non-entry stage. D5.1 wires the shell only — a minimal placeholder, the same
// starting shape `SiegeStage` had after its own 21.1 — the real room graph is D5.4's later task.
const DelveStage = lazy(() => import("@/stages/delve/DelveStage").then((m) => ({ default: m.DelveStage })));

/** T12: developer tree surfaces, reached via `` ` `` or `?dev=<id>` — never a route of their own. */
const DEV_ROUTE_REDIRECTS: Record<string, string> = {
  status: "status",
  stats: "stats",
  "pvz-activity": "pvz-activity",
  "icon-dump": "icon-dump",
  "almanac-dump": "almanac-dump",
  cheats: "cheats",
  sim: "sim",
  runs: "runs",
  "phaser-scene-poc": "phaser-scene-poc"
};

export function AppRoutes() {
  return (
    <Routes>
      {/* Plate 01 §A/§B — band -1, the door. Deliberately outside the AppShell wrapper: no rail,
          no per-stage hud, nothing but the screen itself (plate's own "no server address, no
          connection state" instruction). */}
      <Route path="/" element={<TitleScreen />} />
      <Route path="/saves" element={<SaveSelect />} />
      <Route element={<AppShell />}>
        <Route path="sanctum" element={<SanctumStage />} />
        {Object.entries(DEV_ROUTE_REDIRECTS).map(([routePath, devId]) => (
          <Route key={routePath} path={routePath} element={<Navigate to={`/sanctum?dev=${devId}`} replace />} />
        ))}
        <Route path="pvz-stats" element={<Navigate to="/sanctum?panel=chronicle" replace />} />
        <Route path="rpg-progression" element={<Navigate to="/sanctum?panel=chronicle" replace />} />
        <Route path="types" element={<Navigate to="/sanctum?panel=almanac" replace />} />
        <Route path="recipes" element={<Navigate to="/sanctum?panel=almanac" replace />} />
        {/* information-architecture.md: "/runs → Chronicle → Runs → player" — the real player
            home, distinct from T12's dev-tree "runs" surface (raw/engine-vocabulary, reached via
            `?dev=runs`, left as-is). */}
        <Route path="metrics" element={<Navigate to="/sanctum?panel=chronicle" replace />} />
        <Route
          path="storage"
          element={
            <Suspense fallback={<ChunkFallback testId="chunk-fallback-storage" />}>
              <StoragePage />
            </Suspense>
          }
        />
        <Route
          path="lawn"
          element={
            <Suspense fallback={<ChunkFallback testId="chunk-fallback-lawn" />}>
              <LawnStage />
            </Suspense>
          }
        />
        <Route
          path="actor-ladder-demo"
          element={
            <Suspense fallback={<ChunkFallback testId="chunk-fallback-actor-ladder-demo" />}>
              <ActorLadderDemoPage />
            </Suspense>
          }
        />
        <Route
          path="actor-menu-scope-picker-demo"
          element={
            <Suspense fallback={<ChunkFallback testId="chunk-fallback-actor-menu-scope-picker-demo" />}>
              <ActorMenuScopePickerDemoPage />
            </Suspense>
          }
        />
        <Route
          path="world"
          element={
            <Suspense fallback={<ChunkFallback testId="chunk-fallback-world" />}>
              <WorldStage />
            </Suspense>
          }
        />
        <Route
          path="world-stage"
          element={
            <Suspense fallback={<ChunkFallback testId="chunk-fallback-world-stage" />}>
              <WorldStage />
            </Suspense>
          }
        />
        <Route
          path="siege/:siegeId"
          element={
            <Suspense fallback={<ChunkFallback testId="chunk-fallback-siege" />}>
              <SiegeStage />
            </Suspense>
          }
        />
        <Route
          path="delve/:delveId"
          element={
            <Suspense fallback={<ChunkFallback testId="chunk-fallback-delve" />}>
              <DelveStage />
            </Suspense>
          }
        />
        <Route path="roster" element={<Navigate to="/sanctum?panel=creatures" replace />} />
        <Route
          path="creatures"
          element={
            <Suspense fallback={<ChunkFallback testId="chunk-fallback-creatures" />}>
              <CreaturesPage />
            </Suspense>
          }
        />
        <Route path="expeditions" element={<Navigate to="/sanctum?panel=expeditions" replace />} />
        <Route path="fusion" element={<Navigate to="/sanctum?panel=fusion" replace />} />
        <Route path="pacts" element={<Navigate to="/sanctum?panel=pacts" replace />} />
        <Route path="*" element={<Navigate to="/sanctum" replace />} />
      </Route>
    </Routes>
  );
}

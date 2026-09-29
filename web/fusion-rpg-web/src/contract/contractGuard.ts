import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import type { Pending } from "./pending";

export type GuardViolation = {
  file: string;
  line: number;
  text: string;
};

// ---------------------------------------------------------------------------
// Guard 1: every `pending` state carries a non-empty reason at runtime.
// Player-facing quality is enforced separately by pendingCopyGuard.ts (R1b).
// ---------------------------------------------------------------------------

export function findEmptyPendingReasons(value: unknown, path = "$"): GuardViolation[] {
  const violations: GuardViolation[] = [];
  if (value === null || typeof value !== "object") return violations;

  if (Array.isArray(value)) {
    value.forEach((item, i) => violations.push(...findEmptyPendingReasons(item, `${path}[${i}]`)));
    return violations;
  }

  const obj = value as Record<string, unknown>;
  if (obj.state === "pending") {
    const reason = obj.reason;
    if (typeof reason !== "string" || reason.trim().length === 0) {
      violations.push({ file: path, line: 0, text: `pending with empty/missing reason at ${path}` });
    }
    return violations;
  }

  for (const [key, child] of Object.entries(obj)) {
    violations.push(...findEmptyPendingReasons(child, `${path}.${key}`));
  }
  return violations;
}

export function assertNoEmptyPendingReasons<T>(value: T): void {
  const violations = findEmptyPendingReasons(value);
  if (violations.length > 0) {
    throw new Error(
      `assertNoEmptyPendingReasons: ${violations.length} pending field(s) with an empty reason:\n` +
        violations.map((v) => `  ${v.text}`).join("\n")
    );
  }
}

// ---------------------------------------------------------------------------
// Guard 2: `stages/`, `layers/` and `ui/` bind to the contract, never to a
// REST DTO type — matched by the wire's own `*Dto` naming, not by which
// module happens to import or re-export it (W3, below). `src/contract/` is
// the one place adapting a DTO is the point, so it's exempt.
// ---------------------------------------------------------------------------

const GUARDED_DIRS = ["stages", "layers", "ui"];
const SCANNABLE_EXTENSIONS = new Set([".ts", ".tsx"]);
const TEST_FILE_PATTERN = /\.(test|spec)\.[jt]sx?$/;

function walk(rootDir: string, onFile: (filePath: string) => void): void {
  let entries: string[];
  try {
    entries = readdirSync(rootDir);
  } catch {
    return; // directory doesn't exist yet (e.g. layers/ before T10)
  }
  for (const entry of entries) {
    const fullPath = join(rootDir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      walk(fullPath, onFile);
    } else if (SCANNABLE_EXTENSIONS.has(extname(fullPath)) && !TEST_FILE_PATTERN.test(entry)) {
      onFile(fullPath);
    }
  }
}

/** A type-only import (`import type {...}` or an inline `type X`) from `@/lib/bus...`. */
const BUS_TYPE_IMPORT_PATTERN = /from\s+["']@\/lib\/bus/;

/**
 * world-stage W3 (2026-09-04): the class this guard exists to close, not just the world's instance
 * of it. Before this, the guard matched only the *import path* `@/lib/bus` — so a DTO re-exported
 * through anywhere else (a feature-local shim, a barrel file, a future domain's own `Types.ts`)
 * reached `stages/`, `layers/` or `ui/` uncaught. `worldTypes.ts` was exactly that hole: the world's
 * DTOs lived there, not under `@/lib/bus`, until W2 moved them.
 *
 * The fix matches the wire's own naming discipline instead of a path: every REST DTO type in this
 * codebase is named `*Dto` (`WorldSectorDto`, `UniqueActorDto`, `ActorDerivedDto`, …), and the one
 * legitimate place to import one is `src/contract/` itself (adapting a DTO into a view is the whole
 * point of that directory, and it is never one of `GUARDED_DIRS`). So: a type-only import of a
 * `*Dto`-suffixed identifier from anywhere **other than** `contract/` is a violation, regardless of
 * which module re-exports it. The original `@/lib/bus` path check is kept — it still catches a
 * direct bus import that happens to name something not ending in `Dto` (rare today, but the class of
 * defect this guard polices is "binds to a DTO", not "binds to a DTO named a certain way").
 */
const DTO_IDENTIFIER_PATTERN = /\b[A-Z]\w*Dto\b/;
const CONTRACT_IMPORT_PATTERN = /from\s+["'](?:@\/)?(?:\.\.?\/)*contract\//;

/**
 * world-stage (2026-09-05): six files carrying forward a **pre-existing** exception, not new debt.
 * `worldSelection.ts`, `worldViewModel.ts`, `turnPlayback.ts`, `commanderIntent.ts`, `labels.ts` and
 * `playbackKeyframes.ts` touched the raw wire shape directly from the day they were written — the
 * same already-sanctioned reason `WorldStage.tsx`'s own doc comment gives for `dto.factions.find(...)`
 * and `toGraph(dto)`: nothing has adapted a legion's route-relevant fields, a faction, a turn report's
 * container, or a submitted command's own shape into the view contract yet, because no `stages/`
 * component has ever needed a simplified *view* of any of them — every caller of these files wants
 * the wire shape exactly as it is. They lived outside every guarded directory (`features/world/`)
 * until this pass moved them under `stages/world/` to retire that directory per the plan's own
 * architecture decision; the move is real, the exception on these six files is not — only
 * `contract/adapt.ts` had the actual, narrower adapters (`adaptWorldLegion`, `adaptWorldForce`,
 * `adaptWorldSector`, `adaptWorldState`, `adaptWorldTurnEvent`) these files could have borrowed types
 * from structurally, and even those cover only some of what these six need (nothing adapts a whole
 * `WorldTurnReportDto`, a `WorldFactionDto`, or `WorldCommandRequest` today, and inventing that now
 * would be a new View type with no renderer asking for one). **Not a precedent** — any other file
 * under `stages/`, `layers/` or `ui/` still may never import a REST DTO type; this list exists so the
 * six specific files that already had this exception keep it, named and dated, rather than silently
 * reopening the hole `W3`'s own history above already tells the story of closing.
 */
const LEGACY_WORLD_MODEL_ALLOWED_PATHS = new Set([
  "stages/world/worldSelection.ts",
  "stages/world/worldViewModel.ts",
  "stages/world/turnPlayback.ts",
  "stages/world/commanderIntent.ts",
  "stages/world/labels.ts",
  "stages/world/playbackKeyframes.ts"
]);

function isTypeImportLine(line: string): boolean {
  return /^\s*import\s+type\s+\{/.test(line) || /\{\s*[^}]*\btype\s+[A-Z]\w*/.test(line);
}

function isForbiddenDtoImport(line: string, relPath: string): boolean {
  if (!isTypeImportLine(line)) return false;
  if (LEGACY_WORLD_MODEL_ALLOWED_PATHS.has(relPath)) return false;
  if (BUS_TYPE_IMPORT_PATTERN.test(line)) return true;
  if (CONTRACT_IMPORT_PATTERN.test(line)) return false; // src/contract/ is the one exempt place
  return DTO_IDENTIFIER_PATTERN.test(line);
}

export function scanForRestDtoImports(srcDir: string): GuardViolation[] {
  const violations: GuardViolation[] = [];
  for (const dirName of GUARDED_DIRS) {
    walk(join(srcDir, dirName), (filePath) => {
      const relPath = relative(srcDir, filePath).split("\\").join("/");
      const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
      lines.forEach((line, index) => {
        if (isForbiddenDtoImport(line, relPath)) {
          violations.push({ file: relPath, line: index + 1, text: line.trim() });
        }
      });
    });
  }
  return violations;
}

/** Re-exported for tests that want to construct fixtures without duplicating the Pending shape. */
export type { Pending };

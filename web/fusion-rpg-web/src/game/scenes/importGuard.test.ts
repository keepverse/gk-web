import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Lawn-plane importGuard (mirror world): Phaser under src/game must not import
 * @/lib/bus HTTP/icon helpers or React. World tree has its own guard.
 */

const GAME_ROOT = join(__dirname, "..");
const SKIP_DIRS = new Set(["world", "poc", "node_modules"]);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (
      /\.(ts|tsx)$/.test(name) &&
      !name.endsWith(".test.ts") &&
      !name.endsWith(".test.tsx")
    ) {
      out.push(full);
    }
  }
  return out;
}

const IMPORT_RE =
  /^\s*import\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/gm;

describe("game/ lawn-plane import guard", () => {
  it("does not import React or @/lib/bus from Phaser lawn trees", () => {
    const violations: string[] = [];
    for (const file of walk(GAME_ROOT)) {
      if (file.includes(`${join("game", "world")}`) || file.includes("importGuard")) {
        continue;
      }
      // game-host is outside this walk (parent is game/)
      const src = readFileSync(file, "utf8");
      const rel = relative(GAME_ROOT, file).replace(/\\/g, "/");
      let m: RegExpExecArray | null;
      IMPORT_RE.lastIndex = 0;
      while ((m = IMPORT_RE.exec(src))) {
        const spec = m[1]!;
        if (
          spec === "react" ||
          spec.startsWith("react/") ||
          spec === "react-dom" ||
          spec.startsWith("react-dom/")
        ) {
          violations.push(`${rel} imports React (${spec})`);
        }
        if (spec === "@/lib/bus" || spec.startsWith("@/lib/bus/")) {
          violations.push(`${rel} imports @/lib/bus (${spec})`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("live lawn paint uses BoardLayers Graphics path (ensureGrid deleted — lock 4c flip)", () => {
    const scene = readFileSync(
      join(GAME_ROOT, "scenes", "LawnWorldScene.ts"),
      "utf8"
    );
    expect(scene).toMatch(/paintLawnTerrainGraphics/);
    expect(scene).not.toMatch(/ensureGrid\(/);
  });
});

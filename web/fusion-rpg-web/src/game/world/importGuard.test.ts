import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const WORLD_ROOT = join(__dirname);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(name) && !name.endsWith(".test.ts") && !name.endsWith(".test.tsx")) {
      out.push(full);
    }
  }
  return out;
}

const IMPORT_RE = /^\s*import\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/gm;

describe("game/world import guard (R15)", () => {
  it("does not import React, @/lib/bus, or *Dto modules", () => {
    const violations: string[] = [];
    for (const file of walk(WORLD_ROOT)) {
      // This guard file itself is allowed to use node:fs only.
      if (file.endsWith("importGuard.test.ts")) continue;
      const src = readFileSync(file, "utf8");
      const rel = relative(WORLD_ROOT, file).replace(/\\/g, "/");
      let m: RegExpExecArray | null;
      IMPORT_RE.lastIndex = 0;
      while ((m = IMPORT_RE.exec(src))) {
        const spec = m[1]!;
        if (spec === "react" || spec.startsWith("react/") || spec === "react-dom" || spec.startsWith("react-dom/")) {
          violations.push(`${rel} imports React (${spec})`);
        }
        if (spec === "@/lib/bus" || spec.startsWith("@/lib/bus/")) {
          violations.push(`${rel} imports @/lib/bus (${spec})`);
        }
        if (/Dto(\.[^/]+)?$/.test(spec) || /Dto["']/.test(spec) || /\/\w+Dto$/.test(spec)) {
          violations.push(`${rel} imports DTO module (${spec})`);
        }
      }
      // Also catch type-only named imports of *Dto from otherwise-allowed modules.
      if (/\b\w+Dto\b/.test(src) && /from\s+["'][^"']+["']/.test(src)) {
        const dtoImport = /import\s+(?:type\s+)?\{[^}]*\b(\w+Dto)\b[^}]*\}\s+from\s+["']([^"']+)["']/.exec(src);
        if (dtoImport) {
          violations.push(`${rel} imports DTO symbol ${dtoImport[1]} from ${dtoImport[2]}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
